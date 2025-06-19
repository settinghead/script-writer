import { useShape } from '@electric-sql/react'
import { createElectricConfig, logElectricShapeInfo, isElectricDebugLoggingEnabled } from '../../common/config/electric'
import { 
  IdeaWithTitle,
  ElectricArtifact,
  ElectricTransform,
  BrainstormArtifactData,
  BrainstormArtifactMetadata,
  UseElectricBrainstormResult
} from '../../common/types'
import { useMemo, useRef, useCallback } from 'react'

export function useElectricBrainstorm(projectId: string): UseElectricBrainstormResult {
  // Get authenticated Electric config with error handling
  const electricConfig = createElectricConfig()
  
  // Use refs to prevent unnecessary re-subscriptions
  const lastProjectIdRef = useRef<string>()
  const shapeSubscriptionsRef = useRef<Set<string>>(new Set())

  // Enhanced error handler for Electric 409 conflicts
  const handleElectricError = useCallback((error: any, tableName: string) => {
    if (error?.status === 409) {
      console.log(`[useElectricBrainstorm] Electric 409 conflict on ${tableName}, will auto-retry with new shape handle`);
      if (isElectricDebugLoggingEnabled()) {
        console.log(`[useElectricBrainstorm] 409 error details for ${tableName}:`, error);
      }
      // Electric client should automatically handle this by refetching with new handle
      return;
    }
    
    // Log other errors but don't throw - let Electric handle retries
    if (isElectricDebugLoggingEnabled()) {
      console.log(`[useElectricBrainstorm] Electric error on ${tableName} (expected until Postgres migration):`, error?.message || error);
    }
  }, [])

  // Memoize where clauses to prevent unnecessary re-renders
  const whereClausesStable = useMemo(() => ({
    artifacts: `project_id = '${projectId}' AND type = 'brainstorm_idea_collection'`,
    transforms: `project_id = '${projectId}' AND type = 'llm'`
  }), [projectId])

  // Only log shape info when project changes to reduce noise
  if (lastProjectIdRef.current !== projectId) {
    lastProjectIdRef.current = projectId
    logElectricShapeInfo('artifacts', whereClausesStable.artifacts)
    logElectricShapeInfo('transforms', whereClausesStable.transforms)
  }

  // Primary subscription: artifacts only (most important for UI)
  const { data: artifacts, isLoading: artifactsLoading, error: artifactsError } = useShape<ElectricArtifact>({
    ...electricConfig,
    params: {
      table: 'artifacts',
      where: whereClausesStable.artifacts,
    },
    // Enhanced error handling with table-specific context
    onError: useCallback((error: any) => handleElectricError(error, 'artifacts'), [handleElectricError]),
    // More aggressive backoff to reduce 409 conflicts
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    }
  })

  // Secondary subscription: transforms for status (less critical)
  // Only subscribe if we have artifacts data to avoid unnecessary load
  const shouldSubscribeToTransforms = artifacts && artifacts.length > 0
  const { data: transforms, isLoading: transformsLoading, error: transformsError } = useShape<ElectricTransform>({
    ...electricConfig,
    params: {
      table: 'transforms',
      where: whereClausesStable.transforms,
    },
    // Enhanced error handling with table-specific context
    onError: useCallback((error: any) => handleElectricError(error, 'transforms'), [handleElectricError]),
    // More aggressive backoff to reduce 409 conflicts
    backoffOptions: {
      initialDelay: 200,
      maxDelay: 5000,
      multiplier: 2.0,
      maxRetries: 3
    },
    // Conditional subscription to reduce load
    subscribe: shouldSubscribeToTransforms
  })

  // Log errors for debugging (only in debug mode to reduce noise)
  if (artifactsError && isElectricDebugLoggingEnabled()) {
    console.log('[useElectricBrainstorm] Artifacts error (expected until Postgres migration):', artifactsError);
  }
  if (transformsError && isElectricDebugLoggingEnabled()) {
    console.log('[useElectricBrainstorm] Transforms error (expected until Postgres migration):', transformsError);
  }

  // Only show loading if we're actually loading artifacts (primary data)
  const isLoading = artifactsLoading

  // Process the artifacts data with enhanced safety checks
  const latestArtifact = useMemo(() => {
    if (!artifacts || !Array.isArray(artifacts) || artifacts.length === 0) {
      return null
    }
    
    try {
      return artifacts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    } catch (error) {
      console.warn('[useElectricBrainstorm] Error sorting artifacts:', error)
      return artifacts[0] || null
    }
  }, [artifacts])

  // Process the transforms data for status with enhanced safety checks
  const latestTransform = useMemo(() => {
    if (!transforms || !Array.isArray(transforms) || transforms.length === 0) {
      return null
    }
    
    try {
      return transforms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    } catch (error) {
      console.warn('[useElectricBrainstorm] Error sorting transforms:', error)
      return transforms[0] || null
    }
  }, [transforms])

  // Extract ideas from the latest artifact with enhanced error handling
  const ideas: IdeaWithTitle[] = useMemo(() => {
    if (!latestArtifact?.data) {
      return []
    }

    try {
      // Parse the JSON data - should be a direct array for brainstorm_idea_collection
      const parsedData = JSON.parse(latestArtifact.data)

      // Handle both formats: direct array (new) and { ideas: [] } (legacy)
      let ideasArray: any[] = []
      if (Array.isArray(parsedData)) {
        // New format: direct array
        ideasArray = parsedData
      } else if (parsedData && Array.isArray(parsedData.ideas)) {
        // Legacy format: { ideas: [] }
        ideasArray = parsedData.ideas
      } else {
        console.warn('[useElectricBrainstorm] Data is not in expected format:', parsedData)
        return []
      }

      return ideasArray.map((item: any, index: number) => ({
        title: item?.title || `创意 ${index + 1}`,
        body: item?.body || item?.description || '',
        artifactId: latestArtifact.id
      }))
    } catch (error) {
      console.error('[useElectricBrainstorm] Failed to parse artifact data:', error, latestArtifact.data)
      return []
    }
  }, [latestArtifact])

  // Parse metadata with error handling
  const metadata: BrainstormArtifactMetadata | null = useMemo(() => {
    if (!latestArtifact?.metadata) return null
    try {
      return JSON.parse(latestArtifact.metadata)
    } catch (error) {
      console.warn('[useElectricBrainstorm] Failed to parse metadata:', error)
      return null
    }
  }, [latestArtifact?.metadata])

  // Determine status based on artifact metadata and transform status
  const { status, progress, error } = useMemo(() => {
    let status: 'idle' | 'streaming' | 'completed' | 'failed' = 'idle'
    let progress = 0
    let error: string | null = null

    if (latestArtifact) {
      // Use streaming_status from the artifact (Electric schema)
      if (latestArtifact.streaming_status === 'streaming') {
        status = 'streaming'
        progress = latestArtifact.streaming_progress || 0
      } else if (latestArtifact.streaming_status === 'completed') {
        status = 'completed'
        progress = 100
      } else if (latestArtifact.streaming_status === 'failed') {
        status = 'failed'
        error = 'Brainstorm generation failed'
      }

      // Fallback to metadata status if streaming_status is not available
      if (status === 'idle' && metadata?.status) {
        if (metadata.status === 'streaming') {
          status = 'streaming'
          progress = Math.min(90, (metadata.chunkCount || 0) * 2) // More conservative progress
        } else if (metadata.status === 'completed') {
          status = 'completed'
          progress = 100
        } else if (metadata.status === 'failed') {
          status = 'failed'
          error = 'Brainstorm generation failed'
        }
      }
    }

    // Override with transform status if available and more recent
    if (latestTransform) {
      if (latestTransform.status === 'failed') {
        status = 'failed'
        error = latestTransform.error_message || 'Transform failed'
      } else if (latestTransform.status === 'running' || latestTransform.streaming_status === 'running') {
        status = 'streaming'
        progress = Math.max(progress, latestTransform.progress_percentage || 0)
      } else if (latestTransform.status === 'completed') {
        status = 'completed'
        progress = 100
      }
    }

    return { status, progress, error }
  }, [latestArtifact, latestTransform, metadata])

  return {
    ideas,
    status,
    progress,
    error,
    isLoading,
    lastSyncedAt: latestArtifact?.updated_at || null,
    chunkCount: metadata?.chunkCount || 0
  }
} 