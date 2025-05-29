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

    // Observable streams
    readonly items$: Observable<T[]>;
    readonly status$: Observable<StreamingResponse<T>['status']>;
    readonly response$: Observable<StreamingResponse<T>>;

    constructor(protected config: StreamConfig = {}) {
        this.items$ = this.createItemsStream();
        this.status$ = this.createStatusStream();
        this.response$ = this.createResponseStream();
    }

    private createItemsStream(): Observable<T[]> {
        return this.content$.pipe(
            debounceTime(this.config.debounceMs || 50),
            map(content => {
                console.log('Items stream processing content of length:', content.length);
                const parsed = this.parsePartial(this.cleanContent(content));
                console.log('Items stream parsed items:', parsed.length);
                return parsed;
            }),
            filter(items => {
                console.log('Items stream filter check - items length:', items.length);
                return items.length > 0;
            }),
            distinctUntilChanged((a, b) => {
                const same = JSON.stringify(a) === JSON.stringify(b);
                console.log('Items stream distinctUntilChanged check - same?', same);
                return same;
            }),
            takeUntil(this.abort$),
            shareReplay(1)
        );
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
            takeUntil(this.abort$),
            shareReplay(1)
        );
    }

    private createResponseStream(): Observable<StreamingResponse<T>> {
        return merge(
            // Status changes
            this.status$.pipe(
                map(status => ({
                    status,
                    items: [] as T[],
                    rawContent: ''
                }))
            ),
            // Items updates - emit items with streaming status
            this.items$.pipe(
                map(items => ({
                    status: 'streaming' as const,
                    items,
                    rawContent: ''
                }))
            ),
            // Error handling
            this.error$.pipe(
                map(error => ({
                    status: 'error' as const,
                    items: [] as T[],
                    rawContent: '',
                    error
                }))
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
        this.abort$.next(); // Cancel any existing stream

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

    private async consumeStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
        const decoder = new TextDecoder();
        let accumulatedContent = '';

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
                                console.log('Accumulated content length:', accumulatedContent.length);
                                this.content$.next(accumulatedContent);
                            }
                        } else if (line.startsWith('e:') || line.startsWith('d:')) {
                            // End/Done events - trigger final parsing
                            console.log('Streaming completed, final content length:', accumulatedContent.length);
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
    }

    // Abstract methods for implementation
    abstract validate(item: any): item is T;
    abstract parsePartial(content: string): T[];
    abstract cleanContent(content: string): string;
} 