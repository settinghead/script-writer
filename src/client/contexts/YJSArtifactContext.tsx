import React, { createContext, useContext, useRef, useCallback, useMemo, useEffect } from 'react';
import { useYJSArtifact } from '../hooks/useYJSArtifact';
import { extractDataAtPath, setDataAtPath } from '../../common/utils/pathExtraction';

// Structural context - rarely changes, contains stable functions
interface YJSStructuralContextType {
    artifactId: string;
    basePath?: string;
    subscribeToValue: (path: string, callback: (value: any) => void) => () => void;
    updateValue: (path: string, value: any) => void;
    getValue: (path: string) => any;
}

// Content context - manages subscriptions without re-renders
interface YJSContentContextType {
    // This context intentionally has no value - it's just for subscription management
}

const YJSStructuralContext = createContext<YJSStructuralContextType | null>(null);
const YJSContentContext = createContext<YJSContentContextType | null>(null);

interface YJSArtifactProviderProps {
    artifactId: string;
    basePath?: string;
    enableCollaboration?: boolean; // For backward compatibility
    children: React.ReactNode;
}

export function YJSArtifactProvider({ artifactId, basePath, enableCollaboration, children }: YJSArtifactProviderProps) {
    const { data, artifact, isLoading, error, isConnected, updateField } = useYJSArtifact(artifactId);

    // Get the actual data to use - prefer artifact data if YJS data is not ready
    const actualData = useMemo(() => {
        // Check if collaborative data is actually loaded (has meaningful content)
        const hasCollaborativeData = data && typeof data === 'object' && Object.keys(data).length > 0;

        if (hasCollaborativeData) {
            return data;
        }

        // Fall back to artifact data
        if (artifact?.data) {
            let artifactData = artifact.data;
            if (typeof artifactData === 'string') {
                try {
                    artifactData = JSON.parse(artifactData);
                } catch (e) {
                    console.error('[YJSProvider] Failed to parse artifact data:', e);
                    return {};
                }
            }
            return artifactData;
        }

        return {};
    }, [data, artifact, artifactId, basePath]);

    // Store current data in ref to avoid function recreation
    const dataRef = useRef(actualData);
    dataRef.current = actualData;

    // Store other values for backward compatibility
    const artifactRef = useRef(artifact);
    artifactRef.current = artifact;

    const isLoadingRef = useRef(isLoading);
    isLoadingRef.current = isLoading;

    const errorRef = useRef(error);
    errorRef.current = error;

    const isConnectedRef = useRef(isConnected);
    isConnectedRef.current = isConnected;

    // Debug data loading
    useEffect(() => {
        // Data loading effect can be removed or kept for future debugging
    }, [actualData, isLoading, error, artifactId, basePath]);

    // Subscription management
    const subscriptionsRef = useRef<Map<string, Set<(value: any) => void>>>(new Map());

    // Resolve full path considering basePath
    const resolvePath = useCallback((path: string) => {
        if (!basePath) return path;
        return basePath + (path ? '.' + path : '');
    }, [basePath]);

    // Get current value for a path
    const getValue = useCallback((path: string) => {
        const fullPath = resolvePath(path);
        const currentData = dataRef.current;

        const value = extractDataAtPath(currentData, fullPath);

        return value;
    }, [resolvePath]);

    // Subscribe to value changes
    const subscribeToValue = useCallback((path: string, callback: (value: any) => void) => {
        const fullPath = resolvePath(path);

        if (!subscriptionsRef.current.has(fullPath)) {
            subscriptionsRef.current.set(fullPath, new Set());
        }

        const pathSubscriptions = subscriptionsRef.current.get(fullPath)!;
        pathSubscriptions.add(callback);

        // Immediately call with current value
        const currentValue = getValue(path);
        callback(currentValue);

        // Return unsubscribe function
        return () => {
            pathSubscriptions.delete(callback);
            if (pathSubscriptions.size === 0) {
                subscriptionsRef.current.delete(fullPath);
            }
        };
    }, [getValue, resolvePath]);

    // Update value
    const updateValue = useCallback((path: string, value: any) => {
        const fullPath = resolvePath(path);

        updateField(fullPath, value);

        // Notify subscribers
        const pathSubscriptions = subscriptionsRef.current.get(fullPath);
        if (pathSubscriptions) {
            pathSubscriptions.forEach(callback => callback(value));
        }
    }, [resolvePath, updateField]);

    // Notify subscribers when data changes
    useEffect(() => {
        subscriptionsRef.current.forEach((callbacks, path) => {
            const currentValue = extractDataAtPath(actualData, path);
            callbacks.forEach(callback => callback(currentValue));
        });
    }, [actualData]);

    // Stable structural context value
    const structuralValue = useMemo(() => ({
        artifactId,
        basePath,
        subscribeToValue,
        updateValue,
        getValue
    }), [artifactId, basePath, subscribeToValue, updateValue, getValue]);

    // Empty content context value (never changes)
    const contentValue = useMemo(() => ({}), []);

    return (
        <YJSStructuralContext.Provider value={structuralValue}>
            <YJSContentContext.Provider value={contentValue}>
                {children}
            </YJSContentContext.Provider>
        </YJSStructuralContext.Provider>
    );
}

// Hook to use the subscription-based context
export function useYJSField(path: string = '') {
    const structural = useContext(YJSStructuralContext);
    const content = useContext(YJSContentContext);

    if (!structural || !content) {
        throw new Error('useYJSField must be used within a YJSArtifactProvider');
    }

    // Local state for the field value
    const [localValue, setLocalValue] = React.useState<any>(undefined);
    const [isInitialized, setIsInitialized] = React.useState(false);

    // Debug logging for field initialization
    const shouldLog = structural.basePath?.includes('stages[') || !structural.basePath;

    // Initialize and subscribe to value changes
    useEffect(() => {
        // Get initial value
        const initialValue = structural.getValue(path);
        setLocalValue(initialValue);
        setIsInitialized(true);

        // Subscribe to changes
        const unsubscribe = structural.subscribeToValue(path, (newValue) => {
            setLocalValue(newValue);
        });

        return unsubscribe;
    }, [structural, path, shouldLog]);

    // Update function that updates both local state and YJS
    const updateValue = useCallback((newValue: any) => {
        setLocalValue(newValue); // Immediate local update
        structural.updateValue(path, newValue); // YJS update
    }, [structural, path]);

    return {
        value: localValue,
        updateValue,
        isInitialized
    };
}

// Legacy compatibility hook
export function useYJSArtifactContext() {
    const structural = useContext(YJSStructuralContext);
    const content = useContext(YJSContentContext);

    if (!structural || !content) {
        throw new Error('useYJSArtifactContext must be used within a YJSArtifactProvider');
    }

    // Access the YJS hook data through the provider
    const { data, artifact, isLoading, error, isConnected, updateField } = useYJSArtifact(structural.artifactId);

    // Return legacy-compatible interface
    return {
        data,
        artifact,
        isLoading,
        error,
        isConnected,
        isCollaborative: true,
        getField: structural.getValue,
        setField: structural.updateValue,
        updateField: structural.updateValue,
        updateFields: useCallback((updates: Record<string, any>) => {
            Object.entries(updates).forEach(([path, value]) => {
                structural.updateValue(path, value);
            });
        }, [structural]),
        artifactId: structural.artifactId
    };
}

