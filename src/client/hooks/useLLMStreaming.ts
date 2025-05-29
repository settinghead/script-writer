import { useEffect, useRef } from 'react';
import { useObservableState } from './useObservableState';
import { StreamingResponse } from '../../common/streaming/types';
import { LLMStreamingService } from '../services/streaming/LLMStreamingService';

export function useLLMStreaming<T>(
    service: LLMStreamingService<T>,
    config: {
        transformId?: string;
    } = {}
) {
    const { transformId } = config;
    const currentTransformIdRef = useRef<string | undefined>();

    // Subscribe to the response stream
    const response = useObservableState<StreamingResponse<T>>(
        service.response$,
        {
            status: 'idle',
            items: [],
            rawContent: ''
        }
    );

    // Handle errors by converting them to a status
    useEffect(() => {
        const subscription = service.response$.subscribe({
            error: (err) => {
                // Error already handled in response stream
            }
        });

        return () => subscription.unsubscribe();
    }, [service]);

    // Auto-connect when transformId changes
    useEffect(() => {
        if (transformId && transformId !== currentTransformIdRef.current) {
            currentTransformIdRef.current = transformId;

            // Connect to the transform stream
            service.connectToTransform(transformId).catch((error) => {
                // Error handled in service
            });
        }

        return () => {
            if (currentTransformIdRef.current === transformId) {
                currentTransformIdRef.current = undefined;
            }
        };
    }, [transformId, service]);

    return {
        ...response,
        stop: () => service.stop()
    };
} 