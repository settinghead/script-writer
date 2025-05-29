import { useState, useEffect, useCallback } from 'react';
import { LLMStreamingService } from '../services/streaming/LLMStreamingService';
import { StreamConfig, StreamingRequest, StreamingResponse } from '../../common/streaming/types';

export function useLLMStreaming<T>(
    ServiceClass: new (config?: StreamConfig) => LLMStreamingService<T>,
    config?: StreamConfig
) {
    const [service] = useState(() => new ServiceClass(config));
    const [response, setResponse] = useState<StreamingResponse<T>>({
        status: 'idle',
        items: []
    });

    useEffect(() => {
        console.log('Setting up streaming service subscription');
        const subscription = service.response$.subscribe({
            next: (response) => {
                console.log('Received streaming response:', response);
                setResponse(response);
            },
            error: (error) => {
                console.error('Streaming subscription error:', error);
            }
        });
        return () => {
            console.log('Cleaning up streaming subscription');
            subscription.unsubscribe();
        };
    }, [service]);

    const start = useCallback(async (request: StreamingRequest) => {
        console.log('Starting streaming request:', request);
        await service.start(request);
    }, [service]);

    const stop = useCallback(() => {
        service.stop();
    }, [service]);

    return {
        ...response,
        start,
        stop
    };
} 