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
    const currentTransformIdRef = useRef<string | undefined>();
    const ServiceClassRef = useRef(ServiceClass);
    const configRef = useRef(config);

    // Update refs when props change
    ServiceClassRef.current = ServiceClass;
    configRef.current = config;

    // Initialize service only once
    useEffect(() => {
        if (!serviceRef.current) {
            serviceRef.current = new ServiceClassRef.current(configRef.current);

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
        }

        // Cleanup only on unmount
        return () => {
            subscriptionRef.current?.unsubscribe();
            serviceRef.current?.stop();
            serviceRef.current = undefined;
            currentTransformIdRef.current = undefined;
        };
    }, []); // Empty deps - only run once

    // Handle transform ID changes separately
    useEffect(() => {
        if (transformId && transformId !== currentTransformIdRef.current && serviceRef.current) {
            currentTransformIdRef.current = transformId;
            serviceRef.current.connectToTransform(transformId);
        }
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