import { useShape } from '@electric-sql/react'
import { useMutation, useMutationState } from '@tanstack/react-query'

interface BrainstormIdea {
  id: string
  title: string
  description: string
  category?: string
  created_at: string
}

interface BrainstormArtifact {
  id: string
  project_id: string
  type: string
  data: {
    ideas?: BrainstormIdea[]
    status?: string
    progress?: number
  }
  created_at: string
  updated_at: string
}

interface Transform {
  id: string
  project_id: string
  status: 'pending' | 'streaming' | 'completed' | 'failed'
  type: string
  created_at: string
  updated_at: string
}

interface UseElectricBrainstormResult {
  ideas: BrainstormIdea[]
  status: 'idle' | 'streaming' | 'completed' | 'failed'
  progress: number
  error: string | null
  isLoading: boolean
  lastSyncedAt?: number
}

const ELECTRIC_URL = import.meta.env.VITE_ELECTRIC_URL || 'http://localhost:3000'

export function useElectricBrainstorm(projectId: string): UseElectricBrainstormResult {
  // Use Electric's useShape to sync brainstorm artifacts in real-time
  const { data: artifacts, isLoading: artifactsLoading, lastSyncedAt } = useShape<BrainstormArtifact>({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'artifacts',
      where: `project_id = '${projectId}' AND type = 'brainstorm_ideas'`,
      columns: ['id', 'project_id', 'type', 'data', 'created_at', 'updated_at']
    }
  })

  // Use Electric's useShape to sync transform status in real-time
  const { data: transforms, isLoading: transformsLoading } = useShape<Transform>({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'transforms',
      where: `project_id = '${projectId}' AND type = 'brainstorm'`,
      columns: ['id', 'project_id', 'status', 'type', 'created_at', 'updated_at']
    }
  })

  // Get optimistic mutations from TanStack
  const optimisticBrainstorms = useMutationState({
    filters: { status: 'pending', mutationKey: ['brainstorm'] },
    select: (mutation) => mutation.state.variables as { projectId: string }
  }).filter(vars => vars?.projectId === projectId)

  // Parse the latest brainstorm data
  const latestArtifact = artifacts?.[artifacts.length - 1]
  const ideas = latestArtifact?.data?.ideas || []
  
  // Determine status from transforms
  const latestTransform = transforms?.[transforms.length - 1]
  const status = latestTransform?.status || 'idle'
  const progress = latestArtifact?.data?.progress || 0

  return {
    ideas,
    status: optimisticBrainstorms.length > 0 ? 'streaming' : status,
    progress,
    error: null,
    isLoading: artifactsLoading || transformsLoading,
    lastSyncedAt
  }
} 