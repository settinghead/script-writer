import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createElectricConfig, logElectricShapeInfo, isElectricDebugLoggingEnabled } from '../../common/config/electric';
import { apiService } from '../services/apiService';
import type {
    ProjectDataContextType,
    ElectricArtifact,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput,
    ElectricLLMPrompt,
    ElectricLLMTransform,
    CreateTransformRequest,
    UpdateArtifactRequest,
    SchemaTransformRequest
} from '../../common/types';

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

interface ProjectDataProviderProps {
    projectId: string;
    children: React.ReactNode;
}

// Utility function to wait for Electric sync confirmation
const waitForElectricSync = async (
    expectedId: string,
    tableName: string,
    timeout: number = 5000
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Electric sync timeout for ${tableName}:${expectedId}`));
        }, timeout);

        // In a real implementation, we'd listen to the Electric stream
        // For now, we'll use a simple timeout
        setTimeout(() => {
            clearTimeout(timeoutId);
            resolve();
        }, 500); // Assume sync happens quickly
    });
};

export const ProjectDataProvider: React.FC<ProjectDataProviderProps> = ({
    projectId,
    children
}) => {
    const queryClient = useQueryClient();
    const [localUpdates, setLocalUpdates] = useState<Map<string, any>>(new Map());

    // Create AbortController for cleanup
    const abortControllerRef = useRef<AbortController>();

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

    // Log shape info for debugging
    const lastProjectIdRef = useRef<string>();
    const renderCountRef = useRef<number>(0);
    renderCountRef.current++;



    // Stable configuration objects to prevent unnecessary re-subscriptions
    const artifactsConfig = useMemo(() => {
        return {
            ...electricConfig,
            params: {
                table: 'artifacts',
                where: projectWhereClause,
            },
            onError: (error: any) => handleElectricError(error, 'artifacts'),
            backoffOptions: {
                initialDelay: 200,
                maxDelay: 5000,
                multiplier: 2.0,
                maxRetries: 3
            }
        };
    }, [electricConfig, projectWhereClause]); // Removed handleElectricError from deps

    // Electric SQL subscriptions
    const { data: artifacts, isLoading: artifactsLoading, error: artifactsError } = useShape<ElectricArtifact>(artifactsConfig);


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
    const isLoading = artifactsLoading || transformsLoading || humanTransformsLoading ||
        transformInputsLoading || transformOutputsLoading || llmPromptsLoading || llmTransformsLoading;

    // Aggregate error state
    const error = artifactsError || transformsError || null;
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

    // Memoized selectors
    const selectors = useMemo(() => ({
        getBrainstormArtifacts: () =>
            artifacts?.filter(a => a.type === 'brainstorm_idea_collection') || [],

        getOutlineArtifacts: () =>
            artifacts?.filter(a => a.type === 'outline_input' || a.type === 'outline_response') || [],

        getArtifactById: (id: string) => {
            // Check local updates first, then Electric data
            const localUpdate = localUpdates.get(`artifact-${id}`);
            const baseArtifact = artifacts?.find(a => a.id === id);
            if (localUpdate && baseArtifact) {
                return { ...baseArtifact, ...localUpdate };
            }
            return baseArtifact;
        },

        getTransformById: (id: string) => {
            const localUpdate = localUpdates.get(`transform-${id}`);
            const baseTransform = transforms?.find(t => t.id === id);
            if (localUpdate && baseTransform) {
                return { ...baseTransform, ...localUpdate };
            }
            return baseTransform;
        },

        getHumanTransformsForArtifact: (artifactId: string, path?: string) =>
            humanTransforms?.filter(ht =>
                ht.source_artifact_id === artifactId &&
                (!path || ht.derivation_path === path)
            ) || [],

        getTransformInputsForTransform: (transformId: string) =>
            transformInputs?.filter(ti => ti.transform_id === transformId) || [],

        getTransformOutputsForTransform: (transformId: string) =>
            transformOutputs?.filter(to => to.transform_id === transformId) || []
    }), [artifacts, transforms, humanTransforms, transformInputs, transformOutputs, localUpdates]);

    // Mutations with optimistic updates
    const createTransformMutation = useMutation({
        mutationKey: ['create-transform', projectId],
        mutationFn: async (request: CreateTransformRequest) => {
            const response = await apiService.createTransform(request);
            await waitForElectricSync(response.transform.id, 'transforms');
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

    const updateArtifactMutation = useMutation({
        mutationKey: ['update-artifact', projectId],
        mutationFn: async (request: UpdateArtifactRequest) => {
            const response = await apiService.updateArtifact(request);
            await waitForElectricSync(request.artifactId, 'artifacts');
            return response;
        },
        onMutate: (request) => {
            const optimisticUpdate = {
                ...(request.data && { data: JSON.stringify(request.data) }),
                ...(request.metadata && { metadata: JSON.stringify(request.metadata) }),
                updated_at: new Date().toISOString()
            };
            addLocalUpdate(`artifact-${request.artifactId}`, optimisticUpdate);
            return optimisticUpdate;
        },
        onSuccess: (data, variables, optimisticData) => {
            removeLocalUpdate(`artifact-${variables.artifactId}`);
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        },
        onError: (error, variables, optimisticData) => {
            removeLocalUpdate(`artifact-${variables.artifactId}`);
            console.error('Failed to update artifact:', error);
        }
    });

    const createSchemaTransformMutation = useMutation({
        mutationKey: ['create-schema-transform', projectId],
        mutationFn: async (request: SchemaTransformRequest) => {
            const response = await fetch(`/api/artifacts/${request.sourceArtifactId}/schema-transform`, {
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
            await Promise.all([
                waitForElectricSync(result.transform.id, 'transforms'),
                waitForElectricSync(result.derivedArtifact.id, 'artifacts')
            ]);

            return result;
        },
        onMutate: (request) => {
            // Create optimistic updates for both transform and derived artifact
            const transformId = `temp-transform-${Date.now()}`;
            const artifactId = `temp-artifact-${Date.now()}`;

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

            const optimisticArtifact = {
                id: artifactId,
                project_id: projectId,
                type: 'user_input',
                type_version: 'v1',
                data: JSON.stringify(request.fieldUpdates),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            addLocalUpdate(`transform-${transformId}`, optimisticTransform);
            addLocalUpdate(`artifact-${artifactId}`, optimisticArtifact);

            return { transformId, artifactId };
        },
        onSuccess: (data, variables, optimisticData) => {
            if (optimisticData) {
                removeLocalUpdate(`transform-${optimisticData.transformId}`);
                removeLocalUpdate(`artifact-${optimisticData.artifactId}`);
            }
            queryClient.invalidateQueries({ queryKey: ['transforms'] });
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        },
        onError: (error, variables, optimisticData) => {
            if (optimisticData) {
                removeLocalUpdate(`transform-${optimisticData.transformId}`);
                removeLocalUpdate(`artifact-${optimisticData.artifactId}`);
            }
            console.error('Failed to create schema transform:', error);
        }
    });

    // Context value
    const contextValue: ProjectDataContextType = {
        // Data
        artifacts: artifacts || [],
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

        // Selectors
        ...selectors,

        // Mutations
        createTransform: createTransformMutation,
        updateArtifact: updateArtifactMutation,
        createSchemaTransform: createSchemaTransformMutation,

        // Local state management
        localUpdates,
        addLocalUpdate,
        removeLocalUpdate,
        hasLocalUpdate
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