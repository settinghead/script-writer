import React, { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { useShape } from '@electric-sql/react';
import { createElectricConfig, logElectricShapeInfo, isElectricDebugLoggingEnabled } from '../../common/config/electric';
import { 
  ElectricArtifact, 
  ElectricTransform, 
  IdeaWithTitle
} from '../../common/types';

// Additional types for the context
export interface HumanTransform {
  transform_id: string;
  action_type: string;
  interface_context: string | null;
  change_description: string | null;
  source_artifact_id: string | null;
  derivation_path: string | null;
  derived_artifact_id: string | null;
  transform_name: string | null;
}

export interface TransformInput {
  id: number;
  transform_id: string;
  artifact_id: string;
  input_role: string | null;
}

export interface TransformOutput {
  id: number;
  transform_id: string;
  artifact_id: string;
  output_role: string | null;
}

export interface StreamingStatus {
  status: 'idle' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string | null;
}

export interface CreateSchemaTransformParams {
  transformName: string;
  sourceArtifactId: string;
  derivationPath: string;
  fieldUpdates?: Record<string, any>;
}

export interface CreateSchemaTransformResult {
  transform: any;
  derivedArtifact: any;
  wasTransformed: boolean;
}

export interface ProjectElectricContextValue {
  // Data
  artifacts: ElectricArtifact[];
  transforms: ElectricTransform[];
  humanTransforms: HumanTransform[];
  transformInputs: TransformInput[];
  transformOutputs: TransformOutput[];
  
  // Loading states
  isLoading: boolean;
  artifactsLoading: boolean;
  transformsLoading: boolean;
  humanTransformsLoading: boolean;
  transformInputsLoading: boolean;
  transformOutputsLoading: boolean;
  
  // Error states
  error: Error | null;
  artifactsError: Error | null;
  transformsError: Error | null;
  humanTransformsError: Error | null;
  transformInputsError: Error | null;
  transformOutputsError: Error | null;
  
  // Selectors (memoized)
  getArtifactById: (id: string) => ElectricArtifact | undefined;
  getArtifactsByType: (type: string) => ElectricArtifact[];
  getTransformsByArtifact: (artifactId: string) => ElectricTransform[];
  getHumanTransformsByPath: (artifactId: string, path: string) => HumanTransform | undefined;
  getDerivedArtifactId: (sourceId: string, path: string) => string | undefined;
  
  // Mutations
  createSchemaTransform: (params: CreateSchemaTransformParams) => Promise<CreateSchemaTransformResult>;
  updateArtifact: (artifactId: string, data: any, metadata?: any) => Promise<void>;
  
  // Streaming helpers
  getBrainstormIdeas: (sessionId?: string) => IdeaWithTitle[];
  getOutlineData: (sessionId?: string) => any | null;
  getStreamingStatus: (artifactId: string) => StreamingStatus;
}

const ProjectElectricContext = createContext<ProjectElectricContextValue | undefined>(undefined);

export const useProjectElectric = () => {
  const context = useContext(ProjectElectricContext);
  if (!context) {
    throw new Error('useProjectElectric must be used within ProjectElectricProvider');
  }
  return context;
};

interface ProjectElectricProviderProps {
  projectId: string;
  children: ReactNode;
}

export const ProjectElectricProvider: React.FC<ProjectElectricProviderProps> = ({ 
  projectId, 
  children 
}) => {
  // Get authenticated Electric config with error handling
  const electricConfig = useMemo(() => createElectricConfig(), []);

  // Enhanced error handler for Electric 409 conflicts
  const handleElectricError = useCallback((error: any, tableName: string) => {
    if (error?.status === 409) {
      console.log(`[ProjectElectric] Electric 409 conflict on ${tableName}, will auto-retry with new shape handle`);
      if (isElectricDebugLoggingEnabled()) {
        console.log(`[ProjectElectric] 409 error details for ${tableName}:`, error);
      }
      // Electric client should automatically handle this by refetching with new handle
      return;
    }
    
    // Log other errors but don't throw - let Electric handle retries
    if (isElectricDebugLoggingEnabled()) {
      console.log(`[ProjectElectric] Electric error on ${tableName}:`, error?.message || error);
    }
  }, []);

  // Memoize where clauses to prevent unnecessary re-renders
  const whereClausesStable = useMemo(() => ({
    artifacts: `project_id = '${projectId}'`,
    transforms: `project_id = '${projectId}'`,
    humanTransforms: `source_artifact_id IN (SELECT id FROM artifacts WHERE project_id = '${projectId}')`,
    transformInputs: `transform_id IN (SELECT id FROM transforms WHERE project_id = '${projectId}')`,
    transformOutputs: `transform_id IN (SELECT id FROM transforms WHERE project_id = '${projectId}')`
  }), [projectId]);

  // Log shape info for debugging
  if (isElectricDebugLoggingEnabled()) {
    logElectricShapeInfo('artifacts', whereClausesStable.artifacts);
    logElectricShapeInfo('transforms', whereClausesStable.transforms);
    logElectricShapeInfo('human_transforms', whereClausesStable.humanTransforms);
  }

  // Primary subscription: artifacts (most important for UI)
  const { 
    data: artifacts, 
    isLoading: artifactsLoading, 
    error: artifactsError 
  } = useShape<ElectricArtifact>({
    ...electricConfig,
    params: {
      table: 'artifacts',
      where: whereClausesStable.artifacts,
    },
    onError: useCallback((error: any) => handleElectricError(error, 'artifacts'), [handleElectricError]),
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    }
  });

  // Secondary subscription: transforms (conditional on artifacts existing)
  const shouldSubscribeToTransforms = artifacts && artifacts.length > 0;
  const { 
    data: transforms, 
    isLoading: transformsLoading, 
    error: transformsError 
  } = useShape<ElectricTransform>({
    ...electricConfig,
    params: {
      table: 'transforms',
      where: whereClausesStable.transforms,
    },
    onError: useCallback((error: any) => handleElectricError(error, 'transforms'), [handleElectricError]),
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    },
    subscribe: shouldSubscribeToTransforms
  });

  // Human transforms subscription
  const { 
    data: humanTransforms, 
    isLoading: humanTransformsLoading, 
    error: humanTransformsError 
  } = useShape<HumanTransform>({
    ...electricConfig,
    params: {
      table: 'human_transforms',
      where: whereClausesStable.humanTransforms,
    },
    onError: useCallback((error: any) => handleElectricError(error, 'human_transforms'), [handleElectricError]),
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    },
    subscribe: shouldSubscribeToTransforms
  });

  // Transform inputs subscription
  const { 
    data: transformInputs, 
    isLoading: transformInputsLoading, 
    error: transformInputsError 
  } = useShape<TransformInput>({
    ...electricConfig,
    params: {
      table: 'transform_inputs',
      where: whereClausesStable.transformInputs,
    },
    onError: useCallback((error: any) => handleElectricError(error, 'transform_inputs'), [handleElectricError]),
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    },
    subscribe: shouldSubscribeToTransforms
  });

  // Transform outputs subscription
  const { 
    data: transformOutputs, 
    isLoading: transformOutputsLoading, 
    error: transformOutputsError 
  } = useShape<TransformOutput>({
    ...electricConfig,
    params: {
      table: 'transform_outputs',
      where: whereClausesStable.transformOutputs,
    },
    onError: useCallback((error: any) => handleElectricError(error, 'transform_outputs'), [handleElectricError]),
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    },
    subscribe: shouldSubscribeToTransforms
  });

  // Ensure data arrays are never undefined
  const safeArtifacts = artifacts || [];
  const safeTransforms = transforms || [];
  const safeHumanTransforms = humanTransforms || [];
  const safeTransformInputs = transformInputs || [];
  const safeTransformOutputs = transformOutputs || [];

  // Memoized selectors to prevent unnecessary re-renders
  const getArtifactById = useMemo(() => 
    (id: string) => safeArtifacts.find(a => a.id === id), 
    [safeArtifacts]
  );

  const getArtifactsByType = useMemo(() => 
    (type: string) => safeArtifacts.filter(a => a.type === type),
    [safeArtifacts]
  );

  const getTransformsByArtifact = useMemo(() => 
    (artifactId: string) => {
      // Find transforms that have this artifact as input or output
      const inputTransformIds = safeTransformInputs
        .filter(ti => ti.artifact_id === artifactId)
        .map(ti => ti.transform_id);
      const outputTransformIds = safeTransformOutputs
        .filter(to => to.artifact_id === artifactId)
        .map(to => to.transform_id);
      
      const allTransformIds = [...new Set([...inputTransformIds, ...outputTransformIds])];
      return safeTransforms.filter(t => allTransformIds.includes(t.id));
    },
    [safeTransforms, safeTransformInputs, safeTransformOutputs]
  );

  const getHumanTransformsByPath = useMemo(() => 
    (artifactId: string, path: string) => {
      return safeHumanTransforms.find(ht => 
        ht.source_artifact_id === artifactId && ht.derivation_path === path
      );
    },
    [safeHumanTransforms]
  );

  const getDerivedArtifactId = useMemo(() => 
    (sourceId: string, path: string) => {
      const humanTransform = getHumanTransformsByPath(sourceId, path);
      return humanTransform?.derived_artifact_id;
    },
    [getHumanTransformsByPath]
  );

  // Centralized mutations
  const createSchemaTransform = useCallback(async ({
    transformName,
    sourceArtifactId, 
    derivationPath,
    fieldUpdates = {}
  }: CreateSchemaTransformParams): Promise<CreateSchemaTransformResult> => {
    const response = await fetch(`/api/artifacts/${sourceArtifactId}/schema-transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        transformName,
        derivationPath, 
        fieldUpdates
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }, []);

  const updateArtifact = useCallback(async (
    artifactId: string, 
    data: any, 
    metadata?: any
  ): Promise<void> => {
    const artifact = getArtifactById(artifactId);
    if (!artifact) throw new Error('Artifact not found');
    
    let requestBody: any;
    if (artifact.type === 'user_input') {
      requestBody = { text: JSON.stringify(data) };
    } else if (artifact.type === 'brainstorm_idea') {
      requestBody = { data };
    } else {
      throw new Error(`Unsupported artifact type for editing: ${artifact.type}`);
    }
    
    const response = await fetch(`/api/artifacts/${artifactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Update failed: ${response.statusText}`);
    }
  }, [getArtifactById]);

  // Domain-specific helpers
  const getBrainstormIdeas = useMemo(() => (sessionId?: string): IdeaWithTitle[] => {
    const brainstormArtifacts = getArtifactsByType('brainstorm_idea_collection');
    
    let targetArtifact: ElectricArtifact | undefined;
    if (sessionId) {
      targetArtifact = brainstormArtifacts.find(a => {
        try {
          const data = JSON.parse(a.data);
          return data.id === sessionId || data.ideation_session_id === sessionId;
        } catch (e) {
          return false;
        }
      });
    } else {
      // Sort by created_at since updated_at doesn't exist
      targetArtifact = brainstormArtifacts.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    }
    
    if (!targetArtifact) return [];
    
    try {
      // Since streaming columns don't exist, just parse the data directly
      const data = JSON.parse(targetArtifact.data);
        
      return (data?.ideas || []).map((idea: any, index: number) => ({
        title: idea.title || idea.idea_title || `想法 ${index + 1}`,
        body: idea.body || idea.idea_text || idea.text || '',
        artifactId: targetArtifact.id,
        index
      }));
    } catch (e) {
      console.warn('Failed to parse brainstorm artifact data:', e);
      return [];
    }
  }, [getArtifactsByType]);

  const getOutlineData = useMemo(() => (sessionId?: string): any | null => {
    // Find outline-related artifacts
    const outlineArtifacts = getArtifactsByType('outline_session')
      .concat(getArtifactsByType('outline_title'))
      .concat(getArtifactsByType('outline_genre'))
      .concat(getArtifactsByType('outline_characters'));
    
    if (sessionId) {
      return outlineArtifacts.find(a => {
        try {
          const data = JSON.parse(a.data);
          return data.id === sessionId || data.outline_session_id === sessionId;
        } catch (e) {
          return false;
        }
      });
    }
    
    // Sort by created_at since updated_at doesn't exist
    return outlineArtifacts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] || null;
  }, [getArtifactsByType]);

  const getStreamingStatus = useMemo(() => (artifactId: string): StreamingStatus => {
    const artifact = getArtifactById(artifactId);
    if (!artifact) return { status: 'idle', progress: 0 };
    
    const relatedTransforms = getTransformsByArtifact(artifactId);
    const latestTransform = relatedTransforms.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    // Since streaming columns don't exist on artifacts, determine status from transforms
    let status: StreamingStatus['status'] = 'completed';
    let progress = 100;
    let error = null;
    
    if (latestTransform) {
      if (latestTransform.status === 'running') {
        status = 'streaming';
        progress = latestTransform.progress_percentage || 0;
      } else if (latestTransform.status === 'failed') {
        status = 'failed';
        error = latestTransform.error_message;
      }
    }
    
    return { status, progress, error };
  }, [getArtifactById, getTransformsByArtifact]);

  // Combined loading and error states
  const isLoading = artifactsLoading;
  const error = artifactsError || transformsError || humanTransformsError || 
                transformInputsError || transformOutputsError;

  // Log errors for debugging (only in debug mode to reduce noise)
  if (artifactsError && isElectricDebugLoggingEnabled()) {
    console.log('[ProjectElectric] Artifacts error:', artifactsError);
  }
  if (transformsError && isElectricDebugLoggingEnabled()) {
    console.log('[ProjectElectric] Transforms error:', transformsError);
  }
  if (humanTransformsError && isElectricDebugLoggingEnabled()) {
    console.log('[ProjectElectric] Human transforms error:', humanTransformsError);
  }

  const contextValue: ProjectElectricContextValue = {
    // Data
    artifacts: safeArtifacts,
    transforms: safeTransforms,
    humanTransforms: safeHumanTransforms,
    transformInputs: safeTransformInputs,
    transformOutputs: safeTransformOutputs,
    
    // Loading states
    isLoading,
    artifactsLoading,
    transformsLoading,
    humanTransformsLoading,
    transformInputsLoading,
    transformOutputsLoading,
    
    // Error states
    error,
    artifactsError,
    transformsError,
    humanTransformsError,
    transformInputsError,
    transformOutputsError,
    
    // Selectors
    getArtifactById,
    getArtifactsByType,
    getTransformsByArtifact,
    getHumanTransformsByPath,
    getDerivedArtifactId,
    
    // Mutations
    createSchemaTransform,
    updateArtifact,
    
    // Streaming helpers
    getBrainstormIdeas,
    getOutlineData,
    getStreamingStatus,
  };

  return (
    <ProjectElectricContext.Provider value={contextValue}>
      {children}
    </ProjectElectricContext.Provider>
  );
}; 