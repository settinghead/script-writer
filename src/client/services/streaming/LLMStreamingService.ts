import { Observable, Subject, merge, of, combineLatest } from 'rxjs';
import {
    debounceTime,
    map,
    filter,
    distinctUntilChanged,
    takeUntil,
    shareReplay,
    mapTo,
    startWith,
    tap,
    switchMap
} from 'rxjs/operators';
import { JSONStreamable } from '../../../common/streaming/interfaces';
import { StreamConfig, StreamingRequest, StreamingResponse } from '../../../common/streaming/types';
import { processStreamingContent } from '../../../common/utils/textCleaning';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export type StreamingStatus = 'idle' | 'connected' | 'streaming' | 'thinking' | 'complete' | 'error';

let globalInstanceCounter = 0; // For debugging multiple instances

export interface LLMStreamingResponse<T> {
    items: T[];
    status: StreamingStatus;
    isThinking: boolean;
    hasError: boolean;
    errorMessage?: string;
    transformId?: string;
    progress?: number; // Optional progress indicator (0-100)
}

export abstract class LLMStreamingService<T> implements JSONStreamable<T> {
    protected abort$ = new Subject<void>();
    protected content$ = new Subject<string>();
    protected error$ = new Subject<Error>();
    protected completion$ = new Subject<void>();
    protected thinking$ = new Subject<boolean>();
    protected eventSource?: EventSource;
    protected currentTransformId$ = new BehaviorSubject<string | undefined>(undefined);

    // Observable streams
    readonly items$: Observable<T[]>;
    readonly status$: Observable<StreamingStatus>;
    readonly response$: Observable<LLMStreamingResponse<T>>;
    readonly isThinking$: Observable<boolean>;

    private lastEmittedItemsJson: string = '[]';
    private instanceId: string;

    constructor(protected config: StreamConfig = {}) {
        this.instanceId = `${this.constructor.name}-${globalInstanceCounter++}-${uuidv4().slice(0, 4)}`;
        console.log(`[${this.instanceId}] Service instantiated`);

        // Add a log to check content$ observers
        this.content$.subscribe(val => console.log(`[${this.instanceId}] constructor - content$ subscriber received: ${val.length}`));

        this.items$ = this.content$.pipe(
            tap(content => {
                console.log(`[${this.instanceId}] Raw content received in stream, length: ${content.length}`);
            }),
            debounceTime(this.config.debounceMs || 1),
            tap(content => {
                console.log(`[${this.instanceId}] Content after debounce, length: ${content.length}`);
            }),
            map(content => {
                console.log(`[${this.instanceId}] Processing content for parsing, length: ${content.length}`);
                const cleaned = this.cleanContent(content);
                console.log(`[${this.instanceId}] Cleaned content length: ${cleaned.length}`);
                const parsed = this.parsePartial(cleaned);
                console.log(`[${this.instanceId}] Parsed ${parsed.length} items from content`);
                return parsed;
            }),
            tap(items => {
                console.log(`[${this.instanceId}] About to filter, items.length: ${items.length}`);
                if (items.length > 0) {
                    console.log(`[${this.instanceId}] First item:`, items[0]);
                }
            }),
            filter(items => items.length > 0),
            tap(items => {
                console.log(`[${this.instanceId}] Passed filter, emitting ${items.length} items`);
            }),
            distinctUntilChanged((a, b) => {
                // During streaming, episodes grow in content, so we need to detect actual changes
                if (a.length !== b.length) {
                    console.log(`[${this.instanceId}] distinctUntilChanged: Different lengths (${a.length} vs ${b.length})`);
                    return false; // Different lengths = different
                }

                // Compare JSON string lengths to detect content growth during streaming
                const aJson = JSON.stringify(a);
                const bJson = JSON.stringify(b);

                // If content changed significantly (more than 10 characters), emit it
                if (Math.abs(aJson.length - bJson.length) > 10) {
                    console.log(`[${this.instanceId}] distinctUntilChanged: Content changed significantly (${aJson.length} vs ${bJson.length})`);
                    return false; // Content changed significantly
                }

                // Only block if content is truly identical
                const identical = aJson === bJson;
                if (identical) {
                    console.log(`[${this.instanceId}] distinctUntilChanged: Content identical, blocking emission`);
                } else {
                    console.log(`[${this.instanceId}] distinctUntilChanged: Content different, allowing emission`);
                }
                return identical;
            }),
            shareReplay(1)
        );

        this.isThinking$ = this.thinking$.pipe(
            distinctUntilChanged(),
            shareReplay(1)
        );

        this.status$ = this.createStatusStream();
        this.response$ = this.createResponseStream();
    }

    private createStatusStream(): Observable<StreamingStatus> {
        console.log(`[${this.instanceId}] ENTERING createStatusStream - SIMPLIFIED FOR DEBUGGING`);

        // Test: Directly map content$ to 'streaming' status
        const simplifiedStreamingStatus$ = this.content$.pipe(
            tap(() => console.log(`[${this.instanceId}] STATUS_PIPE_DEBUG: content$ emitted (in simplifiedStatusStream)`)),
            mapTo('streaming' as const),
            tap(status => console.log(`[${this.instanceId}] STATUS_PIPE_DEBUG: mapped to '${status}' (in simplifiedStatusStream)`))
        );

        // For this test, status$ will be idle initially, then only streaming if content$ emits.
        return simplifiedStreamingStatus$.pipe(
            startWith('idle' as const),
            tap(status => console.log(`[${this.instanceId}] STATUS_DEBUG: simplifiedStatusStream emitting: ${status}`)),
            distinctUntilChanged(), // Add back distinctUntilChanged, as we want this eventually
            takeUntil(this.abort$) // Add back takeUntil for proper lifecycle
        );
    }

    private createResponseStream(): Observable<LLMStreamingResponse<T>> {
        // Combine latest status, items, and thinking state to avoid race conditions
        const mainStream = combineLatest([
            this.status$.pipe(startWith('idle' as StreamingStatus)),
            this.items$.pipe(startWith([])),
            this.isThinking$.pipe(startWith(false)),
            this.error$.pipe(startWith(null as Error | null)), // Ensure error$ starts with null
            this.currentTransformId$.pipe(startWith(undefined as string | undefined)),
        ]).pipe(
            tap(([status, items, isThinking, error, transformId]) => {
                console.log(`[${this.instanceId}] CombineLatest emitting:`, {
                    status,
                    itemCount: items.length,
                    isThinking,
                    error,
                    transformId,
                });
            }),
            map(([status, items, isThinking, error, transformId]) => {
                // Ensure the mapped object conforms to LLMStreamingResponse<T>
                const response: LLMStreamingResponse<T> = {
                    status,
                    items,
                    isThinking,
                    hasError: !!error,
                    errorMessage: error ? error.message : undefined,
                    transformId,
                };
                return response;
            }),
            distinctUntilChanged((a, b) => {
                // More intelligent comparison for streaming content
                if (a.status !== b.status || a.isThinking !== b.isThinking || a.hasError !== b.hasError || a.transformId !== b.transformId) {
                    console.log(`[${this.instanceId}] Response distinctUntilChanged: Status/thinking/error/transformId changed`);
                    return false; // Different
                }

                const aJson = JSON.stringify(a.items);
                const bJson = JSON.stringify(b.items);

                if (a.items.length !== b.items.length) {
                    console.log(`[${this.instanceId}] Response distinctUntilChanged: Item count changed (${a.items.length} vs ${b.items.length})`);
                    this.lastEmittedItemsJson = bJson; // Update baseline for next comparison
                    return false; // Different
                }

                // Lenient comparison: if item count is the same, allow update if JSON content changed significantly
                // Heuristic for significant change (e.g. > 5 characters difference)
                const significantChange = Math.abs(aJson.length - this.lastEmittedItemsJson.length) > 5;

                if (significantChange) {
                    console.log(`[${this.instanceId}] Response distinctUntilChanged: Content length changed significantly (${this.lastEmittedItemsJson.length} vs ${bJson.length})`);
                    this.lastEmittedItemsJson = bJson; // Update baseline
                    return false; // Different - content has grown
                }

                // If not significantly different and item count is same, check for exact JSON match
                const identical = aJson === bJson;
                if (!identical) {
                    console.log(`[${this.instanceId}] Response distinctUntilChanged: Content changed (but not significantly), JSON different.`);
                    this.lastEmittedItemsJson = bJson; // Update baseline
                    return false;
                } else {
                    // console.log(`[${this.instanceId}] Response distinctUntilChanged: Content identical, blocking`);
                }
                return identical;
            }),
            tap(response => {
                console.log(`[${this.instanceId}] Response stream emitting:`, {
                    status: response.status,
                    itemCount: response.items.length,
                    isThinking: response.isThinking,
                    hasError: response.hasError,
                    transformId: response.transformId,
                });
            }),
            shareReplay(1) // Cache the last emitted response
        );

        return mainStream;
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
        console.log(`[${this.instanceId}] Connecting to transform ${transformId}`);

        try {
            // Close any existing event source
            if (this.eventSource) {
                console.log(`[${this.instanceId}] Closing existing EventSource`);
                this.eventSource.close();
            }

            let accumulatedContent = '';
            let previousContent = '';
            let messageCount = 0;

            // Create new EventSource connection
            const url = `/api/streaming/transform/${transformId}`;
            console.log(`[${this.instanceId}] Creating EventSource for URL: ${url}`);
            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
                console.log(`[${this.instanceId}] EventSource connection opened for transform ${transformId}`);
            };

            this.eventSource.onmessage = (event) => {
                try {
                    messageCount++;
                    console.log(`[${this.instanceId}] Message ${messageCount} received for transform ${transformId}:`, {
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

                                console.log(`[${this.instanceId}] Text chunk processed, accumulated length: ${accumulatedContent.length}`);
                                console.log(`[${this.instanceId}] Current accumulated content preview:`,
                                    accumulatedContent.substring(0, 200) + (accumulatedContent.length > 200 ? '...' : ''));

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
                                console.log(`[${this.instanceId}] Emitting content to content$ stream, length: ${accumulatedContent.length}. Has Observers: ${this.content$.observed}`);
                                this.content$.next(accumulatedContent);

                                previousContent = accumulatedContent;
                            } else if (line.startsWith('e:')) {
                                // Completion event
                                const completionData = JSON.parse(line.substring(2));
                                console.log(`[${this.instanceId}] Completion event received:`, completionData);

                                // Emit final content and completion
                                this.content$.next(accumulatedContent);
                                this.completion$.next();

                                // Ensure thinking mode is stopped on completion
                                this.thinking$.next(false);

                                console.log(`[${this.instanceId}] Closing EventSource after completion`);
                                this.eventSource?.close();
                            } else if (line.startsWith('error:')) {
                                // Error event
                                const errorData = JSON.parse(line.substring(6));
                                console.error(`[${this.instanceId}] Error event received:`, errorData);
                                this.error$.next(new Error(errorData.error || 'Stream error'));
                                this.eventSource?.close();
                            } else {
                                // Other data format (like status messages)
                                try {
                                    const data = JSON.parse(line);
                                    console.log(`[${this.instanceId}] Status message:`, data);
                                } catch {
                                    console.log(`[${this.instanceId}] Non-JSON data received:`, line);
                                }
                            }
                        } catch (lineError) {
                            console.warn(`[${this.instanceId}] Skipping invalid line "${line}":`, lineError);
                            // Continue processing other lines instead of failing completely
                        }
                    }
                } catch (error) {
                    console.error(`[${this.instanceId}] Error processing message:`, error);
                }
            };

            this.eventSource.onerror = (error) => {
                console.error(`[${this.instanceId}] EventSource error for transform ${transformId}:`, error);

                // Try to fetch completed results if EventSource fails
                console.log(`[${this.instanceId}] Attempting to fetch completed transform results`);
                this.fetchCompletedTransform(transformId).catch(fetchError => {
                    console.error(`[${this.instanceId}] Failed to fetch completed transform:`, fetchError);
                    this.error$.next(new Error('Connection to transform stream failed'));
                });
                this.eventSource?.close();
            };

        } catch (error) {
            console.error(`[${this.instanceId}] Error in connectToTransform:`, error);
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
        console.log(`[${this.instanceId}] Fetching completed transform ${transformId}`);

        try {
            const response = await fetch(`/api/streaming/transform/${transformId}`);
            console.log(`[${this.instanceId}] Fetch response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch transform: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[${this.instanceId}] Fetched transform data:`, {
                status: data.status,
                hasResults: !!data.results,
                resultsCount: data.results?.length || 0,
                error: data.error
            });

            if (data.status === 'completed' && data.results) {
                // Parse and emit the completed results
                const completedItems = this.parsePartialResults(data.results);
                console.log(`[${this.instanceId}] Parsed ${completedItems.length} completed items`);

                const content = JSON.stringify(completedItems);
                this.content$.next(content);
                this.completion$.next();
            } else if (data.error) {
                console.error(`[${this.instanceId}] Transform fetch returned error:`, data.error);
                throw new Error(data.error);
            } else {
                console.warn(`[${this.instanceId}] Transform not completed or no results:`, data);
            }
        } catch (error) {
            console.error(`[${this.instanceId}] Error in fetchCompletedTransform:`, error);
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