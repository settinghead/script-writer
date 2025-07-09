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
    updateField: (field: string, value: any) => Promise<void>;
    updateFields: (updates: Record<string, any>) => Promise<void>;

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


    // State management
    const [doc, setDoc] = useState<YDoc | null>(null);
    const [provider, setProvider] = useState<ElectricProvider | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collaborativeData, setCollaborativeData] = useState<any>({});
    const [awareness, setAwareness] = useState<Awareness | null>(null);

    // Refs for stable references
    const cleanupRef = useRef<(() => void) | null>(null);
    const enableCollaborationRef = useRef(enableCollaboration);
    const docRef = useRef<YDoc | null>(null);
    const yMapRef = useRef<YMap | null>(null); // Store yMap reference
    const callbackRef = useRef<((data: any) => void) | null>(null); // Move to top level

    // Update refs when values change
    useEffect(() => {
        enableCollaborationRef.current = enableCollaboration;
    }, [enableCollaboration]);

    useEffect(() => {
        docRef.current = doc;
    }, [doc]);

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
            setCollaborativeData(data);
        };
        registryEntry.callbacks.add(callbackRef.current);

        // If already initialized, use existing data
        if (registryEntry.isInitialized) {
            setDoc(registryEntry.doc);
            setProvider(registryEntry.provider);
            setAwareness(registryEntry.awareness);
            setCollaborativeData(registryEntry.collaborativeData);
            setIsLoading(false);
            return;
        }

        // If currently initializing, wait for completion
        if (registryEntry.isInitializing) {
            return;
        }

        // Start initialization
        registryEntry.isInitializing = true;
        let cleanup: (() => void) | null = null;
        let updateHandler: (update: Uint8Array, origin: unknown) => void;

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
                yMapRef.current = yjsDoc.getMap('content'); // Store yMap reference

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
                        resolve();
                    });
                });

                // Initialize document with artifact data if empty
                const yMap = yMapRef.current;

                if (yMap && yMap.size === 0 && artifact.data) {

                    let artifactData: any = artifact.data;
                    if (typeof artifactData === 'string') {
                        try {
                            artifactData = JSON.parse(artifactData);
                        } catch (err) {
                            console.error(`[useYJSArtifact] Failed to parse artifact data:`, err);
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
                    setIsConnected(status === 'connected');
                };

                electricProvider.on('status', statusHandler);

                // Set up data update handler
                const updateCollaborativeData = () => {
                    const yMap = yMapRef.current;
                    if (!yMap) return;

                    const data: any = {};

                    // Convert YJS data to regular object
                    yMap.forEach((value: any, key: string) => {
                        if (value && typeof value.toArray === 'function') {
                            // Handle YArray first (before toString check)
                            const arrayItems = value.toArray();
                            data[key] = arrayItems.map((item: any) => {
                                if (typeof item === 'string') {
                                    // Handle direct string values
                                    try {
                                        // Try to parse as JSON for object arrays like characters
                                        return JSON.parse(item);
                                    } catch {
                                        // If not JSON, use as string (for string arrays like selling_points)
                                        return item;
                                    }
                                } else if (item && typeof item.toString === 'function') {
                                    const stringValue = item.toString();
                                    try {
                                        // Try to parse as JSON for nested objects
                                        return JSON.parse(stringValue);
                                    } catch {
                                        // If not JSON, use as string
                                        return stringValue;
                                    }
                                }
                                return item;
                            });
                        } else if (value && typeof value.toString === 'function') {
                            // Handle YText - check if it's JSON
                            const stringValue = value.toString();
                            try {
                                // Try to parse as JSON for nested objects
                                data[key] = JSON.parse(stringValue);
                            } catch {
                                // If not JSON, use as string
                                data[key] = stringValue;
                            }
                        } else {
                            // Handle regular values
                            data[key] = value;
                        }
                    });

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

                // Initialize YJS document with existing artifact data
                if (artifact?.data) {
                    try {
                        let artifactData: any = artifact.data;
                        if (typeof artifactData === 'string') {
                            artifactData = JSON.parse(artifactData);
                        }

                        // First, try to load saved YJS document state from server
                        let hasLoadedFromServer = false;
                        try {
                            const response = await fetch(`/api/yjs/document/${artifactId}`, {
                                method: 'GET',
                                headers: {
                                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                                }
                            });

                            if (response.ok) {
                                const savedState = await response.arrayBuffer();
                                if (savedState.byteLength > 0) {
                                    // Apply the saved state to the YJS document
                                    const update = new Uint8Array(savedState);
                                    Y.applyUpdate(yjsDoc, update, 'server');
                                    hasLoadedFromServer = true;
                                } else {
                                }
                            } else {
                            }
                        } catch (loadError) {
                            console.warn(`[useYJSArtifact] Failed to load saved YJS document state:`, loadError);
                        }

                        // If we didn't load from server, initialize with artifact data
                        if (!hasLoadedFromServer) {
                            // Use a transaction with origin to prevent these updates from being sent to server
                            yjsDoc.transact(() => {
                                // Populate YJS map with artifact data
                                Object.entries(artifactData).forEach(([key, value]) => {
                                    if (typeof value === 'string') {
                                        const yText = new Y.Text();
                                        yText.insert(0, value);
                                        yMap.set(key, yText);
                                    } else if (Array.isArray(value)) {
                                        const yArray = new Y.Array();
                                        value.forEach((item: any) => {
                                            if (typeof item === 'string') {
                                                // For string arrays like selling_points, satisfaction_points
                                                yArray.push([item]);
                                            } else if (typeof item === 'object' && item !== null) {
                                                // For object arrays like characters
                                                yArray.push([JSON.stringify(item)]);
                                            } else {
                                                yArray.push([item]);
                                            }
                                        });
                                        yMap.set(key, yArray);
                                    } else if (typeof value === 'object' && value !== null) {
                                        // For nested objects, store as JSON string for now
                                        const yText = new Y.Text();
                                        yText.insert(0, JSON.stringify(value));
                                        yMap.set(key, yText);
                                    } else {
                                        yMap.set(key, value);
                                    }
                                });
                            }, 'load-from-artifact');
                        }

                        // Set up YJS document update handler to send changes to server
                        updateHandler = (update: Uint8Array, origin: unknown) => {
                            // Don't send updates that originated from the server or initial loading (to avoid loops)
                            if (origin === 'server' || origin === 'load-from-server' || origin === 'load-from-artifact') {
                                return;
                            }

                            // Send update to server
                            fetch(`/api/yjs/update?artifact_id=${artifactId}`, {
                                method: 'PUT',
                                headers: {
                                    'Authorization': 'Bearer debug-auth-token-script-writer-dev',
                                    'Content-Type': 'application/octet-stream'
                                },
                                body: update
                            }).then(response => {
                                if (response.ok) {
                                } else {
                                }
                            }).catch(error => {
                            });
                        };

                        // Attach update handler to YJS document
                        yjsDoc.on('update', updateHandler);

                        // Note: We no longer need to manually send initial state since we use transaction origins
                        // The 'load-from-artifact' origin prevents initial data from being sent to server
                        if (hasLoadedFromServer) {
                        } else {
                            // Send the complete initial document state to server so backend can reconstruct properly
                            const Y = await import('yjs');
                            const fullDocumentState = Y.encodeStateAsUpdate(yjsDoc);

                            try {
                                const response = await fetch(`/api/yjs/update?artifact_id=${artifactId}`, {
                                    method: 'PUT',
                                    headers: {
                                        'Authorization': 'Bearer debug-auth-token-script-writer-dev',
                                        'Content-Type': 'application/octet-stream'
                                    },
                                    body: fullDocumentState
                                });

                                if (response.ok) {
                                } else {
                                }
                            } catch (error) {
                            }
                        }
                    } catch (error) {
                        console.error(`[useYJSArtifact] Error initializing YJS document with artifact data:`, error);
                    }
                }

                // Set up YJS document observer
                yMapRef.current?.observe(updateCollaborativeData);

                // Initial data update
                updateCollaborativeData();

                // Set up cleanup
                cleanup = () => {
                    electricProvider.off('status', statusHandler);
                    yMapRef.current?.unobserve(updateCollaborativeData);
                    // Remove update handler if it exists
                    if (updateHandler) {
                        yjsDoc.off('update', updateHandler);
                    }
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
    const updateField = useCallback(async (field: string, value: any) => {
        if (!docRef.current || !enableCollaborationRef.current) {
            console.warn(`[useYJSArtifact] Cannot update field - no doc or collaboration disabled`);
            return;
        }

        try {
            // Import YJS module dynamically to access classes
            const Y = await import('yjs');
            const yMap = yMapRef.current;

            console.log(`[useYJSArtifact] Updating field: ${field} with value:`, value);

            // Handle array index paths like "emotionArcs[0]"
            const arrayIndexMatch = field.match(/^(.+)\[(\d+)\]$/);
            if (arrayIndexMatch) {
                const [, arrayName, indexStr] = arrayIndexMatch;
                const index = parseInt(indexStr, 10);

                console.log(`[useYJSArtifact] Array index update: ${arrayName}[${index}]`);

                // Get or create the YJS array
                let yArray = yMap?.get(arrayName);
                if (!yArray) {
                    yArray = new Y.Array();
                    yMap?.set(arrayName, yArray);
                }

                // Ensure the array has enough elements
                while (yArray.length <= index) {
                    yArray.push(['']);
                }

                // Update the specific array element
                if (typeof value === 'string') {
                    const yText = new Y.Text();
                    yText.insert(0, value);
                    yArray.delete(index, 1);
                    yArray.insert(index, [yText]);
                } else if (typeof value === 'object' && value !== null) {
                    // For objects, store as JSON string
                    yArray.delete(index, 1);
                    yArray.insert(index, [JSON.stringify(value)]);
                } else {
                    yArray.delete(index, 1);
                    yArray.insert(index, [value]);
                }

                console.log(`[useYJSArtifact] Array updated: ${arrayName}[${index}] = `, value);
                return;
            }

            // Handle regular field updates
            if (typeof value === 'string') {
                const yText = yMap?.get(field) || new Y.Text();
                if (!yMap?.has(field)) {
                    yMap?.set(field, yText);
                }
                yText.delete(0, yText.length);
                yText.insert(0, value);
            } else if (Array.isArray(value)) {
                const yArray = yMap?.get(field) || new Y.Array();
                if (!yMap?.has(field)) {
                    yMap?.set(field, yArray);
                }
                yArray.delete(0, yArray.length);
                value.forEach((item: any) => {
                    if (typeof item === 'string') {
                        const yText = new Y.Text();
                        yText.insert(0, item);
                        yArray.push([yText]);
                    } else if (typeof item === 'object' && item !== null) {
                        // For object arrays like characters, store as JSON string (consistent with initialization)
                        yArray.push([JSON.stringify(item)]);
                    } else {
                        yArray.push([item]);
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                // For objects, store as JSON string in YText (same as initialization)
                const yText = yMap?.get(field) || new Y.Text();
                if (!yMap?.has(field)) {
                    yMap?.set(field, yText);
                }
                const jsonString = JSON.stringify(value);
                yText.delete(0, yText.length);
                yText.insert(0, jsonString);
            } else {
                // For primitive values (number, boolean, null)
                yMap?.set(field, value);
            }
        } catch (err) {
            console.error(`[useYJSArtifact] Error updating field ${field}:`, err);
        }
    }, [artifactId]);

    // Update multiple fields
    const updateFields = useCallback(async (updates: Record<string, any>) => {
        await Promise.all(
            Object.entries(updates).map(([field, value]) => updateField(field, value))
        );
    }, [updateField]);

    // Sync to artifact (now handled automatically by backend)
    const syncToArtifact = useCallback(async () => {
        // Note: Artifact syncing is now handled automatically by the backend
        // Every YJS update automatically syncs to the artifacts table
    }, [artifactId]);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (cleanupRef.current) {
            cleanupRef.current();
        }
    }, [artifactId]);

    // Determine data source
    const data = enableCollaboration ? collaborativeData : artifact?.data;


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