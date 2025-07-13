import { useState, useEffect, useCallback } from 'react';
import { debugParamsStorage, type DebugParams } from '../services/debugParamsStorage';
import { useDebounce } from './useDebounce';

interface UseDebugParamsOptions {
    projectId: string;
    autoSave?: boolean;
    debounceMs?: number;
}

interface UseDebugParamsReturn {
    selectedTool: string;
    selectedJsondocs: string[];
    additionalParams: string;
    setSelectedTool: (tool: string) => void;
    setSelectedJsondocs: (jsondocs: string[]) => void;
    setAdditionalParams: (params: string) => void;
    saveParams: () => Promise<void>;
    loadParams: () => Promise<void>;
    clearParams: () => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export function useDebugParams({
    projectId,
    autoSave = true,
    debounceMs = 1000
}: UseDebugParamsOptions): UseDebugParamsReturn {
    const [selectedTool, setSelectedTool] = useState<string>('');
    const [selectedJsondocs, setSelectedJsondocs] = useState<string[]>([]);
    const [additionalParams, setAdditionalParams] = useState<string>('{}');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Create a params object for debouncing
    const currentParams = {
        selectedTool,
        selectedJsondocs,
        additionalParams
    };

    // Debounced params for auto-save
    const debouncedParams = useDebounce(currentParams, debounceMs);

    // Load params from IndexedDB on mount
    const loadParams = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const savedParams = await debugParamsStorage.loadParams(projectId);

            if (savedParams) {
                setSelectedTool(savedParams.selectedTool || '');
                setSelectedJsondocs(savedParams.selectedJsondocs || []);
                setAdditionalParams(savedParams.additionalParams || '{}');
            }
        } catch (err) {
            console.error('Failed to load debug params:', err);
            setError(err instanceof Error ? err.message : 'Failed to load parameters');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    // Save params to IndexedDB
    const saveParams = useCallback(async () => {
        try {
            setError(null);

            await debugParamsStorage.saveParams(projectId, {
                selectedTool,
                selectedJsondocs,
                additionalParams
            });
        } catch (err) {
            console.error('Failed to save debug params:', err);
            setError(err instanceof Error ? err.message : 'Failed to save parameters');
        }
    }, [projectId, selectedTool, selectedJsondocs, additionalParams]);

    // Clear params from IndexedDB
    const clearParams = useCallback(async () => {
        try {
            setError(null);

            await debugParamsStorage.clearParams(projectId);
            setSelectedTool('');
            setSelectedJsondocs([]);
            setAdditionalParams('{}');
        } catch (err) {
            console.error('Failed to clear debug params:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear parameters');
        }
    }, [projectId]);

    // Load params on mount
    useEffect(() => {
        loadParams();
    }, [loadParams]);

    // Auto-save when params change (debounced)
    useEffect(() => {
        if (autoSave && debouncedParams && projectId) {
            // Only save if we have meaningful data (not just defaults)
            if (debouncedParams.selectedTool ||
                debouncedParams.selectedJsondocs.length > 0 ||
                debouncedParams.additionalParams !== '{}') {
                saveParams();
            }
        }
    }, [debouncedParams, autoSave, projectId, saveParams]);

    // Cleanup old params periodically (once per session)
    useEffect(() => {
        const cleanup = async () => {
            try {
                await debugParamsStorage.cleanupOldParams();
            } catch (err) {
                console.warn('Failed to cleanup old debug params:', err);
            }
        };

        // Run cleanup once when the hook is first used
        cleanup();
    }, []);

    return {
        selectedTool,
        selectedJsondocs,
        additionalParams,
        setSelectedTool,
        setSelectedJsondocs,
        setAdditionalParams,
        saveParams,
        loadParams,
        clearParams,
        isLoading,
        error
    };
} 