import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { createElectricConfigWithDebugAuth } from '../../common/config/electric';

// Global registry to track YJS document initialization state
const globalYJSRegistry = new Map<string, {
    isInitialized: boolean;
    isInitializing: boolean;
    doc: any | null;
    provider: any | null;
    awareness: any | null;
    collaborativeData: any | null;
    callbacks: Set<(data: any) => void>;
}>();

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

    console.log(`[useYJSArtifact] Hook called for artifact ${artifactId}, enableCollaboration: ${enableCollaboration}`);

    // State management
    const [doc, setDoc] = useState<YDoc | null>(null);
    const [provider, setProvider] = useState<ElectricProvider | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collaborativeData, setCollaborativeData] = useState<any>(null);
    const [awareness, setAwareness] = useState<Awareness | null>(null);

    // Refs for accessing current values in callbacks
    const cleanupRef = useRef<(() => void) | null>(null);
    const callbackRef = useRef<((data: any) => void) | null>(null);
    const docRef = useRef<YDoc | null>(null);
    const enableCollaborationRef = useRef(enableCollaboration);

    // Update refs when values change
    useEffect(() => {
        docRef.current = doc;
    }, [doc]);

    useEffect(() => {
        enableCollaborationRef.current = enableCollaboration;
    }, [enableCollaboration]);

    // Refs for cleanup
    const projectData = useProjectData();
    const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
    const providerRef = useRef<ElectricProvider | null>(null);
    const databaseProviderRef = useRef<IndexeddbPersistence | null>(null);
    const resumeStateProviderRef = useRef<LocalStorageResumeStateProvider | null>(null);

    // Get artifact from project data
    const artifact = projectData.artifacts && Array.isArray(projectData.artifacts)
        ? projectData.artifacts.find((a: any) => a.id === artifactId)
        : null;

    // Debug logging for artifact state
    useEffect(() => {
        console.log(`[useYJSArtifact] Artifact state for ${artifactId}:`, {
            hasArtifact: !!artifact,
            artifactData: artifact?.data,
            projectDataState: projectData.artifacts === "pending" ? "pending" : "loaded"
        });
    }, [artifactId, artifact, projectData.artifacts]);

    // Initialize YJS document and Electric provider (following Electric YJS example pattern)
    useEffect(() => {
        if (!artifactId || !enableCollaboration) {
            console.log(`[useYJSArtifact] Skipping initialization: artifactId=${artifactId}, enableCollaboration=${enableCollaboration}`);
            setIsLoading(false);
            return;
        }

        // Don't initialize if we don't have artifact yet, but don't block on artifact data changes
        if (!artifact) {
            console.log(`[useYJSArtifact] Waiting for artifact data for ${artifactId}`);
            return;
        }

        // Check global registry
        let registryEntry = globalYJSRegistry.get(artifactId);
        if (!registryEntry) {
            registryEntry = {
                isInitialized: false,
                isInitializing: false,
                doc: null,
                provider: null,
                awareness: null,
                collaborativeData: null,
                callbacks: new Set()
            };
            globalYJSRegistry.set(artifactId, registryEntry);
        }

        // Set up callback for data updates
        callbackRef.current = (data: any) => {
            console.log(`[useYJSArtifact] Received data update for ${artifactId}:`, data);
            setCollaborativeData(data);
        };
        registryEntry.callbacks.add(callbackRef.current);

        // If already initialized, use existing data
        if (registryEntry.isInitialized) {
            console.log(`[useYJSArtifact] Already initialized for ${artifactId}, using existing data`);
            setDoc(registryEntry.doc);
            setProvider(registryEntry.provider);
            setAwareness(registryEntry.awareness);
            setCollaborativeData(registryEntry.collaborativeData);
            setIsLoading(false);
            return;
        }

        // If currently initializing, wait for completion
        if (registryEntry.isInitializing) {
            console.log(`[useYJSArtifact] Already initializing for ${artifactId}, waiting...`);
            return;
        }

        // Start initialization
        registryEntry.isInitializing = true;
        let cleanup: (() => void) | null = null;

        const initializeYJS = async () => {
            try {
                console.log(`[useYJSArtifact] Starting YJS initialization for ${artifactId}`);
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

                console.log(`[useYJSArtifact] YJS modules loaded for ${artifactId}`);

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
                console.log(`[useYJSArtifact] YJS document created for ${artifactId}`);

                // Create awareness (same pattern as Electric YJS example)
                const awarenessInstance = new Awareness(yjsDoc);

                // Set user info for awareness (same pattern as Electric YJS example)
                awarenessInstance.setLocalStateField('user', {
                    name: 'User', // TODO: Get from auth context
                    color: '#1890ff',
                    colorLight: '#1890ff33',
                });

                console.log(`[useYJSArtifact] Awareness created for ${artifactId}`);

                // Create IndexedDB persistence (same pattern as Electric YJS example)
                const databaseProvider = new IndexeddbPersistence(`artifact-${artifactId}`, yjsDoc);
                databaseProviderRef.current = databaseProvider;

                // Create resume state provider (same pattern as Electric YJS example)
                const resumeStateProvider = new LocalStorageResumeStateProvider(`artifact-${artifactId}`);
                resumeStateProviderRef.current = resumeStateProvider;

                console.log(`[useYJSArtifact] Persistence providers created for ${artifactId}`);

                // Wait for persistence to load (same pattern as Electric YJS example)
                await new Promise<void>((resolve) => {
                    databaseProvider.once('synced', () => {
                        console.log(`[useYJSArtifact] IndexedDB synced for ${artifactId}`);
                        resolve();
                    });
                });

                // Initialize document with artifact data if empty
                const yMap = yjsDoc.getMap('content');
                console.log(`[useYJSArtifact] YJS map size: ${yMap.size} for ${artifactId}`);

                if (yMap.size === 0 && artifact.data) {
                    console.log(`[useYJSArtifact] Initializing YJS document with artifact data for ${artifactId}`);

                    let artifactData: any = artifact.data;
                    if (typeof artifactData === 'string') {
                        try {
                            artifactData = JSON.parse(artifactData);
                            console.log(`[useYJSArtifact] Parsed artifact data:`, artifactData);
                        } catch (err) {
                            console.error(`[useYJSArtifact] Failed to parse artifact data:`, err);
                            artifactData = {} as any;
                        }
                    }

                    // Populate YJS document (simplified approach)
                    if (artifactData && typeof artifactData === 'object' && !Array.isArray(artifactData)) {
                        Object.entries(artifactData as Record<string, any>).forEach(([key, value]) => {
                            console.log(`[useYJSArtifact] Setting YJS field ${key} = ${JSON.stringify(value)}`);
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
                    console.log(`[useYJSArtifact] YJS document initialized with ${yMap.size} fields`);
                }

                // Set up Electric provider (same pattern as Electric YJS example)
                const electricConfig = createElectricConfigWithDebugAuth();

                // Set up Electric provider options (exact pattern from Electric YJS example)
                const electricOptions = {
                    doc: yjsDoc,
                    documentUpdates: {
                        shape: {
                            url: electricConfig.url,
                            params: {
                                table: 'artifact_yjs_documents',
                                where: `artifact_id = '${artifactId}'`,
                            },
                            headers: electricConfig.headers || {},
                        },
                        parser: parseToDecoder,
                        sendUrl: new URL(`/api/yjs/update?artifact_id=${artifactId}`, window.location.origin),
                        getUpdateFromRow: (row: any) => row.update,
                    },
                    awarenessUpdates: {
                        shape: {
                            url: electricConfig.url,
                            params: {
                                table: 'artifact_yjs_awareness',
                                where: `artifact_id = '${artifactId}'`,
                            },
                            headers: electricConfig.headers || {},
                        },
                        parser: parseToDecoder,
                        sendUrl: new URL(`/api/yjs/update?artifact_id=${artifactId}&client_id=${yjsDoc.clientID}`, window.location.origin),
                        protocol: awarenessInstance,
                        getUpdateFromRow: (row: any) => row.update,
                    },
                    resumeState: resumeStateProvider.load(),
                };

                // Create Electric provider (same pattern as Electric YJS example)
                const electricProvider = new ElectricProvider(electricOptions);
                providerRef.current = electricProvider;

                console.log(`[useYJSArtifact] Electric provider created for ${artifactId}`);

                // Subscribe to resume state changes (same pattern as Electric YJS example)
                const resumeStateUnsubscribe = resumeStateProvider.subscribeToResumeState(electricProvider);

                // Store references in registry
                const currentRegistry = globalYJSRegistry.get(artifactId)!;
                currentRegistry.doc = yjsDoc;
                currentRegistry.provider = electricProvider;
                currentRegistry.awareness = awarenessInstance;

                // Store references in component state
                setDoc(yjsDoc);
                setProvider(electricProvider);
                setAwareness(awarenessInstance);

                // Set up connection status handler
                const statusHandler = ({ status }: { status: 'connected' | 'disconnected' | 'connecting' }) => {
                    console.log(`[useYJSArtifact] Connection status changed to ${status} for ${artifactId}`);
                    setIsConnected(status === 'connected');
                };

                electricProvider.on('status', statusHandler);

                // Set up data update handler
                const updateCollaborativeData = () => {
                    console.log(`[useYJSArtifact] YJS data updated for ${artifactId}`);
                    const yMap = yjsDoc.getMap('content');
                    const data: any = {};

                    // Convert YJS data to regular object
                    yMap.forEach((value: any, key: string) => {
                        if (value && typeof value.toString === 'function') {
                            // Handle YText
                            data[key] = value.toString();
                        } else if (value && typeof value.toArray === 'function') {
                            // Handle YArray
                            data[key] = value.toArray().map((item: any) => {
                                if (item && typeof item.toString === 'function') {
                                    return item.toString();
                                }
                                return item;
                            });
                        } else {
                            // Handle regular values
                            data[key] = value;
                        }
                    });

                    console.log(`[useYJSArtifact] Converted YJS data:`, data);

                    // Update registry
                    currentRegistry.collaborativeData = data;

                    // Notify all callbacks
                    currentRegistry.callbacks.forEach(callback => {
                        try {
                            callback(data);
                        } catch (err) {
                            console.error(`[useYJSArtifact] Error in callback:`, err);
                        }
                    });
                };

                // Set up YJS document observer
                yMap.observe(updateCollaborativeData);

                // Initial data update
                updateCollaborativeData();

                // Set up cleanup
                cleanup = () => {
                    console.log(`[useYJSArtifact] Cleaning up YJS for ${artifactId}`);
                    electricProvider.off('status', statusHandler);
                    yMap.unobserve(updateCollaborativeData);
                    electricProvider.destroy();
                    resumeStateUnsubscribe();
                    databaseProvider.destroy();
                    yjsDoc.destroy();

                    // Clean up registry
                    globalYJSRegistry.delete(artifactId);
                };

                cleanupRef.current = cleanup;
                currentRegistry.isInitialized = true;
                currentRegistry.isInitializing = false;
                setIsLoading(false);

                console.log(`[useYJSArtifact] YJS initialization complete for ${artifactId}`);

            } catch (err) {
                console.error(`[useYJSArtifact] Error initializing YJS for ${artifactId}:`, err);
                setError(err instanceof Error ? err.message : 'Failed to initialize YJS');
                setIsLoading(false);

                // Reset registry state on error
                const currentRegistry = globalYJSRegistry.get(artifactId);
                if (currentRegistry) {
                    currentRegistry.isInitializing = false;
                }
            }
        };

        initializeYJS();

        return () => {
            if (cleanup) {
                cleanup();
            }

            // Remove callback from registry
            const currentRegistry = globalYJSRegistry.get(artifactId);
            if (currentRegistry && callbackRef.current) {
                currentRegistry.callbacks.delete(callbackRef.current);
            }
        };
    }, [artifactId, enableCollaboration]);

    // Update field in YJS document
    const updateField = useCallback((field: string, value: any) => {
        console.log(`[useYJSArtifact] updateField called: ${field} = ${JSON.stringify(value)} for ${artifactId}`);

        if (!docRef.current || !enableCollaborationRef.current) {
            console.log(`[useYJSArtifact] Cannot update field - no doc or collaboration disabled`);
            return;
        }

        try {
            const yMap = docRef.current.getMap('content');
            console.log(`[useYJSArtifact] Current YJS map size: ${yMap.size}`);

            if (typeof value === 'string') {
                const yText = yMap.get(field) || new (docRef.current.constructor as any).Text();
                if (!yMap.has(field)) {
                    yMap.set(field, yText);
                }
                yText.delete(0, yText.length);
                yText.insert(0, value);
                console.log(`[useYJSArtifact] Updated YText field ${field} with: ${value}`);
            } else if (Array.isArray(value)) {
                const yArray = yMap.get(field) || new (docRef.current.constructor as any).Array();
                if (!yMap.has(field)) {
                    yMap.set(field, yArray);
                }
                yArray.delete(0, yArray.length);
                value.forEach((item: any) => {
                    if (typeof item === 'string') {
                        const yText = new (docRef.current.constructor as any).Text();
                        yText.insert(0, item);
                        yArray.push([yText]);
                    } else {
                        yArray.push([item]);
                    }
                });
                console.log(`[useYJSArtifact] Updated YArray field ${field} with: ${JSON.stringify(value)}`);
            } else {
                yMap.set(field, value);
                console.log(`[useYJSArtifact] Updated direct field ${field} with: ${JSON.stringify(value)}`);
            }
        } catch (err) {
            console.error(`[useYJSArtifact] Error updating field ${field}:`, err);
        }
    }, [artifactId]);

    // Update multiple fields
    const updateFields = useCallback((updates: Record<string, any>) => {
        console.log(`[useYJSArtifact] updateFields called with:`, updates);
        Object.entries(updates).forEach(([field, value]) => {
            updateField(field, value);
        });
    }, [updateField]);

    // Sync to artifact (placeholder)
    const syncToArtifact = useCallback(async () => {
        console.log(`[useYJSArtifact] syncToArtifact called for ${artifactId}`);
        // Implementation would sync YJS data back to artifact
    }, [artifactId]);

    // Cleanup function
    const cleanup = useCallback(() => {
        console.log(`[useYJSArtifact] Manual cleanup called for ${artifactId}`);
        if (cleanupRef.current) {
            cleanupRef.current();
        }
    }, [artifactId]);

    // Determine data source
    const data = enableCollaboration ? collaborativeData : artifact?.data;

    // Debug logging for final state
    useEffect(() => {
        console.log(`[useYJSArtifact] Final state for ${artifactId}:`, {
            enableCollaboration,
            isLoading,
            isConnected,
            error,
            hasDoc: !!doc,
            hasProvider: !!provider,
            dataSource: enableCollaboration ? 'collaborative' : 'artifact',
            data
        });
    }, [artifactId, enableCollaboration, isLoading, isConnected, error, doc, provider, data]);

    return {
        doc,
        provider,
        isConnected,
        isLoading,
        error,
        data,
        artifact,
        updateField,
        updateFields,
        syncToArtifact,
        cleanup,
        isCollaborative: enableCollaboration,
        awareness,
    };
};