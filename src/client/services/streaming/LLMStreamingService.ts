import { Observable, Subject, merge, of, combineLatest } from 'rxjs';
import {
    debounceTime,
    map,
    filter,
    distinctUntilChanged,
    takeUntil,
    shareReplay,
    mapTo,
    startWith
} from 'rxjs/operators';
import { JSONStreamable } from '../../../common/streaming/interfaces';
import { StreamConfig, StreamingRequest, StreamingResponse } from '../../../common/streaming/types';

export abstract class LLMStreamingService<T> implements JSONStreamable<T> {
    protected abort$ = new Subject<void>();
    protected content$ = new Subject<string>();
    protected error$ = new Subject<Error>();
    protected completion$ = new Subject<void>();
    protected eventSource?: EventSource;

    // Observable streams
    readonly items$: Observable<T[]>;
    readonly status$: Observable<StreamingResponse<T>['status']>;
    readonly response$: Observable<StreamingResponse<T>>;

    constructor(protected config: StreamConfig = {}) {
        this.items$ = this.content$.pipe(
            debounceTime(this.config.debounceMs || 50),
            map(content => {
                console.log('[LLMStreamingService] Processing content for parsing, length:', content.length);
                const cleaned = this.cleanContent(content);
                console.log('[LLMStreamingService] Cleaned content sample:', cleaned.substring(0, 200));
                const parsed = this.parsePartial(cleaned);
                console.log('[LLMStreamingService] Parsed items:', parsed.length, parsed);
                return parsed;
            }),
            filter(items => items.length > 0),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            shareReplay(1)
        );

        this.status$ = this.createStatusStream();
        this.response$ = this.createResponseStream();
    }

    private createStatusStream(): Observable<StreamingResponse<T>['status']> {
        const streaming$ = this.content$.pipe(mapTo('streaming' as const));
        const completed$ = merge(
            this.content$.pipe(
                debounceTime(this.config.completionTimeoutMs || 2000),
                mapTo('completed' as const)
            ),
            this.completion$.pipe(mapTo('completed' as const))
        );
        const error$ = this.error$.pipe(mapTo('error' as const));

        return merge(
            of('idle' as const),
            streaming$,
            completed$,
            error$
        ).pipe(
            distinctUntilChanged(),
            takeUntil(this.abort$)
        );
    }

    private createResponseStream(): Observable<StreamingResponse<T>> {
        // Combine latest status with latest items to avoid race conditions
        const mainStream = combineLatest([
            this.status$.pipe(startWith('idle' as const)),
            this.items$.pipe(startWith([] as T[]))
        ]).pipe(
            map(([status, items]) => ({
                status,
                items,
                rawContent: ''
            }))
        );

        // Merge main stream with error stream
        return merge(
            mainStream,
            this.error$.pipe(
                map(error => ({
                    status: 'error' as const,
                    items: [] as T[],
                    rawContent: '',
                    error
                }))
            )
        ).pipe(
            distinctUntilChanged((a, b) =>
                a.status === b.status &&
                a.items.length === b.items.length &&
                JSON.stringify(a.items) === JSON.stringify(b.items)
            ),
            takeUntil(this.abort$),
            shareReplay(1)
        );
    }

    async start(request: StreamingRequest): Promise<void> {
        // Don't call abort$.next() here - it kills the streams!
        // Just reset the content

        try {
            const response = await fetch('/api/streaming/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Streaming failed: ${response.statusText}`);
            }

            await this.consumeStream(response.body!.getReader());
        } catch (error) {
            this.error$.next(error as Error);
        }
    }

    // NEW: Connect to an existing transform stream
    async connectToTransform(transformId: string): Promise<void> {
        console.log('[LLMStreamingService] connectToTransform called with:', transformId);
        try {
            // Close any existing event source
            if (this.eventSource) {
                console.log('[LLMStreamingService] Closing existing EventSource');
                this.eventSource.close();
            }

            let accumulatedContent = '';
            let messageCount = 0;

            // Create new EventSource connection
            const url = `/api/streaming/transform/${transformId}`;
            console.log('[LLMStreamingService] Creating EventSource for URL:', url);
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                console.log('[LLMStreamingService] EventSource opened for transform:', transformId);
            };

            this.eventSource.onmessage = (event) => {
                try {
                    messageCount++;
                    console.log(`[LLMStreamingService] Message #${messageCount} received, data starts with:`, event.data.substring(0, 20));

                    // Check message format
                    if (event.data.startsWith('0:')) {
                        // Text chunk
                        const chunk = JSON.parse(event.data.substring(2));
                        accumulatedContent += chunk;
                        console.log('[LLMStreamingService] Accumulated content length:', accumulatedContent.length);

                        // Emit to content$ subject to trigger the parsing pipeline
                        this.content$.next(accumulatedContent);
                    } else if (event.data.startsWith('e:')) {
                        // Completion event
                        const completionData = JSON.parse(event.data.substring(2));
                        console.log('[LLMStreamingService] Received completion event:', completionData);

                        // Emit final content and completion
                        this.content$.next(accumulatedContent);
                        this.completion$.next();

                        this.eventSource?.close();
                    } else if (event.data.startsWith('error:')) {
                        // Error event
                        const errorData = JSON.parse(event.data.substring(6));
                        console.error('[LLMStreamingService] Received error:', errorData);
                        this.error$.next(new Error(errorData.error || 'Stream error'));
                        this.eventSource?.close();
                    } else {
                        // Other data format (like status messages)
                        try {
                            const data = JSON.parse(event.data);
                            console.log('[LLMStreamingService] Received data:', data);
                        } catch {
                            console.log('[LLMStreamingService] Received non-JSON data:', event.data);
                        }
                    }
                } catch (error) {
                    console.error('[LLMStreamingService] Error processing message:', error);
                }
            };

            this.eventSource.onerror = (error) => {
                console.error('[LLMStreamingService] EventSource error for transform:', transformId, error);
                // Try to fetch completed results if EventSource fails
                this.fetchCompletedTransform(transformId).catch(fetchError => {
                    console.error('[LLMStreamingService] Failed to fetch completed transform:', fetchError);
                    this.error$.next(new Error('Connection to transform stream failed'));
                });
                this.eventSource?.close();
            };

        } catch (error) {
            this.error$.next(error as Error);
        }
    }

    // Helper to parse partial results from transform outputs
    protected parsePartialResults(results: any[]): T[] {
        const items: T[] = [];

        for (const result of results) {
            try {
                // Extract artifact data
                if (result.artifact && result.artifact.data) {
                    const artifactData = result.artifact.data;
                    // Convert from artifact format to expected format
                    const item = this.convertArtifactToItem(artifactData);
                    if (item && this.validate(item)) {
                        items.push(item);
                    }
                }
            } catch (error) {
                console.warn('Failed to parse partial result:', result, error);
            }
        }

        return items;
    }

    // Fetch completed transform results via regular HTTP
    private async fetchCompletedTransform(transformId: string): Promise<void> {
        try {
            const response = await fetch(`/api/streaming/transform/${transformId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch transform: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.status === 'completed' && data.results) {
                // Parse and emit the completed results
                const completedItems = this.parsePartialResults(data.results);
                const content = JSON.stringify(completedItems);
                this.content$.next(content);
                this.completion$.next();
            } else if (data.error) {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to fetch completed transform:', error);
            throw error;
        }
    }

    // Abstract method for converting artifact data to expected item format
    protected abstract convertArtifactToItem(artifactData: any): T | null;

    private async consumeStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
        const decoder = new TextDecoder();
        let accumulatedContent = ''

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    try {
                        // Handle AI SDK data stream format
                        if (line.startsWith('0:')) {
                            // Text chunk - extract the JSON content
                            const textData = JSON.parse(line.substring(2));
                            if (typeof textData === 'string') {
                                accumulatedContent += textData;
                                this.content$.next(accumulatedContent);
                            }
                        } else if (line.startsWith('e:') || line.startsWith('d:')) {
                            // End/Done events - trigger final parsing
                            if (accumulatedContent.trim()) {
                                this.content$.next(accumulatedContent);
                            }
                            // Emit completion event
                            this.completion$.next();
                        }
                        // Ignore other line types (f:, etc.)
                    } catch (parseError) {
                        console.warn('Failed to parse streaming data:', line, parseError);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    stop(): void {
        this.abort$.next();
        this.completion$.complete();
        // Clean up EventSource if exists
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }
    }

    // Abstract methods for implementation
    abstract validate(item: any): item is T;
    abstract parsePartial(content: string): T[];
    abstract cleanContent(content: string): string;
} 