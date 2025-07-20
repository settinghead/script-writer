import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { createElectricConfigWithDebugAuth } from '../../../common/config/electric';
import { ElectricJsondoc } from '@/common/types';

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

export interface YJSJsondocHook {
    // YJS document and provider
    doc: YDoc | null;
    provider: ElectricProvider | null;

    // Connection state
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;

    // Data access
    data: any;
    jsondoc: ElectricJsondoc | null | undefined;

    // Update methods
    updateField: (field: string, value: any) => Promise<void>;
    updateFields: (updates: Record<string, any>) => Promise<void>;

    // Utility methods
    syncToJsondoc: () => Promise<void>;
    cleanup: () => void;

    // Collaboration features
    isCollaborative: boolean;
    awareness: Awareness | null;
}

export const useYJSJsondoc = (
    jsondocId: string,
    options: {
        enableCollaboration?: boolean;
        syncIntervalMs?: number;
    } = {}
): YJSJsondocHook => {
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

    // Get jsondoc from project data
    const jsondoc = projectData.jsondocs && Array.isArray(projectData.jsondocs)
        ? projectData.jsondocs.find((a) => a.id === jsondocId)
        : null;


    // Initialize YJS document and Electric provider (following Electric YJS example pattern)
    useEffect(() => {
        if (!jsondocId || !enableCollaboration) {
            setIsLoading(false);
            return;
        }

        // Don't initialize if we don't have jsondoc yet, but don't block on jsondoc data changes
        if (!jsondoc) {
            return;
        }

        // Check global registry
        let registryEntry = globalYJSRegistry.get(jsondocId);
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
            globalYJSRegistry.set(jsondocId, registryEntry);
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
                const databaseProvider = new IndexeddbPersistence(`jsondoc-${jsondocId}`, yjsDoc);
                databaseProviderRef.current = databaseProvider;

                // Create resume state provider (same pattern as Electric YJS example)
                const resumeStateProvider = new LocalStorageResumeStateProvider(`jsondoc-${jsondocId}`);
                resumeStateProviderRef.current = resumeStateProvider;


                // Wait for persistence to load (same pattern as Electric YJS example)
                await new Promise<void>((resolve) => {
                    databaseProvider.once('synced', () => {
                        resolve();
                    });
                });

                // This early initialization is removed - we'll do it later after Electric provider is set up

                // Set up Electric provider (same pattern as Electric YJS example)
                const electricConfig = createElectricConfigWithDebugAuth();

                // Set up Electric provider options (exact pattern from Electric YJS example)
                const electricOptions = {
                    doc: yjsDoc,
                    documentUpdates: {
                        shape: {
                            url: electricConfig.url,
                            params: {
                                table: 'jsondoc_yjs_documents',
                                where: `jsondoc_id = '${jsondocId}'`,
                            },
                            headers: electricConfig.headers || {},
                        },
                        parser: parseToDecoder,
                        sendUrl: new URL(`/api/yjs/update?jsondoc_id=${jsondocId}`, window.location.origin),
                        getUpdateFromRow: (row: any) => row.update,
                    },
                    awarenessUpdates: {
                        shape: {
                            url: electricConfig.url,
                            params: {
                                table: 'jsondoc_yjs_awareness',
                                where: `jsondoc_id = '${jsondocId}'`,
                            },
                            headers: electricConfig.headers || {},
                        },
                        parser: parseToDecoder,
                        sendUrl: new URL(`/api/yjs/update?jsondoc_id=${jsondocId}&client_id=${yjsDoc.clientID}`, window.location.origin),
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
                const currentRegistry = globalYJSRegistry.get(jsondocId)!;
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
                                const parsedValue = JSON.parse(stringValue);
                                data[key] = parsedValue;
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
                            console.error(`[useYJSJsondoc] Error in callback:`, err);
                        }
                    });
                };

                // Initialize YJS document with existing jsondoc data
                if (jsondoc?.data) {
                    try {
                        let jsondocData: any = jsondoc.data;
                        if (typeof jsondocData === 'string') {
                            jsondocData = JSON.parse(jsondocData);
                        }

                        // First, try to load saved YJS document state from server
                        let hasLoadedFromServer = false;
                        try {
                            const response = await fetch(`/api/yjs/document/${jsondocId}`, {
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
                                    Y.applyUpdate(yjsDoc, update, 'load-from-server');
                                    hasLoadedFromServer = true;
                                } else {
                                }
                            } else {
                            }
                        } catch (loadError) {
                            console.warn(`[useYJSJsondoc] Failed to load saved YJS document state:`, loadError);
                        }

                        // If we didn't load from server, initialize with jsondoc data
                        if (!hasLoadedFromServer) {
                            // Use a transaction with origin to prevent these updates from being sent to server
                            yjsDoc.transact(() => {
                                const yMap = yMapRef.current;
                                if (!yMap) return;

                                // Populate YJS map with jsondoc data
                                Object.entries(jsondocData).forEach(([key, value]) => {
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
                                        // For nested objects like target_audience, store as JSON string
                                        const yText = new Y.Text();
                                        yText.insert(0, JSON.stringify(value));
                                        yMap.set(key, yText);
                                    } else {
                                        yMap.set(key, value);
                                    }
                                });
                            }, 'load-from-jsondoc');
                        }

                        // Set up YJS document update handler to send changes to server
                        updateHandler = (update: Uint8Array, origin: unknown) => {
                            // Don't send updates that originated from the server or initial loading (to avoid loops)
                            if (origin === 'load-from-server' || origin === 'load-from-jsondoc') {
                                return;
                            }

                            // Send update to server
                            fetch(`/api/yjs/update?jsondoc_id=${jsondocId}`, {
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
                        // The 'load-from-jsondoc' origin prevents initial data from being sent to server
                        if (hasLoadedFromServer) {
                        } else {
                            // Send the complete initial document state to server so backend can reconstruct properly
                            const Y = await import('yjs');
                            const fullDocumentState = Y.encodeStateAsUpdate(yjsDoc);

                            try {
                                const response = await fetch(`/api/yjs/update?jsondoc_id=${jsondocId}`, {
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
                        console.error(`[useYJSJsondoc] Error initializing YJS document with jsondoc data:`, error);
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
                    globalYJSRegistry.delete(jsondocId);
                };

                cleanupRef.current = cleanup;
                currentRegistry.isInitialized = true;
                currentRegistry.isInitializing = false;
                setIsLoading(false);


            } catch (err) {
                console.error(`[useYJSJsondoc] Error initializing YJS for ${jsondocId}:`, err);
                setError(err instanceof Error ? err.message : 'Failed to initialize YJS');
                setIsLoading(false);

                // Reset registry state on error
                const currentRegistry = globalYJSRegistry.get(jsondocId);
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
            const currentRegistry = globalYJSRegistry.get(jsondocId);
            if (currentRegistry && callbackRef.current) {
                currentRegistry.callbacks.delete(callbackRef.current);
            }
        };
    }, [jsondocId, enableCollaboration]);

    // Update field in YJS document
    const updateField = useCallback(async (field: string, value: any) => {
        if (!docRef.current || !enableCollaborationRef.current) {
            console.warn(`[useYJSJsondoc] Cannot update field - no doc or collaboration disabled`);
            return;
        }

        try {
            // Import YJS module dynamically to access classes
            const Y = await import('yjs');
            const yMap = yMapRef.current;

            // Handle array index paths like "emotionArcs[0]" or "emotionArcs[0].characters"
            const arrayIndexMatch = field.match(/^(.+)\[(\d+)\](.*)$/);
            if (arrayIndexMatch) {
                const [, arrayName, indexStr, remainingPath] = arrayIndexMatch;
                const index = parseInt(indexStr, 10);

                // Get or create the YJS array
                let yArray = yMap?.get(arrayName);
                if (!yArray) {
                    yArray = new Y.Array();
                    yMap?.set(arrayName, yArray);
                }

                // Ensure the array has enough elements
                while (yArray.length <= index) {
                    yArray.push([JSON.stringify({})]);
                }

                // Get current array element
                let currentElement = yArray.get(index);
                if (typeof currentElement === 'string') {
                    try {
                        currentElement = JSON.parse(currentElement);
                    } catch (e) {
                        currentElement = {};
                    }
                } else if (!currentElement || typeof currentElement !== 'object') {
                    currentElement = {};
                }

                // If there's a remaining path (e.g., ".characters"), update nested property
                if (remainingPath) {
                    const nestedPath = remainingPath.startsWith('.') ? remainingPath.substring(1) : remainingPath;

                    // Use the same setValueByPath function from context
                    const setValueByPath = (obj: any, path: string, value: any): any => {
                        const keys = path.split(/[\.\[\]]/).filter(Boolean);
                        const result = { ...obj };
                        let current = result;

                        for (let i = 0; i < keys.length - 1; i++) {
                            const key = keys[i];
                            if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
                                current[key] = {};
                            } else {
                                current[key] = { ...current[key] };
                            }
                            current = current[key];
                        }

                        const lastKey = keys[keys.length - 1];
                        current[lastKey] = value;
                        return result;
                    };

                    currentElement = setValueByPath(currentElement, nestedPath, value);
                } else {
                    // Direct array element update
                    currentElement = value;
                }

                // Update the array element
                yArray.delete(index, 1);
                yArray.insert(index, [JSON.stringify(currentElement)]);

                return;
            }

            // Handle nested object paths like "target_audience.demographic"
            if (field.includes('.')) {
                const pathParts = field.split('.');
                const rootField = pathParts[0];
                const nestedPath = pathParts.slice(1).join('.');

                // Get the root object from YJS
                let rootObject = {};
                const yValue = yMap?.get(rootField);

                if (yValue && typeof yValue.toString === 'function') {
                    // It's a YText containing JSON
                    const jsonString = yValue.toString();
                    try {
                        rootObject = JSON.parse(jsonString);
                    } catch (e) {
                        console.warn(`[useYJSJsondoc] Failed to parse JSON for field ${rootField}:`, e);
                        rootObject = {};
                    }
                } else if (yValue && typeof yValue === 'object') {
                    // It's already an object
                    rootObject = yValue;
                }

                // Update the nested property
                const setValueByPath = (obj: any, path: string, value: any): any => {
                    const keys = path.split('.');
                    const result = { ...obj };
                    let current = result;

                    for (let i = 0; i < keys.length - 1; i++) {
                        const key = keys[i];
                        if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
                            current[key] = {};
                        } else {
                            current[key] = { ...current[key] };
                        }
                        current = current[key];
                    }

                    const lastKey = keys[keys.length - 1];
                    current[lastKey] = value;
                    return result;
                };

                const updatedObject = setValueByPath(rootObject, nestedPath, value);

                // Store the updated object back to YJS as JSON string
                const yText = yMap?.get(rootField) || new Y.Text();
                if (!yMap?.has(rootField)) {
                    yMap?.set(rootField, yText);
                }
                const jsonString = JSON.stringify(updatedObject);
                yText.delete(0, yText.length);
                yText.insert(0, jsonString);

                return;
            }

            // Handle regular field updates (no nesting)
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
            console.error(`[useYJSJsondoc] Error updating field ${field}:`, err);
        }
    }, [jsondocId]);

    // Update multiple fields
    const updateFields = useCallback(async (updates: Record<string, any>) => {
        await Promise.all(
            Object.entries(updates).map(([field, value]) => updateField(field, value))
        );
    }, [updateField]);

    // Sync to jsondoc (now handled automatically by backend)
    const syncToJsondoc = useCallback(async () => {
        // Note: Jsondoc syncing is now handled automatically by the backend
        // Every YJS update automatically syncs to the jsondocs table
    }, [jsondocId]);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (cleanupRef.current) {
            cleanupRef.current();
        }
    }, [jsondocId]);

    // Determine data source
    const data = enableCollaboration ? collaborativeData : jsondoc?.data;




    return {
        doc,
        provider,
        isConnected,
        isLoading,
        error,
        data,
        jsondoc,
        updateField,
        updateFields,
        syncToJsondoc,
        cleanup,
        isCollaborative: enableCollaboration,
        awareness,
    };
};