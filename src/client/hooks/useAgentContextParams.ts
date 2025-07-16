import { useState, useEffect, useCallback } from 'react';
import { debugParamsStorage, type AgentContextParams } from '../services/debugParamsStorage';
import { useDebounce } from './useDebounce';

interface UseAgentContextParamsOptions {
    projectId: string;
    autoSave?: boolean;
    debounceMs?: number;
}

interface UseAgentContextParamsReturn {
    userInput: string;
    setUserInput: (input: string) => void;
    saveParams: () => Promise<void>;
    loadParams: () => Promise<void>;
    clearParams: () => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export function useAgentContextParams({
    projectId,
    autoSave = true,
    debounceMs = 1000
}: UseAgentContextParamsOptions): UseAgentContextParamsReturn {
    const [userInput, setUserInput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Debug logging
    console.log('[useAgentContextParams] Hook render:', {
        projectId,
        userInputLength: userInput?.length || 0,
        isLoading,
        hasError: !!error,
        autoSave,
        debounceMs
    });

    // Create a params object for debouncing
    const currentParams = {
        userInput
    };

    // Debounced params for auto-save
    const debouncedParams = useDebounce(currentParams, debounceMs);

    // Load params from IndexedDB on mount
    const loadParams = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const savedParams = await debugParamsStorage.loadAgentContextParams(projectId);

            if (savedParams) {
                setUserInput(savedParams.userInput || '');
            }
        } catch (err) {
            console.error('Failed to load agent context params:', err);
            setError(err instanceof Error ? err.message : 'Failed to load parameters');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    // Save params to IndexedDB
    const saveParams = useCallback(async () => {
        try {
            setError(null);

            await debugParamsStorage.saveAgentContextParams(projectId, {
                userInput
            });
        } catch (err) {
            console.error('Failed to save agent context params:', err);
            setError(err instanceof Error ? err.message : 'Failed to save parameters');
        }
    }, [projectId, userInput]);

    // Clear params from IndexedDB
    const clearParams = useCallback(async () => {
        try {
            setError(null);

            await debugParamsStorage.clearAgentContextParams(projectId);
            setUserInput('');
        } catch (err) {
            console.error('Failed to clear agent context params:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear parameters');
        }
    }, [projectId]);

    // Load params on mount
    useEffect(() => {
        loadParams();
    }, [loadParams]);

    // Auto-save when params change (debounced)
    useEffect(() => {
        console.log('[useAgentContextParams] Auto-save effect triggered:', {
            autoSave,
            hasParams: !!debouncedParams,
            projectId,
            inputLength: debouncedParams?.userInput?.length || 0
        });

        if (autoSave && debouncedParams && projectId) {
            // Only save if we have meaningful data (not empty string)
            if (debouncedParams.userInput.trim()) {
                console.log('[useAgentContextParams] Triggering auto-save');
                saveParams();
            }
        }
    }, [debouncedParams, autoSave, projectId, saveParams]);

    return {
        userInput,
        setUserInput,
        saveParams,
        loadParams,
        clearParams,
        isLoading,
        error
    };
} 