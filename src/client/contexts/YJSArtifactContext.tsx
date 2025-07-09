import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode, useMemo } from 'react';
import { useYJSArtifact } from '../hooks/useYJSArtifact';

// Types
export interface YJSArtifactContextValue {
    // State
    data: any;
    isLoading: boolean;
    isConnected: boolean;
    isCollaborative: boolean;
    error: string | null;

    // Field operations
    getField: (path: string) => any;
    setField: (path: string, value: any) => void;
    updateFields: (updates: Record<string, any>) => void;

    // Metadata
    artifactId: string;
    artifact: any;
}

export interface YJSArtifactProviderProps {
    artifactId: string;
    enableCollaboration?: boolean;
    children: ReactNode;
}

// Context
const YJSArtifactContext = createContext<YJSArtifactContextValue | null>(null);

// Utility function to get/set nested object values by path
function getValueByPath(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') return undefined;

    // Split the path into parts, handling array indices
    const parts: string[] = [];
    let current = '';
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
        const char = path[i];

        if (char === '[') {
            if (current) {
                parts.push(current);
                current = '';
            }
            inBrackets = true;
        } else if (char === ']') {
            if (inBrackets && current) {
                parts.push(current);
                current = '';
            }
            inBrackets = false;
        } else if (char === '.' && !inBrackets) {
            if (current) {
                parts.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        parts.push(current);
    }

    // Navigate through the object using the parsed parts
    return parts.reduce((current, key) => {
        if (current === null || current === undefined) return undefined;
        return current[key];
    }, obj);
}

function setValueByPath(obj: any, path: string, value: any): any {
    // Create a deep copy to avoid mutating the original object
    const result = JSON.parse(JSON.stringify(obj || {}));

    // Split the path into parts, handling array indices
    const parts: string[] = [];
    let current = '';
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
        const char = path[i];

        if (char === '[') {
            if (current) {
                parts.push(current);
                current = '';
            }
            inBrackets = true;
        } else if (char === ']') {
            if (inBrackets && current) {
                parts.push(current);
                current = '';
            }
            inBrackets = false;
        } else if (char === '.' && !inBrackets) {
            if (current) {
                parts.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        parts.push(current);
    }

    const lastKey = parts.pop()!;

    // Navigate to the parent object, creating intermediate objects/arrays as needed
    const target = parts.reduce((current, key) => {
        if (!current[key]) {
            // If the next key is a number, create an array, otherwise create an object
            const nextIndex = parts.indexOf(key) + 1;
            const nextKey = nextIndex < parts.length ? parts[nextIndex] : lastKey;
            const isNextKeyArrayIndex = /^\d+$/.test(nextKey);

            current[key] = isNextKeyArrayIndex ? [] : {};
        }
        return current[key];
    }, result);

    // Set the final value
    target[lastKey] = value;
    return result;
}

// Provider Component
export const YJSArtifactProvider: React.FC<YJSArtifactProviderProps> = ({
    artifactId,
    enableCollaboration = true,
    children
}) => {

    // Use the existing YJS hook
    const {
        data: yjsData,
        updateField: yjsUpdateField,
        updateFields: yjsUpdateFields,
        isLoading,
        isConnected,
        isCollaborative,
        error,
        artifact
    } = useYJSArtifact(artifactId, { enableCollaboration });


    // Local state for optimistic updates
    const [localData, setLocalData] = useState<any>({});
    // State for optimistic updates
    const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, any>>({});
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({});
    const yjsDataRef = useRef<any>(null);

    // Update the ref whenever yjsData changes
    useEffect(() => {
        yjsDataRef.current = yjsData;
    }, [yjsData]);

    // Merge YJS data with local optimistic updates
    const mergedData = React.useMemo(() => {

        // Ensure we have a valid base object
        let base = {};

        if (yjsData && typeof yjsData === 'object' && !Array.isArray(yjsData)) {
            base = { ...yjsData };
        } else if (typeof yjsData === 'string') {
            try {
                base = JSON.parse(yjsData);
            } catch (e) {
                base = {};
            }
        } else if (artifact?.data) {
            // Fallback to artifact data if YJS data is not available
            try {
                if (typeof artifact.data === 'string') {
                    base = JSON.parse(artifact.data);
                } else if (typeof artifact.data === 'object') {
                    base = { ...artifact.data };
                }
            } catch (e) {
                console.error(`[YJSArtifactProvider] Failed to parse artifact data:`, e);
                base = {};
            }
        } else {
        }

        // Apply pending optimistic updates safely
        let merged = { ...base };
        Object.entries(optimisticUpdates).forEach(([path, value]) => {
            try {
                merged = setValueByPath(merged, path, value);
            } catch (e) {
                console.error(`[YJSArtifactProvider] Failed to set path ${path}:`, e);
            }
        });

        return merged;
    }, [yjsData, artifactId, artifact?.data, optimisticUpdates]);

    // Update local data when YJS data changes
    useEffect(() => {
        if (yjsData) {
            setLocalData(yjsData);

            // Clear optimistic updates that have been confirmed by YJS
            setOptimisticUpdates(prevOptimistic => {
                const newOptimisticUpdates = { ...prevOptimistic };
                let hasChanges = false;

                Object.keys(newOptimisticUpdates).forEach(path => {
                    const yjsValue = getValueByPath(yjsData, path);
                    const optimisticValue = newOptimisticUpdates[path];

                    // If YJS has the value we optimistically set, clear the optimistic update
                    if (yjsValue === optimisticValue) {
                        delete newOptimisticUpdates[path];
                        hasChanges = true;
                    }
                });

                if (hasChanges) {
                    setPendingUpdates(newOptimisticUpdates);
                    return newOptimisticUpdates;
                }

                return prevOptimistic;
            });
        }
    }, [yjsData]);

    // Get field value by path with safe defaults - use useMemo to stabilize the function
    const getField = useMemo(() => {
        // Memoize default values to prevent new references
        const defaultArray: any[] = [];
        const defaultString: string = '';

        return (path: string): any => {
            const value = getValueByPath(mergedData, path);

            // Add debug logging for specific paths
            if (path.includes('emotionArcs') || path.includes('relationshipDevelopments') || path.includes('characters')) {
                console.log('[YJSArtifactContext] getField debug:', {
                    path,
                    value,
                    valueType: typeof value,
                    isArray: Array.isArray(value),
                    mergedData: mergedData,
                    artifactId
                });

                // If it's an array path, log the array structure
                if (path === 'emotionArcs' || path === 'relationshipDevelopments') {
                    console.log(`[YJSArtifactContext] ${path} array structure:`, {
                        array: value,
                        length: value?.length,
                        items: value?.map((item: any, index: number) => ({
                            index,
                            item,
                            itemStringified: JSON.stringify(item),
                            keys: Object.keys(item || {}),
                            type: typeof item,
                            hasCharacters: 'characters' in (item || {}),
                            hasContent: 'content' in (item || {}),
                            charactersValue: item?.characters,
                            contentValue: item?.content
                        }))
                    });

                    // Also log the raw items
                    console.log(`[YJSArtifactContext] ${path} raw items:`, value);
                    if (value && value.length > 0) {
                        console.log(`[YJSArtifactContext] ${path}[0] raw:`, value[0]);
                        console.log(`[YJSArtifactContext] ${path}[0] JSON:`, JSON.stringify(value[0], null, 2));
                    }
                }
            }

            // Return safe defaults for undefined values
            if (value === undefined || value === null) {
                // Check if path suggests an array (common array field names)
                if (path.includes('themes') || path.includes('points') || path.includes('tags') || path.includes('items') ||
                    path.includes('emotionArcs') || path.includes('relationshipDevelopments') || path.includes('insights')) {
                    return defaultArray;
                }
                // Default to empty string for other fields
                return defaultString;
            }

            return value;
        };
    }, [mergedData, artifactId]);

    // Set field value by path with optimistic updates
    const setField = useCallback((path: string, value: any) => {
        console.log(`[YJSArtifactProvider] setField called:`, { path, value, hasYjsData: !!yjsDataRef.current });

        // Don't save undefined or null values unless explicitly setting them to empty string
        if (value === undefined || value === null) {
            console.log(`[YJSArtifactProvider] Skipping null/undefined value for path: ${path}`);
            return;
        }

        // Apply optimistic update immediately
        setOptimisticUpdates(prev => ({
            ...prev,
            [path]: value
        }));

        // Update via YJS (this will eventually sync back and clear the optimistic update)
        if (isCollaborative && yjsDataRef.current) {
            console.log(`[YJSArtifactProvider] Updating YJS for path: ${path}`);

            // For YJS, we need to update the root-level field
            const rootKey = path.split('.')[0];

            if (path.includes('.')) {
                // Nested path - get current root value and update it
                let currentRootValue = yjsDataRef.current?.[rootKey];

                // If the root value is a string (JSON), parse it first
                if (typeof currentRootValue === 'string') {
                    try {
                        currentRootValue = JSON.parse(currentRootValue);
                    } catch (e) {
                        console.warn(`[YJSArtifactProvider] Failed to parse root value for ${rootKey}:`, e);
                        currentRootValue = {};
                    }
                }

                // Ensure we have an object to work with
                if (!currentRootValue || typeof currentRootValue !== 'object') {
                    currentRootValue = {};
                }

                // Update the nested value using the path relative to the root
                const relativePath = path.substring(rootKey.length + 1); // Remove "rootKey." prefix
                const updatedRootValue = setValueByPath(currentRootValue, relativePath, value);

                console.log(`[YJSArtifactProvider] Nested update:`, {
                    rootKey,
                    relativePath,
                    originalValue: currentRootValue,
                    updatedValue: updatedRootValue
                });

                yjsUpdateField(rootKey, updatedRootValue).catch(error => {
                    console.error(`[YJSArtifactProvider] Error updating nested field ${rootKey}:`, error);
                });
            } else {
                // Direct field update
                console.log(`[YJSArtifactProvider] Direct update for field: ${path}`);
                yjsUpdateField(path, value).catch(error => {
                    console.error(`[YJSArtifactProvider] Error updating field ${path}:`, error);
                });
            }
        } else if (!isCollaborative) {
            console.log(`[YJSArtifactProvider] Non-collaborative mode - TODO: implement direct artifact update`);
            // TODO: Handle non-collaborative updates
        } else {
            console.warn(`[YJSArtifactProvider] Cannot update - no YJS data available (isCollaborative=${isCollaborative}, hasYjsData=${!!yjsDataRef.current})`);
        }
    }, [isCollaborative, yjsUpdateField]);

    // Update multiple fields
    const updateFields = useCallback((updates: Record<string, any>) => {

        setTimeout(() => {
            try {
                // Apply optimistic updates
                setOptimisticUpdates(prev => ({
                    ...prev,
                    ...updates
                }));

                // Update via YJS
                if (isCollaborative) {

                    // Group updates by root key for efficient YJS updates
                    const rootUpdates: Record<string, any> = {};
                    Object.entries(updates).forEach(([path, value]) => {
                        const rootKey = path.split('.')[0];
                        if (!rootUpdates[rootKey]) {
                            rootUpdates[rootKey] = yjsDataRef.current?.[rootKey] || {};
                        }
                        rootUpdates[rootKey] = setValueByPath(rootUpdates[rootKey], path, value);
                    });

                    // Apply all root updates
                    Object.entries(rootUpdates).forEach(([rootKey, rootValue]) => {
                        yjsUpdateField(rootKey, rootValue).catch(error => {
                            console.error(`[YJSArtifactProvider] Error updating root field ${rootKey}:`, error);
                        });
                    });
                } else {
                }
            } catch (error) {
                console.error(`[YJSArtifactProvider] Error in updateFields:`, error);
            }
        }, 0);
    }, [isCollaborative, yjsUpdateField]);

    const contextValue: YJSArtifactContextValue = {
        data: mergedData,
        isLoading,
        isConnected,
        isCollaborative,
        error,
        getField,
        setField,
        updateFields,
        artifactId,
        artifact
    };



    return (
        <YJSArtifactContext.Provider value={contextValue}>
            {children}
        </YJSArtifactContext.Provider>
    );
};

export const useYJSArtifactContext = (): YJSArtifactContextValue => {
    const context = useContext(YJSArtifactContext);
    if (!context) {
        throw new Error('useYJSArtifactContext must be used within a YJSArtifactProvider');
    }
    return context;
}; 