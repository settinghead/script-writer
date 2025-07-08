import { useEffect, useState, useRef, useCallback } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';

// YJS types (will be loaded dynamically)
type YDoc = any;
type YMap = any;
type YArray = any;
type YText = any;

export interface YJSArtifactHook {
    // YJS document and provider
    doc: YDoc | null;
    provider: any | null;

    // Connection state
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;

    // Data access
    data: any;
    artifact: any;

    // Update methods
    updateField: (field: string, value: any) => void;
    updateFields: (updates: Record<string, any>) => void;

    // Utility methods
    syncToArtifact: () => Promise<void>;
    cleanup: () => void;

    // Collaboration features
    isCollaborative: boolean;
}

export const useYJSArtifact = (
    artifactId: string,
    options: {
        enableCollaboration?: boolean;
        syncIntervalMs?: number;
        debounceMs?: number;
    } = {}
): YJSArtifactHook => {
    const {
        enableCollaboration = true,
        syncIntervalMs = 5000,
        debounceMs = 1000
    } = options;

    // State
    const [doc, setDoc] = useState<YDoc | null>(null);
    const [provider, setProvider] = useState<any | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collaborativeData, setCollaborativeData] = useState<any>(null);

    // Refs
    const projectData = useProjectData();
    const cleanupRef = useRef<(() => void) | null>(null);
    const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
    const Y = useRef<any>(null);

    // Get artifact from project data
    const artifact = projectData.artifacts && Array.isArray(projectData.artifacts)
        ? projectData.artifacts.find((a: any) => a.id === artifactId)
        : null;

    // Initialize YJS module
    const initializeYJS = useCallback(async () => {
        if (!Y.current) {
            try {
                Y.current = await import('yjs');
            } catch (err) {
                console.error('Failed to import YJS:', err);
                throw new Error('YJS module not available');
            }
        }
        return Y.current;
    }, []);

    // Initialize YJS document
    const initializeDocument = useCallback(async () => {
        if (!artifactId || !artifact || !enableCollaboration) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const YJS = await initializeYJS();

            // Create YJS document
            const yjsDoc = new YJS.Doc();

            // Initialize document with artifact data
            const yMap = yjsDoc.getMap('content');
            const artifactData = artifact.data || {};

            // Populate YJS document with artifact data
            Object.entries(artifactData).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    const yText = new YJS.Text();
                    yText.insert(0, value);
                    yMap.set(key, yText);
                } else if (Array.isArray(value)) {
                    const yArray = new YJS.Array();
                    value.forEach((item, index) => {
                        if (typeof item === 'string') {
                            const yText = new YJS.Text();
                            yText.insert(0, item);
                            yArray.insert(index, [yText]);
                        } else {
                            yArray.insert(index, [item]);
                        }
                    });
                    yMap.set(key, yArray);
                } else {
                    yMap.set(key, value);
                }
            });

            // Set up change listener
            const updateHandler = () => {
                const updatedData = convertYJSToObject(yMap, YJS);
                setCollaborativeData(updatedData);

                // Schedule sync to artifact
                if (syncTimerRef.current) {
                    clearTimeout(syncTimerRef.current);
                }
                syncTimerRef.current = setTimeout(() => {
                    syncToArtifactInternal(yjsDoc);
                }, debounceMs);
            };

            yMap.observe(updateHandler);

            // TODO: Set up WebSocket provider for real-time collaboration
            // This will be implemented in the next phase
            const mockProvider = {
                connect: () => setIsConnected(true),
                disconnect: () => setIsConnected(false),
                destroy: () => setIsConnected(false)
            };

            setDoc(yjsDoc);
            setProvider(mockProvider);
            setCollaborativeData(convertYJSToObject(yMap, YJS));
            setIsConnected(true);
            setIsLoading(false);

            // Set up cleanup
            cleanupRef.current = () => {
                yMap.unobserve(updateHandler);
                if (syncTimerRef.current) {
                    clearTimeout(syncTimerRef.current);
                }
                mockProvider.destroy();
                yjsDoc.destroy();
                setDoc(null);
                setProvider(null);
                setIsConnected(false);
                setCollaborativeData(null);
            };

        } catch (err) {
            console.error('Failed to initialize YJS document:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize collaboration');
            setIsLoading(false);
        }
    }, [artifactId, artifact, enableCollaboration, debounceMs, initializeYJS]);

    // Convert YJS document to plain object
    const convertYJSToObject = (yMap: YMap, YJS: any): any => {
        const result: any = {};
        yMap.forEach((value: any, key: string) => {
            if (value instanceof YJS.Text) {
                result[key] = value.toString();
            } else if (value instanceof YJS.Array) {
                result[key] = value.toArray().map((item: any) => {
                    if (item instanceof YJS.Text) {
                        return item.toString();
                    }
                    return item;
                });
            } else {
                result[key] = value;
            }
        });
        return result;
    };

    // Sync YJS document to artifact
    const syncToArtifactInternal = async (yjsDoc: YDoc) => {
        if (!yjsDoc || !artifact) return;

        try {
            const yMap = yjsDoc.getMap('content');
            const updatedData = convertYJSToObject(yMap, Y.current);

            console.log('YJS: Syncing data to artifact:', artifact.id);
            console.log('YJS: Updated data:', updatedData);
            console.log('YJS: Updated data type:', typeof updatedData);

            // Update artifact via existing API
            await projectData.updateArtifact.mutateAsync({
                artifactId: artifact.id,
                data: updatedData
            });

            console.log('YJS: Sync completed successfully');

        } catch (err) {
            console.error('Failed to sync YJS changes to artifact:', err);
            setError(err instanceof Error ? err.message : 'Sync failed');
        }
    };

    // Initialize when artifact changes
    useEffect(() => {
        initializeDocument();

        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [initializeDocument]);

    // Update field in YJS document
    const updateField = useCallback((field: string, value: any) => {
        if (!doc || !Y.current) return;

        const yMap = doc.getMap('content');

        if (typeof value === 'string') {
            let yText = yMap.get(field);
            if (!(yText instanceof Y.current.Text)) {
                yText = new Y.current.Text();
                yMap.set(field, yText);
            }
            yText.delete(0, yText.length);
            yText.insert(0, value);
        } else if (Array.isArray(value)) {
            let yArray = yMap.get(field);
            if (!(yArray instanceof Y.current.Array)) {
                yArray = new Y.current.Array();
                yMap.set(field, yArray);
            }
            yArray.delete(0, yArray.length);
            value.forEach((item, index) => {
                if (typeof item === 'string') {
                    const yText = new Y.current.Text();
                    yText.insert(0, item);
                    yArray.insert(index, [yText]);
                } else {
                    yArray.insert(index, [item]);
                }
            });
        } else {
            yMap.set(field, value);
        }
    }, [doc]);

    // Update multiple fields
    const updateFields = useCallback((updates: Record<string, any>) => {
        Object.entries(updates).forEach(([field, value]) => {
            updateField(field, value);
        });
    }, [updateField]);

    // Public sync method
    const syncToArtifact = useCallback(async () => {
        if (doc) {
            await syncToArtifactInternal(doc);
        }
    }, [doc]);

    // Cleanup method
    const cleanup = useCallback(() => {
        if (cleanupRef.current) {
            cleanupRef.current();
        }
    }, []);

    return {
        // YJS document and provider
        doc,
        provider,

        // Connection state
        isConnected,
        isLoading,
        error,

        // Data access (prioritize collaborative data over artifact data)
        data: collaborativeData || artifact?.data,
        artifact,

        // Update methods
        updateField,
        updateFields,

        // Utility methods
        syncToArtifact,
        cleanup,

        // Collaboration features
        isCollaborative: enableCollaboration && !!doc
    };
};