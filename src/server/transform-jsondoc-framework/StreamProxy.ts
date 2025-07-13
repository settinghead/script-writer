/**
 * StreamProxy - Consumes a ReadableStream once and broadcasts to multiple subscribers
 * 
 * This solves the AI SDK issue where partialObjectStream can only be accessed once
 * before the ReadableStream becomes locked.
 */

export interface StreamSubscriber<T> {
    onData: (data: T) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
}

export class StreamProxy<T> {
    private subscribers: Set<StreamSubscriber<T>> = new Set();
    private isConsuming = false;
    private isCompleted = false;
    private error: Error | null = null;
    private cachedData: T[] = [];

    constructor(private streamSource: () => AsyncIterable<T> | Promise<AsyncIterable<T>>) { }

    /**
     * Subscribe to the stream. If the stream is already completed, 
     * replay cached data immediately.
     */
    subscribe(subscriber: StreamSubscriber<T>): () => void {
        this.subscribers.add(subscriber);

        // If already completed, replay cached data
        if (this.isCompleted) {
            if (this.error) {
                setTimeout(() => subscriber.onError(this.error!), 0);
            } else {
                // Replay all cached data
                for (const data of this.cachedData) {
                    setTimeout(() => subscriber.onData(data), 0);
                }
                setTimeout(() => subscriber.onComplete(), 0);
            }
        } else if (!this.isConsuming) {
            // Start consuming the stream
            this.startConsuming();
        }

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(subscriber);
        };
    }

    /**
     * Create an async iterable that can be used in for-await loops
     */
    async *createAsyncIterable(): AsyncIterable<T> {
        const chunks: T[] = [];
        let isComplete = false;
        let error: Error | null = null;

        const unsubscribe = this.subscribe({
            onData: (data) => chunks.push(data),
            onError: (err) => error = err,
            onComplete: () => isComplete = true
        });

        try {
            // Wait for data to arrive and yield it
            while (!isComplete && !error) {
                if (chunks.length > 0) {
                    yield chunks.shift()!;
                } else {
                    // Wait a bit for more data
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            // Yield any remaining chunks
            while (chunks.length > 0) {
                yield chunks.shift()!;
            }

            if (error) {
                throw error;
            }
        } finally {
            unsubscribe();
        }
    }

    private async startConsuming() {
        if (this.isConsuming) return;
        this.isConsuming = true;

        try {
            const stream = await this.streamSource();

            let chunkCount = 0;
            try {
                for await (const data of stream) {
                    chunkCount++;

                    // Cache the data
                    this.cachedData.push(data);

                    // Broadcast to all subscribers
                    for (const subscriber of this.subscribers) {
                        try {
                            subscriber.onData(data);
                        } catch (error) {
                            console.warn(`[StreamProxy] Subscriber error:`, error);
                        }
                    }
                }
            } catch (iterationError) {
                throw iterationError;
            }

            this.isCompleted = true;

            // Notify all subscribers of completion
            for (const subscriber of this.subscribers) {
                try {
                    subscriber.onComplete();
                } catch (error) {
                    console.warn(`[StreamProxy] Subscriber completion error:`, error);
                }
            }

        } catch (error) {
            this.error = error instanceof Error ? error : new Error(String(error));
            this.isCompleted = true;

            // Notify all subscribers of error
            for (const subscriber of this.subscribers) {
                try {
                    subscriber.onError(this.error);
                } catch (subscriberError) {
                    console.warn(`[StreamProxy] Subscriber error notification failed:`, subscriberError);
                }
            }
        }
    }
}

/**
 * Create a StreamProxy for AI SDK streamObject results
 * This works around the AI SDK bug where partialObjectStream is immediately locked
 */
export function createStreamObjectProxy<T>(streamObjectResult: any): StreamProxy<T> {
    return new StreamProxy<T>(async () => {
        // Access the baseStream directly before it gets locked
        const baseStream = streamObjectResult.baseStream;

        if (!baseStream) {
            throw new Error('No baseStream found in streamObjectResult');
        }

        // Create an async generator that processes the base stream
        async function* processBaseStream(): AsyncGenerator<T, void, unknown> {
            let currentObject: any = {};

            try {
                for await (const chunk of baseStream) {
                    // Handle different types of chunks from the base stream
                    if (chunk.type === 'object-delta') {
                        // Merge the delta into the current object
                        Object.assign(currentObject, chunk.object);
                        yield currentObject as T;
                    } else if (chunk.type === 'object') {
                        // Complete object - use it directly
                        currentObject = chunk.object;
                        yield currentObject as T;
                    } else if (chunk.type === 'finish') {
                        break;
                    } else if (chunk.type === 'error') {
                        throw chunk.error;
                    }
                }
            } catch (error) {
                throw error;
            }
        }

        return processBaseStream();
    });
} 