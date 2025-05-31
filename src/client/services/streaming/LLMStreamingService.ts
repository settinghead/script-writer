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
            debounceTime(this.config.debounceMs || 16),
            map(content => {
                const cleaned = this.cleanContent(content);
                const parsed = this.parsePartial(cleaned);
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
        console.log(`[LLMStreamingService] Connecting to transform ${transformId}`);
        
        try {
            // Close any existing event source
            if (this.eventSource) {
                console.log(`[LLMStreamingService] Closing existing EventSource`);
                this.eventSource.close();
            }

            let accumulatedContent = '';
            let messageCount = 0;

            // Create new EventSource connection
            const url = `/api/streaming/transform/${transformId}`;
            console.log(`[LLMStreamingService] Creating EventSource for URL: ${url}`);
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                console.log(`[LLMStreamingService] EventSource connection opened for transform ${transformId}`);
            };

            this.eventSource.onmessage = (event) => {
                try {
                    messageCount++;
                    console.log(`[LLMStreamingService] Message ${messageCount} received for transform ${transformId}:`, {
                        data: event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''),
                        dataLength: event.data.length,
                        accumulatedLength: accumulatedContent.length
                    });

                    // Handle multiple chunks in a single message by splitting on newlines
                    const lines = event.data.split('\n').filter(line => line.trim() !== '');
                    
                    for (const line of lines) {
                        try {
                            // Check message format
                            if (line.startsWith('0:')) {
                                // Text chunk
                                const chunk = JSON.parse(line.substring(2));
                                accumulatedContent += chunk;

                                console.log(`[LLMStreamingService] Text chunk processed, accumulated length: ${accumulatedContent.length}`);
                                console.log(`[LLMStreamingService] Current accumulated content preview:`, 
                                    accumulatedContent.substring(0, 200) + (accumulatedContent.length > 200 ? '...' : ''));

                                // Emit to content$ subject to trigger the parsing pipeline
                                this.content$.next(accumulatedContent);
                            } else if (line.startsWith('e:')) {
                                // Completion event
                                const completionData = JSON.parse(line.substring(2));
                                console.log(`[LLMStreamingService] Completion event received:`, completionData);

                                // Emit final content and completion
                                this.content$.next(accumulatedContent);
                                this.completion$.next();

                                console.log(`[LLMStreamingService] Closing EventSource after completion`);
                                this.eventSource?.close();
                            } else if (line.startsWith('error:')) {
                                // Error event
                                const errorData = JSON.parse(line.substring(6));
                                console.error(`[LLMStreamingService] Error event received:`, errorData);
                                this.error$.next(new Error(errorData.error || 'Stream error'));
                                this.eventSource?.close();
                            } else {
                                // Other data format (like status messages)
                                try {
                                    const data = JSON.parse(line);
                                    console.log(`[LLMStreamingService] Status message:`, data);
                                } catch {
                                    console.log(`[LLMStreamingService] Non-JSON data received:`, line);
                                }
                            }
                        } catch (lineError) {
                            console.warn(`[LLMStreamingService] Skipping invalid line "${line}":`, lineError);
                            // Continue processing other lines instead of failing completely
                        }
                    }
                } catch (error) {
                    console.error(`[LLMStreamingService] Error processing message:`, error);
                }
            };

            this.eventSource.onerror = (error) => {
                console.error(`[LLMStreamingService] EventSource error for transform ${transformId}:`, error);
                
                // Try to fetch completed results if EventSource fails
                console.log(`[LLMStreamingService] Attempting to fetch completed transform results`);
                this.fetchCompletedTransform(transformId).catch(fetchError => {
                    console.error(`[LLMStreamingService] Failed to fetch completed transform:`, fetchError);
                    this.error$.next(new Error('Connection to transform stream failed'));
                });
                this.eventSource?.close();
            };

        } catch (error) {
            console.error(`[LLMStreamingService] Error in connectToTransform:`, error);
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
                // Failed to parse result, skip
            }
        }

        return items;
    }

    // Fetch completed transform results via regular HTTP
    private async fetchCompletedTransform(transformId: string): Promise<void> {
        console.log(`[LLMStreamingService] Fetching completed transform ${transformId}`);
        
        try {
            const response = await fetch(`/api/streaming/transform/${transformId}`);
            console.log(`[LLMStreamingService] Fetch response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch transform: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[LLMStreamingService] Fetched transform data:`, {
                status: data.status,
                hasResults: !!data.results,
                resultsCount: data.results?.length || 0,
                error: data.error
            });
            
            if (data.status === 'completed' && data.results) {
                // Parse and emit the completed results
                const completedItems = this.parsePartialResults(data.results);
                console.log(`[LLMStreamingService] Parsed ${completedItems.length} completed items`);
                
                const content = JSON.stringify(completedItems);
                this.content$.next(content);
                this.completion$.next();
            } else if (data.error) {
                console.error(`[LLMStreamingService] Transform fetch returned error:`, data.error);
                throw new Error(data.error);
            } else {
                console.warn(`[LLMStreamingService] Transform not completed or no results:`, data);
            }
        } catch (error) {
            console.error(`[LLMStreamingService] Error in fetchCompletedTransform:`, error);
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
                        // Failed to parse, skip
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