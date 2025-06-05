import {
    BehaviorSubject,
    Observable,
    Subject,
    combineLatest,
    of,
    timer,
    merge,
} from 'rxjs';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    mapTo,
    mergeWith,
    scan,
    shareReplay,
    startWith,
    switchMap,
    take,
    takeUntil,
    tap,
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { JSONStreamable } from '../../../common/streaming/interfaces';
import { StreamConfig, StreamingRequest, StreamingResponse, ReasoningEvent } from '../../../common/streaming/types';
import { processStreamingContent } from '../../../common/utils/textCleaning';

export type StreamingStatus = 'idle' | 'connected' | 'streaming' | 'thinking' | 'completed' | 'error';

let globalInstanceCounter = 0; // For debugging multiple instances

export abstract class LLMStreamingService<T> implements JSONStreamable<T> {
    protected abort$ = new Subject<void>();
    protected content$ = new Subject<string>();
    protected error$ = new Subject<Error>();
    protected completion$ = new Subject<void>();
    protected thinking$ = new Subject<boolean>();
    protected reasoning$ = new Subject<ReasoningEvent>();
    protected eventSource?: EventSource;
    protected currentTransformId$ = new BehaviorSubject<string | undefined>(undefined);

    // Observable streams
    readonly items$: Observable<T[]>;
    readonly status$: Observable<StreamingStatus>;
    readonly response$: Observable<StreamingResponse<T>>;
    readonly isThinking$: Observable<boolean>;
    readonly reasoning$: Observable<ReasoningEvent>;

    private lastEmittedItemsJson: string = '[]';
    private instanceId: string;

    constructor(protected config: StreamConfig = {}) {
        this.instanceId = `${this.constructor.name}-${globalInstanceCounter++}-${uuidv4().slice(0, 4)}`;

        this.items$ = this.content$.pipe(
            debounceTime(this.config.debounceMs || 1),
            map(content => {
                const cleaned = this.cleanContent(content);
                const parsed = this.parsePartial(cleaned);
                return parsed;
            }),
            filter(items => items.length > 0),
            distinctUntilChanged((a, b) => {
                // During streaming, episodes grow in content, so we need to detect actual changes
                if (a.length !== b.length) {
                    return false; // Different lengths = different
                }

                // Compare JSON string lengths to detect content growth during streaming
                const aJson = JSON.stringify(a);
                const bJson = JSON.stringify(b);

                // If content changed significantly (more than 10 characters), emit it
                if (Math.abs(aJson.length - bJson.length) > 10) {
                    return false; // Content changed significantly
                }

                // Only block if content is truly identical
                return aJson === bJson;
            }),
            shareReplay(1)
        );

        this.isThinking$ = this.thinking$.pipe(
            distinctUntilChanged(),
            shareReplay(1)
        );

        this.reasoning$ = this.reasoning$.pipe(
            shareReplay(1)
        );

        this.status$ = this.createStatusStream();
        this.response$ = this.createResponseStream();
    }

    private createStatusStream(): Observable<StreamingStatus> {
        // Create proper status transitions: idle -> connected -> streaming -> completed/error
        const sourceContentForStatus$ = this.content$;

        const streaming$ = sourceContentForStatus$.pipe(
            take(1), // Only the first content emission triggers 'streaming'
            mapTo('streaming' as const),
            shareReplay(1) // Make it hot for combineLatest
        );

        // ONLY use explicit completion from backend - remove timeout guessing
        const completed$ = this.completion$.pipe(
            mapTo('completed' as const)
        );

        const error$ = this.error$.pipe(
            mapTo('error' as const)
        );

        const eventSourceStatus$ = new Observable<StreamingStatus>(observer => {
            const es = this.eventSource;
            if (es) {
                const onMessage = (event: MessageEvent) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.status === 'connected') {
                            observer.next('connected');
                        } else if (message.status === 'completed' || message.type === 'final') {
                            observer.next('completed');
                            observer.complete();
                        } else if (message.status === 'error') {
                            observer.next('error');
                            observer.complete();
                        }
                    } catch (e) {
                        // Not a status message, ignore
                    }
                };

                es.addEventListener('message', onMessage);
                return () => es.removeEventListener('message', onMessage);
            }
            return () => { };
        });

        return merge(
            of('idle' as const),
            eventSourceStatus$,
            streaming$,
            completed$,
            error$
        ).pipe(
            distinctUntilChanged(),
            takeUntil(this.abort$),
            shareReplay(1)
        );
    }

    private createResponseStream(): Observable<StreamingResponse<T>> {
        // Combine latest status, items, and thinking state to avoid race conditions
        const mainStream = combineLatest([
            this.status$.pipe(startWith('idle' as StreamingStatus)),
            this.items$.pipe(startWith([])),
            this.isThinking$.pipe(startWith(false)),
            this.error$.pipe(startWith(null as Error | null)),
            this.currentTransformId$.pipe(startWith(undefined as string | undefined)),
        ]).pipe(
            map(([status, items, isThinking, error, transformId]) => {
                const response: StreamingResponse<T> = {
                    status: status as 'idle' | 'streaming' | 'completed' | 'error', // Map to StreamingResponse status values
                    items,
                    isThinking,
                    error: error || undefined,
                    rawContent: '', // For compatibility with StreamingResponse interface
                };
                return response;
            }),
            distinctUntilChanged((a, b) => {
                // More intelligent comparison for streaming content
                if (a.status !== b.status || a.isThinking !== b.isThinking || !!a.error !== !!b.error) {
                    return false; // Different
                }

                const aJson = JSON.stringify(a.items);
                const bJson = JSON.stringify(b.items);

                if (a.items.length !== b.items.length) {
                    this.lastEmittedItemsJson = bJson;
                    return false; // Different
                }

                // Lenient comparison: if item count is the same, allow update if JSON content changed significantly
                const significantChange = Math.abs(aJson.length - this.lastEmittedItemsJson.length) > 5;

                if (significantChange) {
                    this.lastEmittedItemsJson = bJson;
                    return false; // Different - content has grown
                }

                // If not significantly different and item count is same, check for exact JSON match
                const identical = aJson === bJson;
                if (!identical) {
                    this.lastEmittedItemsJson = bJson;
                    return false;
                }
                return identical;
            }),
            shareReplay(1)
        );

        return mainStream;
    }

    async start(request: StreamingRequest): Promise<void> {
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

    // Connect to an existing transform stream
    async connectToTransform(transformId: string): Promise<void> {
        this.currentTransformId$.next(transformId);

        try {
            // Close any existing event source
            if (this.eventSource) {
                this.eventSource.close();
            }

            let accumulatedContent = '';
            let previousContent = '';

            // Create new EventSource connection
            const url = `/api/streaming/transform/${transformId}`;
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                // Connection opened
            };

            this.eventSource.onmessage = (event) => {
                try {
                    // Handle multiple chunks in a single message by splitting on newlines
                    const lines = event.data.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        try {
                            // Check message format
                            if (line.startsWith('0:')) {
                                // Text chunk
                                const chunk = JSON.parse(line.substring(2));
                                accumulatedContent += chunk;

                                // Detect thinking mode changes
                                const { isThinking, thinkingStarted, thinkingEnded } = processStreamingContent(
                                    accumulatedContent,
                                    previousContent
                                );

                                if (thinkingStarted) {
                                    this.thinking$.next(true);
                                } else if (thinkingEnded) {
                                    this.thinking$.next(false);
                                }

                                // Emit to content$ subject to trigger the parsing pipeline
                                this.content$.next(accumulatedContent);
                                previousContent = accumulatedContent;
                            } else if (line.startsWith('e:')) {
                                // Completion event
                                const completionData = JSON.parse(line.substring(2));

                                // Emit final content and completion
                                this.content$.next(accumulatedContent);
                                this.completion$.next();

                                // Ensure thinking mode is stopped on completion
                                this.thinking$.next(false);
                                this.eventSource?.close();
                            } else if (line.startsWith('error:')) {
                                // Error event
                                const errorData = JSON.parse(line.substring(6));
                                this.error$.next(new Error(errorData.error || 'Stream error'));
                                this.eventSource?.close();
                            } else {
                                // Other data format (like status messages or reasoning events)
                                try {
                                    const data = JSON.parse(line);
                                    
                                    // Handle reasoning events
                                    if (data.eventType === 'reasoning_event' && (data.type === 'reasoning_start' || data.type === 'reasoning_end')) {
                                        const reasoningEvent: ReasoningEvent = {
                                            type: data.type,
                                            phase: data.phase,
                                            timestamp: data.timestamp,
                                            modelName: data.modelName
                                        };
                                        this.reasoning$.next(reasoningEvent);
                                    }
                                    // Status messages are handled by the status stream
                                } catch {
                                    // Non-JSON data, ignore
                                }
                            }
                        } catch (lineError) {
                            // Continue processing other lines instead of failing completely
                        }
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            };

            this.eventSource.onerror = (error) => {
                // Try to fetch completed results if EventSource fails
                this.fetchCompletedTransform(transformId).catch(fetchError => {
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
                // Failed to parse result, skip
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