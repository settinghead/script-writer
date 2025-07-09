import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';

// YJS types (loaded dynamically)
type YDoc = any;
type YMap = any;

export interface YJSArtifactHook {
    doc: YDoc | null;
    provider: any | null;
    awareness: any | null;
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    data: any;
    updateField: (field: string, value: any) => void;
    updateFields: (updates: Record<string, any>) => void;
    isInitialized: boolean;
    isCollaborative: boolean;
}

export const useYJSArtifact = (
    artifactId: string,
    options: {
        enableCollaboration?: boolean;
        syncIntervalMs?: number;
    } = {}
): YJSArtifactHook => {
    const { enableCollaboration = false, syncIntervalMs = 5000 } = options;
    const projectData = useProjectData();

    // State for YJS document
    const [doc, setDoc] = useState<YDoc | null>(null);
    const [data, setData] = useState<any>({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs to prevent re-initialization loops
    const isInitializedRef = useRef(false);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Get artifact data from project context
    const artifact = Array.isArray(projectData.artifacts)
        ? projectData.artifacts.find((a: any) => a.id === artifactId)
        : null;

    // Initialize YJS document
    useEffect(() => {
        if (!artifactId || !enableCollaboration || isInitializedRef.current) {
            return;
        }

        let mounted = true;
        isInitializedRef.current = true;

        const initializeYJS = async () => {
            try {
                setIsLoading(true);
                setError(null);
                console.log('Initializing YJS for artifact:', artifactId);

                // Dynamic import for YJS
                const Y = await import('yjs');

                if (!mounted) return;

                // Create YJS document
                const yDoc = new Y.Doc();

                // Initialize with artifact data if available
                if (artifact?.data) {
                    const yMap = yDoc.getMap('content');
                    const artifactData = typeof artifact.data === 'string'
                        ? JSON.parse(artifact.data)
                        : artifact.data;

                    // Populate YJS document with artifact data
                    Object.entries(artifactData).forEach(([key, value]) => {
                        yMap.set(key, value);
                    });
                }

                // Set up data synchronization
                const updateData = () => {
                    if (!mounted) return;
                    const yMap = yDoc.getMap('content');
                    const newData: any = {};
                    yMap.forEach((value, key) => {
                        newData[key] = value;
                    });
                    setData(newData);
                };

                // Listen for document changes
                yDoc.on('update', updateData);

                // Initial data update
                updateData();

                if (!mounted) return;

                // Set state
                setDoc(yDoc);
                setIsInitialized(true);
                setIsLoading(false);

                // Set up cleanup
                cleanupRef.current = () => {
                    yDoc.off('update', updateData);
                    yDoc.destroy();
                };

                console.log('YJS initialized successfully for artifact:', artifactId);

            } catch (error) {
                console.error('Failed to initialize YJS:', error);
                if (mounted) {
                    setIsInitialized(false);
                    setIsLoading(false);
                    setError(error instanceof Error ? error.message : 'Failed to initialize YJS');
                }
            }
        };

        initializeYJS();

        return () => {
            mounted = false;
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
            isInitializedRef.current = false;
        };
    }, [artifactId, enableCollaboration, artifact?.data]);

    // Update field function
    const updateField = useCallback((field: string, value: any) => {
        if (!doc) {
            console.warn('YJS doc not initialized, cannot update field:', field);
            return;
        }

        console.log('Updating YJS field:', field, value);
        const yMap = doc.getMap('content');
        yMap.set(field, value);
    }, [doc]);

    // Update multiple fields function
    const updateFields = useCallback((updates: Record<string, any>) => {
        if (!doc) {
            console.warn('YJS doc not initialized, cannot update fields');
            return;
        }

        console.log('Updating YJS fields:', updates);
        const yMap = doc.getMap('content');
        Object.entries(updates).forEach(([key, value]) => {
            yMap.set(key, value);
        });
    }, [doc]);

    return {
        doc,
        provider: null, // No provider for now
        awareness: null, // No awareness for now
        isConnected: true, // Local-only for now
        isLoading,
        error,
        data,
        updateField,
        updateFields,
        isInitialized,
        isCollaborative: enableCollaboration
    };
};