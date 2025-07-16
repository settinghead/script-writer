import { useState, useEffect, useRef, useCallback } from 'react';
import { debugParamsStorage, type AgentContextParams as StorageAgentContextParams } from '../services/debugParamsStorage';

export interface AgentContextParams {
    userInput: string;
    projectId: string;
}

export function useAgentContextParams(projectId: string) {
    const [params, setParams] = useState<AgentContextParams>({
        userInput: '',
        projectId
    });
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [autoSave, setAutoSave] = useState(true);

    // Use refs to track the last saved state to prevent unnecessary saves
    const lastSavedParamsRef = useRef<AgentContextParams | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debug logging
    const debugLog = useCallback((message: string, data?: any) => {
        console.log(`[useAgentContextParams] ${message}`, data);
    }, []);

    debugLog('Hook render:', {
        projectId,
        userInputLength: params.userInput.length,
        isLoading,
        hasError,
        autoSave,
        lastSavedExists: !!lastSavedParamsRef.current
    });

    // Load params on mount
    useEffect(() => {
        const loadParams = async () => {
            try {
                setIsLoading(true);
                const loaded = await debugParamsStorage.loadAgentContextParams(projectId);
                if (loaded) {
                    debugLog('Loaded params:', loaded);
                    const loadedParams: AgentContextParams = { userInput: loaded.userInput, projectId };
                    setParams(loadedParams);
                    lastSavedParamsRef.current = loadedParams;
                } else {
                    // Initialize with current projectId if no saved params
                    const initialParams: AgentContextParams = { userInput: '', projectId };
                    setParams(initialParams);
                    lastSavedParamsRef.current = initialParams;
                }
            } catch (error) {
                debugLog('Error loading params:', error);
                setHasError(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadParams();
    }, [projectId, debugLog]);

    // Update userInput function
    const updateUserInput = useCallback((newInput: string) => {
        debugLog('Updating user input:', { newInput: newInput.length });
        setParams(prev => ({ ...prev, userInput: newInput }));
    }, [debugLog]);

    // Check if params have actually changed since last save
    const hasParamsChanged = useCallback((currentParams: AgentContextParams) => {
        if (!lastSavedParamsRef.current) return true;
        return (
            currentParams.userInput !== lastSavedParamsRef.current.userInput ||
            currentParams.projectId !== lastSavedParamsRef.current.projectId
        );
    }, []);

    // Auto-save effect with debouncing and change detection
    useEffect(() => {
        if (!autoSave) return;

        const hasParams = params.userInput.trim().length > 0;
        const hasChanged = hasParamsChanged(params);

        debugLog('Auto-save effect triggered:', {
            autoSave,
            hasParams,
            hasChanged,
            projectId: params.projectId,
            inputLength: params.userInput.length
        });

        // Only save if there are actual changes
        if (hasParams && hasChanged) {
            // Clear any existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Set new timeout
            saveTimeoutRef.current = setTimeout(async () => {
                try {
                    debugLog('Executing auto-save');
                    await debugParamsStorage.saveAgentContextParams(params.projectId, { userInput: params.userInput });
                    lastSavedParamsRef.current = { ...params };
                    debugLog('Auto-save completed');
                } catch (error) {
                    debugLog('Auto-save error:', error);
                    setHasError(true);
                }
            }, 1000);
        }

        // Cleanup function
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [params, autoSave, hasParamsChanged, debugLog]);

    // Manual save function
    const saveParams = useCallback(async () => {
        if (!params.userInput.trim()) return;

        try {
            setIsLoading(true);
            await debugParamsStorage.saveAgentContextParams(params.projectId, { userInput: params.userInput });
            lastSavedParamsRef.current = { ...params };
            debugLog('Manual save completed');
        } catch (error) {
            debugLog('Manual save error:', error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, [params, debugLog]);

    // Reload function
    const reloadParams = useCallback(async () => {
        try {
            setIsLoading(true);
            const loaded = await debugParamsStorage.loadAgentContextParams(projectId);
            if (loaded) {
                const loadedParams: AgentContextParams = { userInput: loaded.userInput, projectId };
                setParams(loadedParams);
                lastSavedParamsRef.current = loadedParams;
                debugLog('Reload completed');
            }
        } catch (error) {
            debugLog('Reload error:', error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, [projectId, debugLog]);

    // Clear function
    const clearParams = useCallback(async () => {
        try {
            setIsLoading(true);
            await debugParamsStorage.clearAgentContextParams(projectId);
            const clearedParams: AgentContextParams = { userInput: '', projectId };
            setParams(clearedParams);
            lastSavedParamsRef.current = clearedParams;
            debugLog('Clear completed');
        } catch (error) {
            debugLog('Clear error:', error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, [projectId, debugLog]);

    return {
        params,
        updateUserInput,
        isLoading,
        hasError,
        autoSave,
        setAutoSave,
        saveParams,
        reloadParams,
        clearParams
    };
} 