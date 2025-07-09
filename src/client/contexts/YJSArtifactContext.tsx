import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
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
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setValueByPath(obj: any, path: string, value: any): any {
    // Create a deep copy to avoid mutating the original object
    const result = JSON.parse(JSON.stringify(obj || {}));

    const keys = path.split('.');
    const lastKey = keys.pop()!;

    // Navigate to the parent object, creating intermediate objects as needed
    const target = keys.reduce((current, key) => {
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
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
    console.log(`[YJSArtifactProvider] Initializing for artifact ${artifactId}, collaboration: ${enableCollaboration}`);

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

    // Debug logging for YJS hook state
    useEffect(() => {
        console.log(`[YJSArtifactProvider] YJS Hook State Update:`, {
            artifactId,
            isLoading,
            isConnected,
            isCollaborative,
            error,
            yjsDataType: typeof yjsData,
            yjsDataKeys: yjsData && typeof yjsData === 'object' ? Object.keys(yjsData) : 'N/A',
            yjsData: yjsData
        });
    }, [artifactId, isLoading, isConnected, isCollaborative, error, yjsData]);

    // Local state for optimistic updates
    const [localData, setLocalData] = useState<any>({});
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({});
    const optimisticUpdatesRef = useRef<Record<string, any>>({});
    const yjsDataRef = useRef<any>(null);

    // Update the ref whenever yjsData changes
    useEffect(() => {
        yjsDataRef.current = yjsData;
    }, [yjsData]);

    // Merge YJS data with local optimistic updates
    const mergedData = React.useMemo(() => {
        console.log(`[YJSArtifactProvider] Merging data for artifact ${artifactId}`);

        // Ensure we have a valid base object
        let base = {};

        if (yjsData && typeof yjsData === 'object' && !Array.isArray(yjsData)) {
            base = { ...yjsData };
            console.log(`[YJSArtifactProvider] Using YJS data as base:`, base);
        } else if (typeof yjsData === 'string') {
            try {
                base = JSON.parse(yjsData);
                console.log(`[YJSArtifactProvider] Parsed YJS string data:`, base);
            } catch (e) {
                console.warn(`[YJSArtifactProvider] Failed to parse YJS data as JSON:`, yjsData);
                base = {};
            }
        } else {
            console.log(`[YJSArtifactProvider] No valid YJS data, using empty base. YJS data:`, yjsData);
        }

        // Apply pending optimistic updates safely
        let merged = { ...base };
        Object.entries(optimisticUpdatesRef.current).forEach(([path, value]) => {
            try {
                console.log(`[YJSArtifactProvider] Applying optimistic update: ${path} = ${JSON.stringify(value)}`);
                merged = setValueByPath(merged, path, value);
            } catch (e) {
                console.error(`[YJSArtifactProvider] Failed to set path ${path}:`, e);
            }
        });

        console.log(`[YJSArtifactProvider] Final merged data:`, merged);
        return merged;
    }, [yjsData, pendingUpdates, artifactId]);

    // Update local data when YJS data changes
    useEffect(() => {
        if (yjsData) {
            console.log(`[YJSArtifactProvider] YJS data changed, updating local data:`, yjsData);
            setLocalData(yjsData);

            // Clear optimistic updates that have been confirmed by YJS
            const newOptimisticUpdates = { ...optimisticUpdatesRef.current };
            Object.keys(newOptimisticUpdates).forEach(path => {
                const yjsValue = getValueByPath(yjsData, path);
                const optimisticValue = newOptimisticUpdates[path];

                // If YJS has the value we optimistically set, clear the optimistic update
                if (yjsValue === optimisticValue) {
                    console.log(`[YJSArtifactProvider] Clearing optimistic update for ${path} (confirmed by YJS)`);
                    delete newOptimisticUpdates[path];
                }
            });

            optimisticUpdatesRef.current = newOptimisticUpdates;
            setPendingUpdates(newOptimisticUpdates);
        }
    }, [yjsData]);

    // Get field value by path with safe defaults
    const getField = useCallback((path: string): any => {
        const value = getValueByPath(mergedData, path);
        console.log(`[YJSArtifactProvider] getField(${path}) = ${JSON.stringify(value)}`);

        // Return safe defaults for undefined values
        if (value === undefined || value === null) {
            // Check if path suggests an array (common array field names)
            if (path.includes('themes') || path.includes('points') || path.includes('tags') || path.includes('items')) {
                console.log(`[YJSArtifactProvider] Returning empty array for ${path}`);
                return [];
            }
            // Default to empty string for other fields
            console.log(`[YJSArtifactProvider] Returning empty string for ${path}`);
            return '';
        }

        return value;
    }, [mergedData]);

    // Set field value by path with optimistic updates
    const setField = useCallback((path: string, value: any) => {
        console.log(`[YJSArtifactProvider] setField called: ${path} = ${JSON.stringify(value)}`);
        console.log(`[YJSArtifactProvider] Current state: isCollaborative=${isCollaborative}, isConnected=${isConnected}`);
        console.log(`[YJSArtifactProvider] YJS data available:`, !!yjsDataRef.current, typeof yjsDataRef.current, yjsDataRef.current);

        // Don't save undefined or null values unless explicitly setting them to empty string
        if (value === undefined || value === null) {
            console.log(`[YJSArtifactProvider] Ignoring undefined/null value for ${path}`);
            return;
        }

        // Apply optimistic update immediately
        optimisticUpdatesRef.current = {
            ...optimisticUpdatesRef.current,
            [path]: value
        };
        setPendingUpdates({ ...optimisticUpdatesRef.current });
        console.log(`[YJSArtifactProvider] Applied optimistic update for ${path}`);

        // Update via YJS (this will eventually sync back and clear the optimistic update)
        console.log(`[YJSArtifactProvider] Checking YJS update condition: isCollaborative=${isCollaborative}, hasYjsData=${!!yjsDataRef.current}`);
        if (isCollaborative && yjsDataRef.current) {
            console.log(`[YJSArtifactProvider] Updating via YJS for ${path}`);

            // For YJS, we need to update the root-level field
            const rootKey = path.split('.')[0];
            const currentRootValue = yjsDataRef.current?.[rootKey] || {};

            if (path.includes('.')) {
                // Nested path - update the nested value
                const updatedRootValue = setValueByPath(currentRootValue, path, value);
                console.log(`[YJSArtifactProvider] Updating nested path ${path} in root ${rootKey}:`, updatedRootValue);
                yjsUpdateField(rootKey, updatedRootValue);
            } else {
                // Direct field update
                console.log(`[YJSArtifactProvider] Updating direct field ${path}:`, value);
                yjsUpdateField(path, value);
            }
        } else if (!isCollaborative) {
            console.log(`[YJSArtifactProvider] Non-collaborative mode - would update via regular API`);
            // TODO: Handle non-collaborative updates
        } else {
            console.warn(`[YJSArtifactProvider] Cannot update - no YJS data available (isCollaborative=${isCollaborative}, hasYjsData=${!!yjsDataRef.current})`);
        }
    }, [isCollaborative, yjsUpdateField]);

    // Update multiple fields
    const updateFields = useCallback((updates: Record<string, any>) => {
        console.log(`[YJSArtifactProvider] updateFields called with:`, updates);

        setTimeout(() => {
            try {
                // Apply optimistic updates
                Object.entries(updates).forEach(([path, value]) => {
                    optimisticUpdatesRef.current[path] = value;
                });
                setPendingUpdates({ ...optimisticUpdatesRef.current });

                // Update via YJS
                if (isCollaborative) {
                    console.log(`[YJSArtifactProvider] Batch updating via YJS:`, updates);

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
                        console.log(`[YJSArtifactProvider] Batch updating root ${rootKey}:`, rootValue);
                        yjsUpdateField(rootKey, rootValue);
                    });
                } else {
                    console.log(`[YJSArtifactProvider] Non-collaborative batch update - would update via regular API`);
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

    console.log(`[YJSArtifactProvider] Providing context value:`, {
        artifactId,
        dataKeys: mergedData && typeof mergedData === 'object' ? Object.keys(mergedData) : 'N/A',
        isLoading,
        isConnected,
        isCollaborative,
        error
    });

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