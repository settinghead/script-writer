import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';

export interface UseJsondocEditorOptions {
    jsondocId: string;
    debounceMs?: number;
    onSaveSuccess?: () => void;
    onSaveError?: (error: Error) => void;
}

export interface UseJsondocEditorReturn {
    // State
    pendingSaves: Set<string>;
    editingField: string | null;

    // Handlers
    handleFieldChange: (field: string, value: any) => void;
    handleBatchFieldChange: (updates: Record<string, any>) => void;
    setEditingField: (field: string | null) => void;

    // Status
    isPending: boolean;
    isSuccess: boolean;
    hasUnsavedChanges: boolean;
}

export const useJsondocEditor = (options: UseJsondocEditorOptions): UseJsondocEditorReturn => {
    const { jsondocId, debounceMs = 1000, onSaveSuccess, onSaveError } = options;

    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
    const [editingField, setEditingField] = useState<string | null>(null);

    const projectData = useProjectData();

    // Use refs to avoid stale closures
    const onSaveSuccessRef = useRef(onSaveSuccess);
    const onSaveErrorRef = useRef(onSaveError);

    useEffect(() => {
        onSaveSuccessRef.current = onSaveSuccess;
        onSaveErrorRef.current = onSaveError;
    }, [onSaveSuccess, onSaveError]);

    // Get mutation state for this jsondoc
    const mutationState = projectData.mutationStates.jsondocs.get(jsondocId);
    const isPending = mutationState?.status === 'pending';
    const isSuccess = mutationState?.status === 'success';

    // Updated debounced save function to accept prepared request data
    const debouncedSave = useCallback(
        (() => {
            let timeoutId: NodeJS.Timeout;

            return (field: string, requestData: any) => {
                clearTimeout(timeoutId);

                timeoutId = setTimeout(() => {
                    setPendingSaves(prev => new Set(prev).add(field));

                    projectData.updateJsondoc.mutate({
                        jsondocId,
                        data: requestData
                    }, {
                        onSuccess: () => {
                            setPendingSaves(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(field);
                                return newSet;
                            });
                            onSaveSuccessRef.current?.();
                        },
                        onError: (error) => {
                            setPendingSaves(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(field);
                                return newSet;
                            });
                            const errorMessage = error instanceof Error ? error.message : 'Save failed';
                            message.error(`保存失败: ${errorMessage}`);
                            onSaveErrorRef.current?.(error instanceof Error ? error : new Error(errorMessage));
                        }
                    });
                }, debounceMs);
            };
        })(),
        [jsondocId, debounceMs, projectData]
    );

    const handleFieldChange = useCallback((field: string, value: any) => {
        // Get current jsondoc data
        const jsondoc = projectData.getJsondocById(jsondocId);
        if (!jsondoc) {
            onSaveErrorRef.current?.(new Error('Jsondoc not found'));
            return;
        }

        // Parse current data
        let currentData;
        try {
            currentData = typeof jsondoc.data === 'string'
                ? JSON.parse(jsondoc.data)
                : jsondoc.data;
        } catch (error) {
            console.error('Failed to parse jsondoc data:', error);
            currentData = {};
        }

        // Prepare the updated data
        const updatedData = { ...currentData, [field]: value };

        // Prepare request based on jsondoc type to match backend expectations
        // Backend expects: { text: "..." } for user_input, { data: rawObject } for others
        let requestData;
        if (jsondoc.schema_type === 'user_input') {
            requestData = { text: JSON.stringify(updatedData) };
        } else {
            // For non-user_input jsondocs (like brainstorm_idea), send the raw data directly
            // The apiService will wrap it in { data: ... }, so the backend gets { data: rawObject }
            requestData = updatedData;
        }

        // Trigger debounced save
        debouncedSave(field, requestData);
    }, [jsondocId, debouncedSave, projectData]);

    const handleBatchFieldChange = useCallback((updates: Record<string, any>) => {
        // Get current jsondoc data
        const jsondoc = projectData.getJsondocById(jsondocId);
        if (!jsondoc) {
            onSaveErrorRef.current?.(new Error('Jsondoc not found'));
            return;
        }

        // Parse current data
        let currentData;
        try {
            currentData = typeof jsondoc.data === 'string'
                ? JSON.parse(jsondoc.data)
                : jsondoc.data;
        } catch (error) {
            console.error('Failed to parse jsondoc data:', error);
            currentData = {};
        }

        // Prepare the updated data with all batch changes
        const updatedData = { ...currentData, ...updates };

        // Prepare request based on jsondoc type to match backend expectations
        let requestData;
        if (jsondoc.schema_type === 'user_input') {
            requestData = { text: JSON.stringify(updatedData) };
        } else {
            requestData = updatedData;
        }

        // Create a batch key for tracking
        const batchKey = `batch_${Object.keys(updates).join('_')}`;

        // Trigger debounced save
        debouncedSave(batchKey, requestData);
    }, [jsondocId, debouncedSave, projectData]);

    const hasUnsavedChanges = pendingSaves.size > 0;

    return {
        pendingSaves,
        editingField,
        handleFieldChange,
        handleBatchFieldChange,
        setEditingField,
        isPending,
        isSuccess,
        hasUnsavedChanges
    };
}; 