import { useState, useCallback } from 'react';

export interface ReasoningState {
    isReasoning: boolean;
    phase?: 'brainstorming' | 'outline' | 'synopsis' | 'script';
    startTime?: number;
    message?: string;
}

export interface ReasoningEvent {
    type: 'reasoning_start' | 'reasoning_end';
    phase: 'brainstorming' | 'outline' | 'synopsis' | 'script';
    timestamp: number;
    modelName?: string;
    message?: string;
}

export const useReasoningState = () => {
    const [reasoningState, setReasoningState] = useState<ReasoningState>({
        isReasoning: false
    });

    const handleReasoningEvent = useCallback((event: ReasoningEvent) => {
        if (event.type === 'reasoning_start') {
            setReasoningState({
                isReasoning: true,
                phase: event.phase,
                startTime: event.timestamp,
                message: event.message
            });
        } else if (event.type === 'reasoning_end') {
            setReasoningState(prev => ({
                ...prev,
                isReasoning: false
            }));
        }
    }, []);

    const startReasoning = useCallback((
        phase: 'brainstorming' | 'outline' | 'synopsis' | 'script',
        message?: string
    ) => {
        setReasoningState({
            isReasoning: true,
            phase,
            startTime: Date.now(),
            message
        });
    }, []);

    const stopReasoning = useCallback(() => {
        setReasoningState(prev => ({
            ...prev,
            isReasoning: false
        }));
    }, []);

    const resetReasoning = useCallback(() => {
        setReasoningState({
            isReasoning: false
        });
    }, []);

    return {
        reasoningState,
        handleReasoningEvent,
        startReasoning,
        stopReasoning,
        resetReasoning
    };
};

export default useReasoningState; 