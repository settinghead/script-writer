import { useState, useCallback, useRef } from 'react';

export interface StreamingStatus {
    isStreaming: boolean;
    streamedContent: string;
    fullContent: string;
    progress?: {
        tokens: number;
        message: string;
    };
    error?: Error;
    isComplete: boolean;
    outlineSessionId?: string;
    artifacts?: Array<{
        id: string;
        type: string;
        data: any;
    }>;
}

export interface StreamingData {
    type: 'status' | 'content' | 'progress' | 'complete' | 'error';
    message?: string;
    content?: string;
    accumulated?: string;
    tokens?: number;
    transformId?: string;
    outlineSessionId?: string;
    artifacts?: Array<{
        id: string;
        type: string;
        data: any;
    }>;
}

export function useStreamingLLM() {
    const [status, setStatus] = useState<StreamingStatus>({
        isStreaming: false,
        streamedContent: '',
        fullContent: '',
        isComplete: false
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const startStreaming = useCallback(async (
        endpoint: string,
        options: {
            method?: string;
            headers?: Record<string, string>;
            body?: any;
        } = {}
    ) => {
        // Reset state
        setStatus({
            isStreaming: true,
            streamedContent: '',
            fullContent: '',
            isComplete: false,
            error: undefined,
            artifacts: undefined
        });

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(endpoint, {
                method: options.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let accumulatedContent = '';

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
                        // Parse streaming data format from AI SDK
                        let data: StreamingData;

                        // Handle AI SDK data stream format
                        if (line.startsWith('0:')) {
                            // Text chunk
                            const textData = JSON.parse(line.substring(2));
                            if (typeof textData === 'string') {
                                accumulatedContent += textData;
                                setStatus(prev => ({
                                    ...prev,
                                    streamedContent: textData,
                                    fullContent: accumulatedContent
                                }));
                            }
                        } else if (line.startsWith('2:[')) {
                            // Data annotation
                            const dataArray = JSON.parse(line.substring(2));
                            if (Array.isArray(dataArray) && dataArray.length > 0) {
                                data = dataArray[0] as StreamingData;

                                switch (data.type) {
                                    case 'status':
                                        setStatus(prev => ({
                                            ...prev,
                                            progress: { tokens: 0, message: data.message || 'Processing...' }
                                        }));
                                        break;

                                    case 'progress':
                                        setStatus(prev => ({
                                            ...prev,
                                            progress: {
                                                tokens: data.tokens || 0,
                                                message: data.message || 'Generating...'
                                            }
                                        }));
                                        break;

                                    case 'complete':
                                        setStatus(prev => ({
                                            ...prev,
                                            isStreaming: false,
                                            isComplete: true,
                                            artifacts: data.artifacts,
                                            outlineSessionId: data.outlineSessionId,
                                            progress: { tokens: 0, message: data.message || 'Complete!' }
                                        }));
                                        break;

                                    case 'error':
                                        throw new Error(data.message || 'Streaming error');
                                }
                            }
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse streaming data:', line, parseError);
                    }
                }
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                setStatus(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: new Error('Streaming cancelled')
                }));
            } else {
                setStatus(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: error instanceof Error ? error : new Error(String(error))
                }));
            }
        }
    }, []);

    const cancelStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    const reset = useCallback(() => {
        setStatus({
            isStreaming: false,
            streamedContent: '',
            fullContent: '',
            isComplete: false
        });
    }, []);

    return {
        status,
        startStreaming,
        cancelStreaming,
        reset
    };
} 