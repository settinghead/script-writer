import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { createElectricConfig, isElectricDebugLoggingEnabled } from '../../common/config/electric';
import { apiService } from '../services/apiService';
import {
    buildLineageGraph,
    LineageGraph,
    addLineageToJsonDocs,
    findLatestJsonDocForPath,
    getJsonDocAtPath,
    getLatestVersionForPath
} from '../../common/transform-jsonDoc-framework/lineageResolution';
import type {
    ProjectDataContextType,
    ElectricJsonDoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput,
    ElectricLLMPrompt,
    ElectricLLMTransform,
    CreateTransformRequest,
    UpdateJsonDocRequest,
    HumanTransformRequest
} from '../../common/types';

// Entity-specific mutation status tracking
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface EntityMutationState {
    status: MutationStatus;
    error?: string;
    timestamp?: number;
}

export interface MutationStateMap {
    jsonDocs: Map<string, EntityMutationState>;
    transforms: Map<string, EntityMutationState>;
    humanTransforms: Map<string, EntityMutationState>;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

interface ProjectDataProviderProps {
    projectId: string;
    children: React.ReactNode;
}

export const ProjectDataProvider: React.FC<ProjectDataProviderProps> = ({
    projectId,
    children
}) => {
    const queryClient = useQueryClient();
    const [localUpdates, setLocalUpdates] = useState<Map<string, any>>(new Map());

    // Entity-specific mutation state tracking
    const [mutationStates, setMutationStates] = useState<MutationStateMap>({
        jsonDocs: new Map(),
        transforms: new Map(),
        humanTransforms: new Map()
    });

    // Create AbortController for cleanup
    const abortControllerRef = useRef<AbortController | null>(null);

    // Initialize AbortController when projectId changes
    useEffect(() => {
        // Abort previous subscriptions
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new controller for this project
        abortControllerRef.current = new AbortController();

        // Cleanup on unmount or projectId change
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [projectId]);

    // Get authenticated Electric config with abort signal
    const electricConfig = useMemo(() => ({
        ...createElectricConfig(),
        signal: abortControllerRef.current?.signal
    }), [projectId]); // Re-create when projectId changes

    // Memoize where clause to prevent unnecessary re-renders
    const projectWhereClause = useMemo(() => `project_id = '${projectId}'`, [projectId]);

    // Enhanced error handler for Electric 409 conflicts - stable reference
    const handleElectricError = useRef((error: any, tableName: string) => {
        if (error?.status === 409) {
            if (isElectricDebugLoggingEnabled()) {
            }
            return;
        }


    }).current;

    // Stable configuration objects to prevent unnecessary re-subscriptions
    const jsonDocsConfig = useMemo(() => {
        return {
            ...electricConfig,
            params: {
                table: 'jsonDocs',
                where: projectWhereClause,
            },
            onError: (error: any) => handleElectricError(error, 'jsonDocs'),
            backoffOptions: {
                initialDelay: 200,
                maxDelay: 5000,
                multiplier: 2.0,
                maxRetries: 3
            }
        };
    }, [electricConfig, projectWhereClause]); // Removed handleElectricError from deps

    // Electric SQL subscriptions
    const { data: jsonDocs, isLoading: jsonDocsLoading, error: jsonDocsError } = useShape<ElectricJsonDoc & {
        [key: string]: any;
    }>(jsonDocsConfig);

    // Debug jsonDocs loading (removed for clarity)


    const transformsConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'transforms',
            where: projectWhereClause,
        },
        onError: (error: any) => handleElectricError(error, 'transforms'),
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const { data: transforms, isLoading: transformsLoading, error: transformsError } = useShape<ElectricTransform>(transformsConfig);

    const humanTransformsConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'human_transforms',
            where: projectWhereClause,
        },
        onError: (error: any) => handleElectricError(error, 'human_transforms'),
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const transformInputsConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'transform_inputs',
            where: projectWhereClause,
        },
        onError: (error: any) => handleElectricError(error, 'transform_inputs'),
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const transformOutputsConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'transform_outputs',
            where: projectWhereClause,
        },
        onError: (error: any) => handleElectricError(error, 'transform_outputs'),
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const llmPromptsConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'llm_prompts',
            where: projectWhereClause,
        },
        onError: (error: any) => handleElectricError(error, 'llm_prompts'),
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const llmTransformsConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'llm_transforms',
            where: projectWhereClause,
        },
        onError: (error: any) => handleElectricError(error, 'llm_transforms'),
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const { data: humanTransforms, isLoading: humanTransformsLoading } = useShape<ElectricHumanTransform>(humanTransformsConfig);
    const { data: transformInputs, isLoading: transformInputsLoading } = useShape<ElectricTransformInput>(transformInputsConfig);
    const { data: transformOutputs, isLoading: transformOutputsLoading } = useShape<ElectricTransformOutput>(transformOutputsConfig);
    const { data: llmPrompts, isLoading: llmPromptsLoading } = useShape<ElectricLLMPrompt>(llmPromptsConfig);
    const { data: llmTransforms, isLoading: llmTransformsLoading } = useShape<ElectricLLMTransform>(llmTransformsConfig);

    // Aggregate loading state
    const isLoading = jsonDocsLoading || transformsLoading || humanTransformsLoading ||
        transformInputsLoading || transformOutputsLoading || llmPromptsLoading || llmTransformsLoading;

    // Aggregate error state
    const error = jsonDocsError || transformsError || null;
    const isError = !!error;

    // Local state management functions
    const addLocalUpdate = useCallback((key: string, update: any) => {
        setLocalUpdates(prev => new Map(prev.set(key, update)));
    }, []);

    const removeLocalUpdate = useCallback((key: string) => {
        setLocalUpdates(prev => {
            const newMap = new Map(prev);
            newMap.delete(key);
            return newMap;
        });
    }, []);

    const hasLocalUpdate = useCallback((key: string) => {
        return localUpdates.has(key);
    }, [localUpdates]);

    // Mutation state management functions
    const setEntityMutationState = useCallback((
        entityType: keyof MutationStateMap,
        entityId: string,
        state: EntityMutationState
    ) => {
        setMutationStates(prev => ({
            ...prev,
            [entityType]: new Map(prev[entityType]).set(entityId, {
                ...state,
                timestamp: Date.now()
            })
        }));
    }, []);

    const clearEntityMutationState = useCallback((
        entityType: keyof MutationStateMap,
        entityId: string
    ) => {
        setMutationStates(prev => {
            const newMap = new Map(prev[entityType]);
            newMap.delete(entityId);
            return {
                ...prev,
                [entityType]: newMap
            };
        });
    }, []);

    // Auto-clear success states after a delay
    useEffect(() => {
        const clearSuccessStates = () => {
            const now = Date.now();
            const SUCCESS_CLEAR_DELAY = 2000; // 2 seconds

            setMutationStates(prev => {
                let hasChanges = false;
                const newStates = { ...prev };

                (['jsonDocs', 'transforms', 'humanTransforms'] as const).forEach(entityType => {
                    const newMap = new Map(prev[entityType]);

                    for (const [entityId, state] of newMap.entries()) {
                        if (state.status === 'success' &&
                            state.timestamp &&
                            now - state.timestamp > SUCCESS_CLEAR_DELAY) {
                            newMap.delete(entityId);
                            hasChanges = true;
                        }
                    }

                    if (hasChanges) {
                        newStates[entityType] = newMap;
                    }
                });

                return hasChanges ? newStates : prev;
            });
        };

        const interval = setInterval(clearSuccessStates, 500);
        return () => clearInterval(interval);
    }, []);

    // Auto-cleanup local updates when Electric SQL data matches
    // This implements the optimistic state pattern from Electric SQL write guide
    useEffect(() => {
        if (!jsonDocs) return;

        const updatesToRemove: string[] = [];

        // Check each local update against the latest Electric SQL data
        localUpdates.forEach((localUpdate, key) => {
            if (key.startsWith('jsonDoc-')) {
                const jsonDocId = key.replace('jsonDoc-', '');
                const baseJsonDoc = jsonDocs.find(a => a.id === jsonDocId);

                if (baseJsonDoc && localUpdate) {
                    // Check if Electric SQL data already contains the local update changes
                    let electricDataMatches = true;

                    if (localUpdate.data) {
                        // Compare the data field specifically
                        // Both local and electric data should be compared as objects for accurate comparison
                        let localData, electricData;

                        try {
                            localData = typeof localUpdate.data === 'string'
                                ? JSON.parse(localUpdate.data)
                                : localUpdate.data;
                            electricData = typeof baseJsonDoc.data === 'string'
                                ? JSON.parse(baseJsonDoc.data)
                                : baseJsonDoc.data;

                            // Deep comparison of objects
                            if (JSON.stringify(localData) !== JSON.stringify(electricData)) {
                                electricDataMatches = false;
                            }
                        } catch (err) {
                            // If parsing fails, fall back to string comparison
                            const localDataStr = typeof localUpdate.data === 'string' ? localUpdate.data : JSON.stringify(localUpdate.data);
                            const electricDataStr = baseJsonDoc.data;

                            if (localDataStr !== electricDataStr) {
                                electricDataMatches = false;
                            }
                        }
                    }

                    if (electricDataMatches) {
                        console.log(`[ProjectDataContext] Electric SQL data matches local update for ${jsonDocId}, scheduling cleanup`);
                        updatesToRemove.push(key);
                    }
                }
            }
        });

        // Remove matching local updates in a batch
        if (updatesToRemove.length > 0) {
            setLocalUpdates(prev => {
                const newMap = new Map(prev);
                updatesToRemove.forEach(key => newMap.delete(key));
                return newMap;
            });
        }
    }, [jsonDocs, localUpdates]);

    // Memoized lineage graph computation
    const lineageGraph = useMemo<LineageGraph | "pending">(() => {
        if (!jsonDocs || !transforms || !humanTransforms || !transformInputs || !transformOutputs) {
            return "pending" as const;
        }




        const graph = buildLineageGraph(
            jsonDocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );


        return graph;
    }, [jsonDocs, transforms, humanTransforms, transformInputs, transformOutputs]);

    // Remove brainstorm-specific logic - moved to brainstorm components

    // Memoized selectors
    const selectors = useMemo(() => ({
        // NEW: Collection-aware selectors
        getIdeaCollections: () =>
            jsonDocs?.filter(a => a.schema_type === 'brainstorm_collection' || a.type === 'brainstorm_idea_collection') || [],

        getJsonDocAtPath: (jsonDocId: string, jsonDocPath: string) => {
            const jsonDoc = jsonDocs?.find(a => a.id === jsonDocId);
            if (!jsonDoc) return null;
            return getJsonDocAtPath(jsonDoc, jsonDocPath);
        },

        getLatestVersionForPath: (jsonDocId: string, jsonDocPath: string) => {
            if (lineageGraph === "pending") {
                return null;
            }
            return getLatestVersionForPath(jsonDocId, jsonDocPath, lineageGraph);
        },


        getLineageGraph: () => lineageGraph,


        getJsonDocById: (id: string) => {
            // Check local updates first, then Electric data
            const localUpdate = localUpdates.get(`jsonDoc-${id}`);
            const baseJsonDoc = jsonDocs?.find(a => a.id === id);
            let jsonDoc = baseJsonDoc;

            if (localUpdate && baseJsonDoc) {
                // Always merge local updates with base jsonDoc for display
                // The cleanup logic is handled separately in useEffect
                jsonDoc = { ...baseJsonDoc, ...localUpdate };
            }

            if (!jsonDoc) return undefined;

            // Add lineage information
            if (lineageGraph === "pending") {
                return jsonDoc;
            }
            const jsonDocsWithLineage = addLineageToJsonDocs([jsonDoc], lineageGraph);
            return jsonDocsWithLineage[0];
        },

        getTransformById: (id: string) => {
            const localUpdate = localUpdates.get(`transform-${id}`);
            const baseTransform = transforms?.find(t => t.id === id);
            if (localUpdate && baseTransform) {
                return { ...baseTransform, ...localUpdate };
            }
            return baseTransform;
        },

        getHumanTransformsForJsonDoc: (jsonDocId: string, path?: string) =>
            humanTransforms?.filter(ht =>
                ht.source_jsonDoc_id === jsonDocId &&
                (!path || ht.derivation_path === path)
            ) || [],

        getTransformInputsForTransform: (transformId: string) =>
            transformInputs?.filter(ti => ti.transform_id === transformId) || [],

        getTransformOutputsForTransform: (transformId: string) =>
            transformOutputs?.filter(to => to.transform_id === transformId) || []
    }), [jsonDocs, transforms, humanTransforms, transformInputs, transformOutputs, localUpdates, lineageGraph]);

    // Mutations with optimistic updates
    const createTransformMutation = useMutation({
        mutationKey: ['create-transform', projectId],
        mutationFn: async (request: CreateTransformRequest) => {
            const response = await apiService.createTransform(request);
            // await waitForElectricSync(response.transform.id, 'transforms');
            return response;
        },
        onMutate: (request) => {
            const optimisticTransform = {
                id: `temp-${Date.now()}`,
                project_id: request.projectId,
                type: request.type,
                type_version: request.typeVersion || 'v1',
                status: request.status || 'running',
                retry_count: 0,
                max_retries: 2,
                execution_context: JSON.stringify(request.executionContext || {}),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            addLocalUpdate(`transform-${optimisticTransform.id}`, optimisticTransform);
            return optimisticTransform;
        },
        onSuccess: (data, variables, optimisticData) => {
            if (optimisticData) {
                removeLocalUpdate(`transform-${optimisticData.id}`);
            }
            queryClient.invalidateQueries({ queryKey: ['transforms'] });
        },
        onError: (error, variables, optimisticData) => {
            if (optimisticData) {
                removeLocalUpdate(`transform-${optimisticData.id}`);
            }
            console.error('Failed to create transform:', error);
        }
    });

    const updateJsonDocMutation = useMutation({
        mutationKey: ['update-jsonDoc', projectId],
        mutationFn: async (request: UpdateJsonDocRequest) => {
            // Set pending state for this specific jsonDoc
            setEntityMutationState('jsonDocs', request.jsonDocId, { status: 'pending' });

            const response = await apiService.updateJsonDoc(request);
            // await waitForElectricSync(request.jsonDocId, 'jsonDocs');
            return response;
        },
        onMutate: (request) => {
            const optimisticUpdate = {
                ...(request.data && { data: request.data }),
                ...(request.metadata && { metadata: request.metadata }),
                updated_at: new Date().toISOString()
            };
            addLocalUpdate(`jsonDoc-${request.jsonDocId}`, optimisticUpdate);
            return optimisticUpdate;
        },
        onSuccess: (data, variables, optimisticData) => {
            setEntityMutationState('jsonDocs', variables.jsonDocId, { status: 'success' });
            // Invalidate queries to trigger Electric SQL sync
            queryClient.invalidateQueries({ queryKey: ['jsonDocs'] });
            // Note: Local update will be automatically removed when Electric SQL data matches
        },
        onError: (error, variables, optimisticData) => {
            removeLocalUpdate(`jsonDoc-${variables.jsonDocId}`);
            setEntityMutationState('jsonDocs', variables.jsonDocId, {
                status: 'error',
                error: error.message
            });
            console.error('Failed to update jsonDoc:', error);
        }
    });

    const createHumanTransformMutation = useMutation({
        mutationKey: ['create-human-transform', projectId],
        mutationFn: async (request: HumanTransformRequest) => {
            // Set pending state for the source jsonDoc (the one being transformed)
            setEntityMutationState('jsonDocs', request.sourceJsonDocId, { status: 'pending' });

            const response = await fetch(`/api/jsonDocs/${request.sourceJsonDocId}/human-transform`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    transformName: request.transformName,
                    derivationPath: request.derivationPath,
                    fieldUpdates: request.fieldUpdates || {}
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Wait for Electric sync
            // await Promise.all([
            //     waitForElectricSync(result.transform.id, 'transforms'),
            //     waitForElectricSync(result.derivedJsonDoc.id, 'jsonDocs')
            // ]);

            return result;
        },
        onMutate: (request) => {
            // Create optimistic updates for both transform and derived jsonDoc
            const transformId = `temp-transform-${Date.now()}`;
            const jsonDocId = `temp-jsonDoc-${Date.now()}`;

            const optimisticTransform = {
                id: transformId,
                project_id: projectId,
                type: 'human' as const,
                type_version: 'v1',
                status: 'completed',
                retry_count: 0,
                max_retries: 2,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const optimisticJsonDoc = {
                id: jsonDocId,
                project_id: projectId,
                type: 'user_input',
                type_version: 'v1',
                data: request.fieldUpdates,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            addLocalUpdate(`transform-${transformId}`, optimisticTransform);
            addLocalUpdate(`jsonDoc-${jsonDocId}`, optimisticJsonDoc);

            return { transformId, jsonDocId, sourceJsonDocId: request.sourceJsonDocId };
        },
        onSuccess: (data, variables, optimisticData) => {
            if (optimisticData) {
                removeLocalUpdate(`transform-${optimisticData.transformId}`);
                removeLocalUpdate(`jsonDoc-${optimisticData.jsonDocId}`);
                // Set success state for the source jsonDoc
                setEntityMutationState('jsonDocs', optimisticData.sourceJsonDocId, { status: 'success' });
            }
            queryClient.invalidateQueries({ queryKey: ['transforms'] });
            queryClient.invalidateQueries({ queryKey: ['jsonDocs'] });
        },
        onError: (error, variables, optimisticData) => {
            if (optimisticData) {
                removeLocalUpdate(`transform-${optimisticData.transformId}`);
                removeLocalUpdate(`jsonDoc-${optimisticData.jsonDocId}`);
                // Set error state for the source jsonDoc
                setEntityMutationState('jsonDocs', optimisticData.sourceJsonDocId, {
                    status: 'error',
                    error: error.message
                });
            }
            console.error('Failed to create schema transform:', error);
        }
    });

    // Context value
    const contextValue: ProjectDataContextType = {
        // Data
        jsonDocs: jsonDocs || [],
        transforms: transforms || [],
        humanTransforms: humanTransforms || [],
        transformInputs: transformInputs || [],
        transformOutputs: transformOutputs || [],
        llmPrompts: llmPrompts || [],
        llmTransforms: llmTransforms || [],

        // Loading states
        isLoading,
        isError,
        error,

        // Lineage graph (globally shared)
        lineageGraph,

        // Selectors
        ...selectors,

        // Mutations
        createTransform: createTransformMutation,
        updateJsonDoc: updateJsonDocMutation,
        createHumanTransform: createHumanTransformMutation,

        // Local state management
        localUpdates,
        addLocalUpdate,
        removeLocalUpdate,
        hasLocalUpdate,

        // Mutation state management - expose the maps directly
        mutationStates,
        setEntityMutationState,
        clearEntityMutationState
    };

    return (
        <ProjectDataContext.Provider value={contextValue}>
            {children}
        </ProjectDataContext.Provider>
    );
};

// Hook to use the context
export const useProjectData = (): ProjectDataContextType => {
    const context = useContext(ProjectDataContext);
    if (context === undefined) {
        throw new Error('useProjectData must be used within a ProjectDataProvider');
    }
    return context;
};

export default ProjectDataContext; 