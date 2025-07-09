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
    basePath?: string; // NEW: Support for hierarchical context (e.g., "stages[0]")
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
    basePath,
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
    const contextDataRef = useRef<any>(null);

    // Update the yjsData ref whenever it changes
    useEffect(() => {
        yjsDataRef.current = yjsData;
    }, [yjsData]);

    // SIMPLIFIED: No complex merging needed with hierarchical context approach
    const contextData = React.useMemo(() => {
        // Start with artifact data as base
        let base = {};

        if (artifact?.data) {
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
        }

        // Apply YJS data if available (this is the real-time collaborative state)
        if (yjsData && typeof yjsData === 'object' && !Array.isArray(yjsData) && Object.keys(yjsData).length > 0) {
            base = { ...yjsData };
        } else if (typeof yjsData === 'string') {
            try {
                base = JSON.parse(yjsData);
            } catch (e) {
                // Keep the artifact data as fallback
            }
        }

        // Apply optimistic updates for immediate UI feedback
        let result = { ...base };
        Object.entries(optimisticUpdates).forEach(([path, value]) => {
            try {
                result = setValueByPath(result, path, value);
            } catch (e) {
                console.error(`[YJSArtifactProvider] Failed to set path ${path}:`, e);
            }
        });

        return result;
    }, [artifact?.data, yjsData, optimisticUpdates]);

    // Update the contextData ref whenever it changes
    useEffect(() => {
        contextDataRef.current = contextData;
    }, [contextData]);

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

    // Get field value by path - include contextData so components re-render when data changes
    const getField = useCallback((path: string): any => {
        // If basePath is provided, prefix the path
        const fullPath = basePath ? `${basePath}.${path}` : path;

        // Use current contextData directly so components react to changes
        const currentData = contextData || {};
        const value = getValueByPath(currentData, fullPath);

        console.log(`[YJSArtifactProvider] getField - Path: ${path}, FullPath: ${fullPath}, HasData: ${!!currentData}, Value: ${typeof value === 'string' ? `"${value.substring(0, 50)}..."` : typeof value}`);

        // Return safe defaults for undefined values
        if (value === undefined || value === null) {
            // Check if path suggests an array (common array field names)
            if (path.includes('themes') || path.includes('points') || path.includes('tags') || path.includes('items') ||
                path.includes('emotionArcs') || path.includes('relationshipDevelopments') || path.includes('insights')) {
                return [];
            }
            // Default to empty string for other fields
            return '';
        }

        return value;
    }, [basePath, contextData]); // Include contextData for reactivity

    // Set field value by path with optimistic updates
    const setField = useCallback((path: string, value: any) => {
        // Don't save undefined or null values unless explicitly setting them to empty string
        if (value === undefined || value === null) {
            return;
        }

        // If basePath is provided, prefix the path
        const fullPath = basePath ? `${basePath}.${path}` : path;

        // Apply optimistic update immediately
        setOptimisticUpdates(prev => ({
            ...prev,
            [fullPath]: value
        }));

        // Update via YJS (this will eventually sync back and clear the optimistic update)
        if (isCollaborative) {
            // Let the YJS hook handle the complex path logic
            // It already supports array indices and nested paths properly
            yjsUpdateField(fullPath, value).catch(error => {
                console.error(`[YJSArtifactProvider] Error updating field ${fullPath}:`, error);
            });
        } else if (!isCollaborative) {
            // TODO: Handle non-collaborative updates
        }
    }, [isCollaborative, yjsUpdateField, basePath]);

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



    const contextValue: YJSArtifactContextValue = useMemo(() => {
        console.log(`[YJSArtifactProvider] Creating context - ArtifactId: ${artifactId}, IsLoading: ${isLoading}, HasData: ${!!contextData}, DataKeys: ${contextData ? Object.keys(contextData).length : 0}`);

        return {
            // Provide actual values, but memoize the context object itself to prevent excessive re-renders
            data: contextData,
            isLoading,
            isConnected,
            error,
            artifact,
            isCollaborative,
            getField,
            setField,
            updateFields,
            artifactId,

        };
    }, [
        // ESSENTIAL: Include state that components need to react to
        artifactId,
        isLoading,
        error,
        getField,  // This changes when contextData changes, triggering component updates
        setField,
        updateFields,
        // DON'T include: contextData directly (causes too many re-renders)
        // DON'T include: isConnected, artifact (less critical)
    ]);



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

