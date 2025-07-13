import React, { createContext, useContext, useRef, useCallback, useMemo, useEffect } from 'react';
import { useYJSJsondoc } from '../hooks/useYJSJsondoc';
import { extractDataAtPath, setDataAtPath } from '../../../common/utils/pathExtraction';

// Structural context - rarely changes, contains stable functions
interface YJSStructuralContextType {
    jsondocId: string;
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

interface YJSJsondocProviderProps {
    jsondocId: string;
    basePath?: string;
    enableCollaboration?: boolean; // For backward compatibility
    children: React.ReactNode;
}

export function YJSJsondocProvider({ jsondocId, basePath, enableCollaboration, children }: YJSJsondocProviderProps) {
    const { data, jsondoc, isLoading, error, isConnected, updateField } = useYJSJsondoc(jsondocId);

    // Get the actual data to use - prefer jsondoc data if YJS data is not ready
    const actualData = useMemo(() => {
        const hasYJSData = data && typeof data === 'object' && Object.keys(data).length > 0;

        // Parse jsondoc data if it's a string
        let parsedJsondocData: any = jsondoc?.data;
        if (typeof parsedJsondocData === 'string') {
            try {
                parsedJsondocData = JSON.parse(parsedJsondocData);
            } catch (e) {
                console.error('[YJSProvider] Failed to parse jsondoc data:', e);
                parsedJsondocData = null;
            }
        }

        const hasJsondocData = parsedJsondocData && typeof parsedJsondocData === 'object' && Object.keys(parsedJsondocData).length > 0;

        if (hasYJSData) {
            // Use YJS data if available (most recent collaborative changes)
            return data;
        } else if (hasJsondocData) {
            // Fall back to jsondoc data if no YJS data
            return parsedJsondocData;
        } else {
            // No data available
            return {};
        }
    }, [data, jsondoc, jsondocId, basePath]);

    // Store current data in ref to avoid function recreation
    const dataRef = useRef(actualData);
    dataRef.current = actualData;

    // Store other values for backward compatibility
    const jsondocRef = useRef(jsondoc);
    jsondocRef.current = jsondoc;

    const isLoadingRef = useRef(isLoading);
    isLoadingRef.current = isLoading;

    const errorRef = useRef(error);
    errorRef.current = error;

    const isConnectedRef = useRef(isConnected);
    isConnectedRef.current = isConnected;

    // Debug data loading
    useEffect(() => {
        // Data loading effect can be removed or kept for future debugging
    }, [actualData, isLoading, error, jsondocId, basePath]);

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
        jsondocId,
        basePath,
        subscribeToValue,
        updateValue,
        getValue
    }), [jsondocId, basePath, subscribeToValue, updateValue, getValue]);

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
        throw new Error('useYJSField must be used within a YJSJsondocProvider');
    }

    // Local state for the field value
    const [localValue, setLocalValue] = React.useState<any>(undefined);
    const [isInitialized, setIsInitialized] = React.useState(false);

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
    }, [structural, path]);

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
export function useYJSJsondocContext() {
    const structural = useContext(YJSStructuralContext);
    const content = useContext(YJSContentContext);

    if (!structural || !content) {
        throw new Error('useYJSJsondocContext must be used within a YJSJsondocProvider');
    }

    // Access the YJS hook data through the provider
    const { data, jsondoc, isLoading, error, isConnected, updateField } = useYJSJsondoc(structural.jsondocId);

    // Return legacy-compatible interface
    return {
        data,
        jsondoc,
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
        jsondocId: structural.jsondocId
    };
}

