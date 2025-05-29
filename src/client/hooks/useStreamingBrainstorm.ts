import { useLLMStreaming } from './useLLMStreaming';
import { BrainstormingStreamingService } from '../services/implementations/BrainstormingStreamingService';

export function useStreamingBrainstorm() {
    return useLLMStreaming(BrainstormingStreamingService, {
        debounceMs: 50,
        completionTimeoutMs: 2000
    });
} 