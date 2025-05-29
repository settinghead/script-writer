import { Observable, Subject, merge, of } from 'rxjs';
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
    protected eventSource?: EventSource;

    // Observable streams
    readonly items$: Observable<T[]>;
    readonly status$: Observable<StreamingResponse<T>['status']>;
    readonly response$: Observable<StreamingResponse<T>>;

    constructor(protected config: StreamConfig = {}) {
        this.items$ = this.content$.pipe(
            debounceTime(this.config.debounceMs || 50),
            map(content => {
                const parsed = this.parsePartial(this.cleanContent(content));
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
        const completed$ = this.content$.pipe(
            debounceTime(this.config.completionTimeoutMs || 2000),
            mapTo('completed' as const)
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
        return merge(
            // Status changes
            this.status$.pipe(
                map(status => {
                    return {
                        status,
                        items: [] as T[],
                        rawContent: ''
                    };
                })
            ),
            // Items updates - emit items with streaming status
            this.items$.pipe(
                map(items => {
                    return {
                        status: 'streaming' as const,
                        items,
                        rawContent: ''
                    };
                })
            ),
            // Error handling
            this.error$.pipe(
                map(error => {
                    return {
                        status: 'error' as const,
                        items: [] as T[],
                        rawContent: '',
                        error
                    };
                })
            )
        ).pipe(
            // Combine latest status with latest items
            distinctUntilChanged((a, b) =>
                a.status === b.status &&
                a.items.length === b.items.length &&
                JSON.stringify(a.items) === JSON.stringify(b.items)
            ),
            startWith({
                status: 'idle' as const,
                items: [] as T[],
                rawContent: ''
            }),
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
        try {
            // Close any existing event source
            if (this.eventSource) {
                this.eventSource.close();
            }

            let accumulatedContent = '';

            // Create new EventSource connection
            this.eventSource = new EventSource(`/api/streaming/transform/${transformId}`);

            this.eventSource.onopen = () => {
                console.log('Connected to transform stream:', transformId);
            };

            this.eventSource.onmessage = (event) => {
                try {
                    // First, try to parse as JSON (for status messages)
                    try {
                        const data = JSON.parse(event.data);

                        // Handle different event types from the streaming endpoint
                        if (data.status === 'connected') {
                            console.log('Connected to transform:', transformId);
                        } else if (data.status === 'partial_results' && data.results) {
                            // Load existing partial results
                            const existingItems = this.parsePartialResults(data.results);
                            if (existingItems.length > 0) {
                                // Emit the partial results as properly formatted JSON
                                accumulatedContent = JSON.stringify(existingItems);
                                this.content$.next(accumulatedContent);
                            }
                        } else if (data.status === 'completed' && data.results) {
                            // Handle completed job results
                            const completedItems = this.parsePartialResults(data.results);
                            const content = JSON.stringify(completedItems);
                            this.content$.next(content);
                            // Close the connection since job is done
                            this.eventSource?.close();
                        }
                    } catch (jsonError) {
                        // Not JSON, check if it's streaming data
                        // The backend sends streaming chunks in format "0:{chunk}"
                        if (event.data.startsWith('0:')) {
                            try {
                                // Extract text chunk from AI SDK format
                                const textData = JSON.parse(event.data.substring(2));
                                if (typeof textData === 'string') {
                                    accumulatedContent += textData;
                                    this.content$.next(accumulatedContent);
                                }
                            } catch (chunkError) {
                                console.warn('Failed to parse chunk:', event.data, chunkError);
                            }
                        } else if (event.data.startsWith('e:') || event.data.startsWith('d:')) {
                            // End/Done events - trigger final content update
                            if (accumulatedContent.trim()) {
                                this.content$.next(accumulatedContent);
                            }
                            this.eventSource?.close();
                        } else if (event.data.startsWith('error:')) {
                            // Error event
                            const errorData = JSON.parse(event.data.substring(6));
                            throw new Error(errorData.error || 'Streaming failed');
                        }
                    }
                } catch (parseError) {
                    console.warn('Failed to parse transform stream data:', event.data, parseError);
                }
            };

            this.eventSource.onerror = (error) => {
                console.error('Transform stream error:', error);
                this.error$.next(new Error('Connection to transform stream failed'));
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