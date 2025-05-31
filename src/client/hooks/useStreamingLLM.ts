import { useCallback, useRef, useState } from 'react';
import { StreamingRequest, StreamingResponse } from '../../common/streaming/types';
import { cleanLLMContent } from '../../common/utils/textCleaning';

interface UseStreamingLLMConfig {
    debounceMs?: number;
    completionTimeoutMs?: number;
}

export function useStreamingLLM<T>(
    config: UseStreamingLLMConfig = {}
) {
    const [response, setResponse] = useState<StreamingResponse<T>>({
        status: 'idle',
        items: [],
        rawContent: ''
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const parsePartial = useCallback((content: string): T[] => {
        if (!content.trim()) return [];

        try {
            // Try to parse as complete JSON first
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            // Try to extract partial JSON array
            try {
                // Find the last complete JSON object
                const trimmed = content.trim();
                if (trimmed.startsWith('[')) {
                    // Find all complete objects in the array
                    const objects: T[] = [];
                    let depth = 0;
                    let start = -1;
                    let inString = false;
                    let escaped = false;

                    for (let i = 0; i < trimmed.length; i++) {
                        const char = trimmed[i];

                        if (escaped) {
                            escaped = false;
                            continue;
                        }

                        if (char === '\\') {
                            escaped = true;
                            continue;
                        }

                        if (char === '"' && !escaped) {
                            inString = !inString;
                            continue;
                        }

                        if (inString) continue;

                        if (char === '{') {
                            if (depth === 0) start = i;
                            depth++;
                        } else if (char === '}') {
                            depth--;
                            if (depth === 0 && start >= 0) {
                                try {
                                    const objStr = trimmed.substring(start, i + 1);
                                    const obj = JSON.parse(objStr);
                                    objects.push(obj);
                                } catch {
                                    // Skip invalid object
                                }
                                start = -1;
                            }
                        }
                    }

                    return objects;
                }
            } catch {
                // Fallback parsing failed
            }
        }

        return [];
    }, []);

    const cleanContent = useCallback((content: string): string => {
        return cleanLLMContent(content);
    }, []);

    const start = useCallback(async (request: StreamingRequest): Promise<void> => {
        // Reset state
        setResponse({
            status: 'streaming',
            items: [],
            rawContent: ''
        });

        // Cancel any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch('/api/streaming/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
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

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.trim() === '') continue;

                        try {
                            // Handle AI SDK streaming format
                            if (line.startsWith('0:')) {
                                // Text chunk
                                const textData = JSON.parse(line.substring(2));
                                if (typeof textData === 'string') {
                                    accumulatedContent += textData;

                                    const cleanedContent = cleanContent(accumulatedContent);
                                    const items = parsePartial(cleanedContent);

                                    setResponse({
                                        status: 'streaming',
                                        items,
                                        rawContent: accumulatedContent
                                    });
                                }
                            } else if (line.startsWith('e:') || line.startsWith('d:')) {
                                // Completion
                                const cleanedContent = cleanContent(accumulatedContent);
                                const items = parsePartial(cleanedContent);

                                setResponse({
                                    status: 'completed',
                                    items,
                                    rawContent: accumulatedContent
                                });
                            }
                        } catch (parseError) {
                            // Skip invalid lines
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                setResponse({
                    status: 'error',
                    items: [],
                    rawContent: '',
                    error
                });
            }
        }
    }, [parsePartial, cleanContent]);

    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    return {
        ...response,
        start,
        stop
    };
} 