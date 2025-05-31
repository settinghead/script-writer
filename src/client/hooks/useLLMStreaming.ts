import { useEffect, useRef } from 'react';
import { useObservableState } from './useObservableState';
import { StreamingResponse } from '../../common/streaming/types';
import { LLMStreamingService } from '../services/streaming/LLMStreamingService';

export function useLLMStreaming<T>(
    service: LLMStreamingService<T> | undefined,
    config: {
        transformId?: string;
    } = {}
) {
    const { transformId } = config;
    const currentTransformIdRef = useRef<string | undefined>();

    console.log(`[useLLMStreaming] Hook initialized with transformId: ${transformId}`);

    // Subscribe to the response stream
    const response = useObservableState<StreamingResponse<T>>(
        service?.response$,
        {
            status: 'idle',
            items: [],
            rawContent: ''
        }
    );

    // Debug log response changes
    useEffect(() => {
        console.log(`[useLLMStreaming] Response state changed:`, {
            status: response.status,
            itemCount: response.items.length,
            hasError: !!response.error,
            errorMessage: response.error?.message,
            transformId: transformId
        });
    }, [response.status, response.items.length, response.error, transformId]);

    // Handle errors by converting them to a status
    useEffect(() => {
        if (!service) {
            console.log(`[useLLMStreaming] No service provided`);
            return;
        }

        console.log(`[useLLMStreaming] Setting up error subscription`);
        const subscription = service.response$.subscribe({
            error: (err) => {
                console.error(`[useLLMStreaming] Response stream error:`, err);
            }
        });

        return () => {
            console.log(`[useLLMStreaming] Cleaning up error subscription`);
            subscription.unsubscribe();
        };
    }, [service]);

    // Auto-connect when transformId changes
    useEffect(() => {
        console.log(`[useLLMStreaming] Auto-connect effect triggered:`, {
            hasService: !!service,
            transformId,
            currentTransformId: currentTransformIdRef.current,
            shouldConnect: !!(service && transformId && transformId !== currentTransformIdRef.current)
        });

        if (!service || !transformId || transformId === currentTransformIdRef.current) {
            return;
        }

        currentTransformIdRef.current = transformId;
        console.log(`[useLLMStreaming] Connecting to transform ${transformId}`);

        // Connect to the transform stream
        service.connectToTransform(transformId).catch((error) => {
            console.error(`[useLLMStreaming] Connection error:`, error);
        });

        return () => {
            if (currentTransformIdRef.current === transformId) {
                console.log(`[useLLMStreaming] Cleaning up connection for transform ${transformId}`);
                currentTransformIdRef.current = undefined;
            }
        };
    }, [transformId, service]);

    return {
        ...response,
        stop: () => {
            console.log(`[useLLMStreaming] Stop called for transform ${transformId}`);
            service?.stop();
        }
    };
} 