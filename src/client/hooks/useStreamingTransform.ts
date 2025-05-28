import { useState, useCallback, useRef } from 'react';

export interface StreamingUpdate {
    type: 'partial_json' | 'complete' | 'error' | 'progress' | 'final_result';
    data?: any;
    rawContent?: string;
    parsedContent?: any;
    error?: string;
    progress?: {
        stage: string;
        percentage?: number;
    };
    transformId?: string;
    artifactIds?: string[];
    outlineSessionId?: string;
}

export interface UseStreamingTransformOptions {
    onUpdate?: (update: StreamingUpdate) => void;
    onComplete?: (result: StreamingUpdate) => void;
    onError?: (error: string) => void;
}

export function useStreamingTransform(options: UseStreamingTransformOptions = {}) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentUpdate, setCurrentUpdate] = useState<StreamingUpdate | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ stage: string; percentage?: number } | null>(null);
    const [displayData, setDisplayData] = useState<any>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const startStreaming = useCallback(async (
        endpoint: string,
        requestBody: any,
        method: string = 'POST'
    ) => {
        if (isStreaming) {
            console.warn('Already streaming, ignoring new request');
            return;
        }

        setIsStreaming(true);
        setError(null);
        setProgress(null);
        setDisplayData(null);
        setCurrentUpdate(null);

        try {
            // Create abort controller for cleanup
            abortControllerRef.current = new AbortController();

            // Make the initial request to start streaming
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Set up EventSource to receive streaming updates
            const eventSource = new EventSource(endpoint, {
                withCredentials: true
            });
            eventSourceRef.current = eventSource;

            eventSource.onmessage = (event) => {
                try {
                    const update: StreamingUpdate = JSON.parse(event.data);
                    setCurrentUpdate(update);

                    // Handle different update types
                    switch (update.type) {
                        case 'progress':
                            setProgress(update.progress || null);
                            break;

                        case 'partial_json':
                            if (update.data) {
                                setDisplayData(update.data);
                            }
                            break;

                        case 'complete':
                            if (update.data) {
                                setDisplayData(update.data);
                            }
                            setProgress(null);
                            break;

                        case 'final_result':
                            setIsStreaming(false);
                            setProgress(null);
                            if (options.onComplete) {
                                options.onComplete(update);
                            }
                            break;

                        case 'error':
                            setError(update.error || 'Unknown error occurred');
                            setIsStreaming(false);
                            setProgress(null);
                            if (options.onError) {
                                options.onError(update.error || 'Unknown error occurred');
                            }
                            break;
                    }

                    // Call the general update callback
                    if (options.onUpdate) {
                        options.onUpdate(update);
                    }

                } catch (parseError) {
                    console.error('Error parsing streaming update:', parseError);
                    setError('Error parsing server response');
                }
            };

            eventSource.onerror = (event) => {
                console.error('EventSource error:', event);
                setError('Connection error occurred');
                setIsStreaming(false);
                setProgress(null);
                if (options.onError) {
                    options.onError('Connection error occurred');
                }
            };

        } catch (fetchError) {
            console.error('Error starting streaming:', fetchError);
            const errorMessage = fetchError instanceof Error ? fetchError.message : 'Failed to start streaming';
            setError(errorMessage);
            setIsStreaming(false);
            setProgress(null);
            if (options.onError) {
                options.onError(errorMessage);
            }
        }
    }, [isStreaming, options]);

    const stopStreaming = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        setIsStreaming(false);
        setProgress(null);
    }, []);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        stopStreaming();
    }, [stopStreaming]);

    return {
        isStreaming,
        currentUpdate,
        error,
        progress,
        displayData,
        startStreaming,
        stopStreaming,
        cleanup
    };
} 