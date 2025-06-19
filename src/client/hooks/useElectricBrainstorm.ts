import { useShape } from '@electric-sql/react'
import { createElectricConfig } from '../../common/config/electric'
import { 
  IdeaWithTitle,
  ElectricArtifact,
  ElectricTransform,
  BrainstormArtifactData,
  BrainstormArtifactMetadata,
  UseElectricBrainstormResult
} from '../../common/types'

export function useElectricBrainstorm(projectId: string): UseElectricBrainstormResult {
  // Get authenticated Electric config
  const electricConfig = createElectricConfig()

  // Watch for brainstorm_idea_collection artifacts for this project
  // User scoping is handled automatically by the proxy
  // Note: This will fail until we migrate to Postgres schema
  const { data: artifacts, isLoading: artifactsLoading, error: artifactsError } = useShape<ElectricArtifact>({
    ...electricConfig,
    params: {
      table: 'artifacts',
      where: `project_id = '${projectId}' AND type = 'brainstorm_idea_collection'`,
    },
  })

  // Watch for transforms to get status information
  // User scoping is handled automatically by the proxy
  // Note: This will fail until we migrate to Postgres schema
  const { data: transforms, isLoading: transformsLoading, error: transformsError } = useShape<ElectricTransform>({
    ...electricConfig,
    params: {
      table: 'transforms',
      where: `project_id = '${projectId}' AND type = 'llm'`,
    },
  })

  // Log errors for debugging (temporary)
  if (artifactsError) {
    console.log('[useElectricBrainstorm] Artifacts error (expected until Postgres migration):', artifactsError);
  }
  if (transformsError) {
    console.log('[useElectricBrainstorm] Transforms error (expected until Postgres migration):', transformsError);
  }

  const isLoading = artifactsLoading || transformsLoading

  // Process the artifacts data
  const latestArtifact = artifacts && artifacts.length > 0 
    ? artifacts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    : null

  // Process the transforms data for status
  const latestTransform = transforms && transforms.length > 0
    ? transforms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null

  // Extract ideas from the latest artifact - return IdeaWithTitle format
  const ideas: IdeaWithTitle[] = (() => {
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

      return ideasArray.map((item: any) => ({
        title: item.title || '无标题',
        body: item.body || item.description || '',
        artifactId: latestArtifact.id
      }))
    } catch (error) {
      console.error('[useElectricBrainstorm] Failed to parse artifact data:', error, latestArtifact.data)
      return []
    }
  })()

  // Parse metadata if available
  const metadata: BrainstormArtifactMetadata | null = (() => {
    if (!latestArtifact?.metadata) return null
    try {
      return JSON.parse(latestArtifact.metadata)
    } catch {
      return null
    }
  })()

  // Determine status based on artifact metadata and transform status
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
        progress = Math.min(90, (metadata.chunkCount || 0) * 10)
      } else if (metadata.status === 'completed') {
        status = 'completed'
        progress = 100
      } else if (metadata.status === 'failed') {
        status = 'failed'
        error = 'Brainstorm generation failed'
      }
    }
  }

  // Override with transform status if available
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