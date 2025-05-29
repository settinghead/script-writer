import { useEffect, useState, useRef, useCallback } from 'react';
import { Subscription } from 'rxjs';
import { LLMStreamingService } from '../services/streaming/LLMStreamingService';
import { StreamingRequest, StreamingResponse } from '../../common/streaming/types';

export function useLLMStreaming<T>(
    ServiceClass: new (config: any) => LLMStreamingService<T>,
    config: any = {},
    transformId?: string
) {
    const [response, setResponse] = useState<StreamingResponse<T>>({
        status: 'idle',
        items: [],
        rawContent: ''
    });

    const serviceRef = useRef<LLMStreamingService<T>>();
    const subscriptionRef = useRef<Subscription>();

    useEffect(() => {
        // Create service instance
        serviceRef.current = new ServiceClass(config);

        // Subscribe to response stream
        subscriptionRef.current = serviceRef.current.response$.subscribe({
            next: (res) => {
                setResponse(res);
            },
            error: (err) => {
                console.error('[useLLMStreaming] Error:', err);
                setResponse({
                    status: 'error',
                    items: [],
                    rawContent: '',
                    error: err
                });
            }
        });

        // If transformId is provided, connect to it immediately
        if (transformId && serviceRef.current) {
            serviceRef.current.connectToTransform(transformId);
        }

        return () => {
            subscriptionRef.current?.unsubscribe();
            serviceRef.current?.stop();
        };
    }, [transformId]);

    const start = useCallback(async (request: StreamingRequest) => {
        if (serviceRef.current) {
            await serviceRef.current.start(request);
        }
    }, []);

    const stop = useCallback(() => {
        serviceRef.current?.stop();
    }, []);

    return {
        status: response.status,
        items: response.items,
        error: response.error,
        start,
        stop
    };
} 