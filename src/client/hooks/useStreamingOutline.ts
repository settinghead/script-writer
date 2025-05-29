import { useMemo } from 'react';
import { useLLMStreaming } from './useLLMStreaming';
import { OutlineStreamingService } from '../services/implementations/OutlineStreamingService';

export function useStreamingOutline(transformId?: string) {
    const service = useMemo(() => {
        return new OutlineStreamingService({
            debounceMs: 16, // Smooth streaming at ~60fps
            completionTimeoutMs: 2000
        });
    }, []);

    return useLLMStreaming(service, { transformId });
} 