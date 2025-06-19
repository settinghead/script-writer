import { useShape } from '@electric-sql/react'
import { useMutation, useMutationState } from '@tanstack/react-query'
import { IdeaWithTitle } from '../types/brainstorm'

interface BrainstormArtifact {
  id: string
  project_id: string
  type: string
  type_version: string
  data: IdeaWithTitle[] | string  // Could be parsed or string
  metadata: {
    status: 'streaming' | 'completed' | 'failed'
    chunkCount: number
    startedAt?: string
    lastUpdated?: string
    completedAt?: string
  }
  created_at: string
  updated_at: string
}

interface Transform {
  id: string
  project_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  streaming_status: string
  progress_percentage: number
  type: string
  created_at: string
  updated_at: string
}

interface UseElectricBrainstormResult {
  ideas: IdeaWithTitle[]
  status: 'idle' | 'streaming' | 'completed' | 'failed'
  progress: number
  error: string | null
  isLoading: boolean
  lastSyncedAt: string | null
  chunkCount: number
}

const ELECTRIC_URL = import.meta.env.VITE_ELECTRIC_URL || 'http://localhost:3000'

export function useElectricBrainstorm(projectId: string): UseElectricBrainstormResult {
  // Watch for brainstorm_idea_collection artifacts for this project
  const { data: artifacts, isLoading: artifactsLoading } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'artifacts',
      where: `project_id = '${projectId}' AND type = 'brainstorm_idea_collection'`,
    },
  })

  // Watch for transforms to get status information
  const { data: transforms, isLoading: transformsLoading } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'transforms',
      where: `project_id = '${projectId}' AND type = 'llm'`,
    },
  })

  const isLoading = artifactsLoading || transformsLoading

  // Process the artifacts data
  const latestArtifact = artifacts && artifacts.length > 0 
    ? (artifacts as BrainstormArtifact[])
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    : null

  // Process the transforms data for status
  const latestTransform = transforms && transforms.length > 0
    ? (transforms as Transform[])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null

  // Extract ideas from the latest artifact - return IdeaWithTitle format
  const ideas: IdeaWithTitle[] = (() => {
    if (!latestArtifact?.data) {
      console.log('[useElectricBrainstorm] No artifact data available')
      return []
    }

    try {
      // The data might be a string that needs parsing, or already an object
      let parsedData = latestArtifact.data
      if (typeof parsedData === 'string') {
        parsedData = JSON.parse(parsedData)
      }

      console.log('[useElectricBrainstorm] Parsed artifact data:', parsedData)

      // Ensure it's an array
      if (Array.isArray(parsedData)) {
        return parsedData.map((item: any, index: number) => ({
          title: item.title || '无标题',
          body: item.body || item.description || '',
          artifactId: latestArtifact.id  // Use the artifact ID
        }))
      } else {
        console.warn('[useElectricBrainstorm] Data is not an array:', parsedData)
        return []
      }
    } catch (error) {
      console.error('[useElectricBrainstorm] Failed to parse artifact data:', error, latestArtifact.data)
      return []
    }
  })()

  // Determine status based on artifact metadata and transform status
  let status: 'idle' | 'streaming' | 'completed' | 'failed' = 'idle'
  let progress = 0
  let error: string | null = null

  if (latestArtifact) {
    const artifactStatus = latestArtifact.metadata?.status
    if (artifactStatus === 'streaming') {
      status = 'streaming'
      progress = Math.min(90, (latestArtifact.metadata?.chunkCount || 0) * 10) // Estimate progress
    } else if (artifactStatus === 'completed') {
      status = 'completed'
      progress = 100
    } else if (artifactStatus === 'failed') {
      status = 'failed'
      error = 'Brainstorm generation failed'
    }
  }

  // Override with transform status if available
  if (latestTransform) {
    if (latestTransform.status === 'failed') {
      status = 'failed'
      error = 'Transform failed'
    } else if (latestTransform.status === 'running') {
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
    chunkCount: latestArtifact?.metadata?.chunkCount || 0
  }
} 