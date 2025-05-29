import { useMemo } from 'react';
import { useLLMStreaming } from './useLLMStreaming';
import { BrainstormingStreamingService } from '../services/implementations/BrainstormingStreamingService';

export function useStreamingBrainstorm(transformId?: string) {
    const config = useMemo(() => ({
        debounceMs: 50,
        completionTimeoutMs: 2000
    }), []);

    return useLLMStreaming(BrainstormingStreamingService, config, transformId);
} 