import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { createElectricConfigWithDebugAuth } from '../../common/config/electric';

// Types (will be loaded dynamically)
type YDoc = any;
type YMap = any;
type YArray = any;
type YText = any;
type ElectricProvider = any;
type Awareness = any;
type IndexeddbPersistence = any;
type LocalStorageResumeStateProvider = any;

// Parser function for Electric bytea fields (will be set up dynamically)
let parseToDecoder: any = null;

type UpdateTableSchema = {
    update: any; // Will be a decoder from lib0/decoding
};

export interface YJSArtifactHook {
    // YJS document and provider
    doc: YDoc | null;
    provider: ElectricProvider | null;

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
    awareness: Awareness | null;
}

export const useYJSArtifact = (
    artifactId: string,
    options: {
        enableCollaboration?: boolean;
        syncIntervalMs?: number;
    } = {}
): YJSArtifactHook => {
    const {
        enableCollaboration = true,
        syncIntervalMs = 5000,
    } = options;

    // State
    const [doc, setDoc] = useState<YDoc | null>(null);
    const [provider, setProvider] = useState<ElectricProvider | null>(null);
    const [awareness, setAwareness] = useState<Awareness | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collaborativeData, setCollaborativeData] = useState<any>(null);
    const [docLoaded, setDocLoaded] = useState(false);

    // Refs for cleanup
    const projectData = useProjectData();
    const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const providerRef = useRef<ElectricProvider | null>(null);
    const databaseProviderRef = useRef<IndexeddbPersistence | null>(null);
    const resumeStateProviderRef = useRef<LocalStorageResumeStateProvider | null>(null);
    const isInitializedRef = useRef<boolean>(false);
    const collaborativeDataRef = useRef<any>(null);
    const currentArtifactIdRef = useRef<string | null>(null);

    // Get artifact from project data
    const artifact = projectData.artifacts && Array.isArray(projectData.artifacts)
        ? projectData.artifacts.find((a: any) => a.id === artifactId)
        : null;

    // Initialize YJS document and Electric provider (following Electric YJS example pattern)
    useEffect(() => {
        if (!artifactId || !enableCollaboration) {
            setIsLoading(false);
            return;
        }

        // Don't initialize if we don't have artifact yet, but don't block on artifact data changes
        if (!artifact) {
            return;
        }

        // Reset if artifact ID changed
        if (currentArtifactIdRef.current !== artifactId) {
            isInitializedRef.current = false;
            collaborativeDataRef.current = null;
            currentArtifactIdRef.current = artifactId;
        }

        // Only initialize once per artifact ID to prevent state conflicts
        if (isInitializedRef.current) {
            return;
        }

        let cleanup: (() => void) | null = null;

        const initializeYJS = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Load modules dynamically (same as Electric YJS example)
                const [Y, { ElectricProvider, LocalStorageResumeStateProvider }, { Awareness }, { IndexeddbPersistence }, decoding] = await Promise.all([
                    import('yjs'),
                    import('@electric-sql/y-electric'),
                    import('y-protocols/awareness'),
                    import('y-indexeddb'),
                    import('lib0/decoding')
                ]);

                // Set up parser function (same as Electric YJS example)
                parseToDecoder = {
                    bytea: (hexString: string) => {
                        const cleanHexString = hexString.startsWith('\\x')
                            ? hexString.slice(2)
                            : hexString;
                        const uint8Array = new Uint8Array(
                            cleanHexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
                        );
                        return decoding.createDecoder(uint8Array);
                    },
                };

                // Create YJS document (same pattern as Electric YJS example)
                const yjsDoc = new Y.Doc();

                // Create awareness (same pattern as Electric YJS example)
                const awarenessInstance = new Awareness(yjsDoc);

                // Set user info for awareness (same pattern as Electric YJS example)
                awarenessInstance.setLocalStateField('user', {
                    name: 'User', // TODO: Get from auth context
                    color: '#1890ff',
                    colorLight: '#1890ff33',
                });

                // Create IndexedDB persistence (same pattern as Electric YJS example)
                const databaseProvider = new IndexeddbPersistence(`artifact-${artifactId}`, yjsDoc);
                databaseProviderRef.current = databaseProvider;

                // Create resume state provider (same pattern as Electric YJS example)
                const resumeStateProvider = new LocalStorageResumeStateProvider(`artifact-${artifactId}`);
                resumeStateProviderRef.current = resumeStateProvider;

                // Wait for persistence to load (same pattern as Electric YJS example)
                await new Promise<void>((resolve) => {
                    databaseProvider.once('synced', () => {
                        setDocLoaded(true);
                        resolve();
                    });
                });

                // Initialize document with artifact data if empty
                const yMap = yjsDoc.getMap('content');
                if (yMap.size === 0 && artifact.data) {

                    let artifactData: any = artifact.data;
                    if (typeof artifactData === 'string') {
                        try {
                            artifactData = JSON.parse(artifactData);
                        } catch (err) {
                            console.error('Failed to parse artifact data:', err);
                            artifactData = {} as any;
                        }
                    }

                    // Populate YJS document (simplified approach)
                    if (artifactData && typeof artifactData === 'object' && !Array.isArray(artifactData)) {
                        Object.entries(artifactData as Record<string, any>).forEach(([key, value]) => {
                            if (typeof value === 'string') {
                                const yText = new Y.Text();
                                yText.insert(0, value);
                                yMap.set(key, yText);
                            } else if (Array.isArray(value)) {
                                const yArray = new Y.Array();
                                value.forEach((item: any) => {
                                    if (typeof item === 'string') {
                                        const yText = new Y.Text();
                                        yText.insert(0, item);
                                        yArray.push([yText]);
                                    } else {
                                        yArray.push([item]);
                                    }
                                });
                                yMap.set(key, yArray);
                            } else {
                                yMap.set(key, value);
                            }
                        });
                    }
                }

                // Get Electric config (use our existing proxy endpoint)
                const electricConfig = createElectricConfigWithDebugAuth();
                const room = `artifact-${artifactId}`;

                // Set up Electric provider options (exact pattern from Electric YJS example)
                const electricOptions = {
                    doc: yjsDoc,
                    documentUpdates: {
                        shape: {
                            url: electricConfig.url, // Use our proxy endpoint
                            params: {
                                table: 'artifact_yjs_documents',
                                where: `artifact_id = '${artifactId}'`,
                            },
                            parser: parseToDecoder,
                        },
                        sendUrl: new URL(`/api/yjs/update?artifact_id=${artifactId}`, window.location.origin),
                        getUpdateFromRow: (row: any) => row.update,
                    },
                    awarenessUpdates: {
                        shape: {
                            url: electricConfig.url, // Use our proxy endpoint
                            params: {
                                table: 'artifact_yjs_awareness',
                                where: `artifact_id = '${artifactId}'`,
                            },
                            parser: parseToDecoder,
                        },
                        sendUrl: new URL(`/api/yjs/update?artifact_id=${artifactId}&client_id=${yjsDoc.clientID}`, window.location.origin),
                        protocol: awarenessInstance,
                        getUpdateFromRow: (row: any) => row.update,
                    },
                    resumeState: resumeStateProvider.load(),
                };

                // Create Electric provider (same pattern as Electric YJS example)
                const electricProvider = new ElectricProvider(electricOptions);
                providerRef.current = electricProvider;

                // Subscribe to resume state changes (same pattern as Electric YJS example)
                const resumeStateUnsubscribe = resumeStateProvider.subscribeToResumeState(electricProvider);

                // Set up event handlers (same pattern as Electric YJS example)
                const statusHandler = ({ status }: { status: 'connected' | 'disconnected' | 'connecting' }) => {
                    setIsConnected(status === 'connected');
                };

                electricProvider.on('status', statusHandler);

                electricProvider.on('synced', (synced: boolean) => {
                });

                // Set up document change listener for local data updates
                const updateCollaborativeData = () => {
                    const result: any = {};
                    yMap.forEach((value: any, key: string) => {
                        if (value && typeof value.toString === 'function') {
                            result[key] = value.toString();
                        } else if (value && typeof value.toArray === 'function') {
                            result[key] = value.toArray().map((item: any) => {
                                if (item && typeof item.toString === 'function') {
                                    return item.toString();
                                }
                                return item;
                            });
                        } else {
                            result[key] = value;
                        }
                    });
                    collaborativeDataRef.current = result;
                    setCollaborativeData(result);
                };

                yMap.observe(updateCollaborativeData);
                updateCollaborativeData(); // Initial update

                // NOTE: Electric provider handles syncing automatically
                // No periodic sync needed - this was causing infinite loops

                // Set state
                setDoc(yjsDoc);
                setProvider(electricProvider);
                setAwareness(awarenessInstance);
                setIsLoading(false);

                // Mark as initialized to prevent re-initialization
                isInitializedRef.current = true;

                // Setup cleanup (same pattern as Electric YJS example)
                cleanup = () => {

                    yMap.unobserve(updateCollaborativeData);
                    electricProvider.off('status', statusHandler);
                    electricProvider.destroy();
                    resumeStateUnsubscribe();
                    databaseProvider.destroy();

                    setDoc(null);
                    setProvider(null);
                    setAwareness(null);
                    setIsConnected(false);
                    setCollaborativeData(null);
                    setDocLoaded(false);

                    // Reset initialization flag for potential re-initialization
                    isInitializedRef.current = false;
                    collaborativeDataRef.current = null;
                };

                cleanupRef.current = cleanup;

            } catch (err) {
                console.error('Failed to initialize YJS:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize collaboration');
                setIsLoading(false);
            }
        };

        initializeYJS();

        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [artifactId, enableCollaboration]); // Removed artifact and syncIntervalMs to prevent re-initialization loops

    // Update field in YJS document
    const updateField = useCallback((field: string, value: any) => {
        if (!doc || !docLoaded) {
            return;
        }

        // Don't update with undefined or null values
        if (value === undefined || value === null) {
            return;
        }

        const yMap = doc.getMap('content');

        doc.transact(() => {
            if (typeof value === 'string') {
                let yText = yMap.get(field);
                if (!yText || typeof yText.toString !== 'function') {
                    // Import Y dynamically to get the Text constructor
                    import('yjs').then(Y => {
                        yText = new Y.Text();
                        yText.insert(0, value);
                        yMap.set(field, yText);
                    });
                } else {
                    yText.delete(0, yText.length);
                    yText.insert(0, value);
                }
            } else if (Array.isArray(value)) {
                import('yjs').then(Y => {
                    let yArray = yMap.get(field);
                    if (!yArray || typeof yArray.toArray !== 'function') {
                        yArray = new Y.Array();
                        yMap.set(field, yArray);
                    }
                    yArray.delete(0, yArray.length);
                    value.forEach((item) => {
                        if (typeof item === 'string') {
                            const yText = new Y.Text();
                            yText.insert(0, item);
                            yArray.push([yText]);
                        } else {
                            yArray.push([item]);
                        }
                    });
                });
            } else {
                yMap.set(field, value);
            }
        });
    }, [doc, docLoaded]);

    // Update multiple fields
    const updateFields = useCallback((updates: Record<string, any>) => {
        Object.entries(updates).forEach(([field, value]) => {
            updateField(field, value);
        });
    }, [updateField]);

    // Manual sync method (not needed with Electric provider, but kept for compatibility)
    const syncToArtifact = useCallback(async () => {
        // Electric provider handles syncing automatically
    }, []);

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

        // Data access (prioritize collaborative data when YJS is active and has data)
        data: (enableCollaboration && docLoaded && (collaborativeData || collaborativeDataRef.current))
            ? (collaborativeData || collaborativeDataRef.current)
            : artifact?.data,
        artifact,

        // Update methods
        updateField,
        updateFields,

        // Utility methods
        syncToArtifact,
        cleanup,

        // Collaboration features
        isCollaborative: enableCollaboration && !!provider && docLoaded,
        awareness,
    };
};