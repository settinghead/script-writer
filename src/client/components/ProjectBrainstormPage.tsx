import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectData } from '../contexts/ProjectDataContext'
import { DynamicBrainstormingResults } from './DynamicBrainstormingResults'
import { ReasoningIndicator } from './shared/ReasoningIndicator'
import { StreamingProgress } from './shared/StreamingProgress'
import type { IdeaWithTitle } from '../types/brainstorm'

export default function ProjectBrainstormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate('/projects')
    return null
  }

  // Use unified project data context
  const projectData = useProjectData()

  // Extract brainstorm data from the unified context
  const { ideas, status, progress, error, isLoading, lastSyncedAt } = useMemo(() => {
    const brainstormArtifacts = projectData.getBrainstormArtifacts()
    
    // DEBUG: Log all artifacts for this project
    console.log(`[ProjectBrainstormPage] Project ${projectId} - All artifacts:`, projectData.artifacts?.length || 0)
    console.log(`[ProjectBrainstormPage] Brainstorm artifacts:`, brainstormArtifacts.length)
    brainstormArtifacts.forEach((artifact, index) => {
      console.log(`[ProjectBrainstormPage] Artifact ${index}:`, {
        id: artifact.id,
        type: artifact.type,
        streaming_status: artifact.streaming_status,
        created_at: artifact.created_at,
        data_length: artifact.data?.length || 0
      })
    })
    
    // Find the latest brainstorm artifact
    const latestBrainstorm = brainstormArtifacts
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (!latestBrainstorm) {
      return {
        ideas: [],
        status: 'idle' as const,
        progress: 0,
        error: null,
        isLoading: projectData.isLoading,
        lastSyncedAt: null
      }
    }

    // Parse the ideas from the artifact data
    let ideas: IdeaWithTitle[] = []
    let status: 'idle' | 'streaming' | 'completed' | 'failed' = 'idle'
    let progress = 0

    try {
      // Parse metadata to get status information
      let metadata: any = {}
      if (latestBrainstorm.metadata) {
        try {
          metadata = JSON.parse(latestBrainstorm.metadata)
        } catch (metaErr) {
          console.warn('Failed to parse artifact metadata:', metaErr)
        }
      }

      console.log(`[ProjectBrainstormPage] Parsed metadata:`, metadata)

      // Check status from metadata
      if (metadata.status === 'streaming') {
        status = 'streaming'
        progress = metadata.progress || 0

        // Use partial data if available during streaming
        if (latestBrainstorm.data) {
          try {
            const partialData = JSON.parse(latestBrainstorm.data)
            if (Array.isArray(partialData)) {
              ideas = partialData.map((idea: any, index: number) => ({
                ...idea,
                artifactId: latestBrainstorm.id,
                index
              }))
            }
          } catch (parseErr) {
            console.warn('Failed to parse streaming data:', parseErr)
          }
        }
      } else if (metadata.status === 'completed') {
        status = 'completed'
        progress = 100

        console.log(`[ProjectBrainstormPage] Parsing completed data, raw data:`, latestBrainstorm.data?.substring(0, 200) + '...')

        // Parse completed data
        if (latestBrainstorm.data) {
          const artifactData = JSON.parse(latestBrainstorm.data)
          console.log(`[ProjectBrainstormPage] Parsed artifact data:`, artifactData)
          
          if (Array.isArray(artifactData)) {
            // Data is directly an array of ideas
            ideas = artifactData.map((idea: any, index: number) => ({
              ...idea,
              artifactId: latestBrainstorm.id,
              index
            }))
          } else if (artifactData.ideas && Array.isArray(artifactData.ideas)) {
            // Data has an 'ideas' property
            ideas = artifactData.ideas.map((idea: any, index: number) => ({
              ...idea,
              artifactId: latestBrainstorm.id,
              index
            }))
          }
        }
      } else if (metadata.status === 'failed') {
        status = 'failed'
      } else {
        // Default to completed if no status in metadata but data exists
        if (latestBrainstorm.data) {
          status = 'completed'
          progress = 100
          
          const artifactData = JSON.parse(latestBrainstorm.data)
          if (Array.isArray(artifactData)) {
            ideas = artifactData.map((idea: any, index: number) => ({
              ...idea,
              artifactId: latestBrainstorm.id,
              index
            }))
          } else if (artifactData.ideas && Array.isArray(artifactData.ideas)) {
            ideas = artifactData.ideas.map((idea: any, index: number) => ({
              ...idea,
              artifactId: latestBrainstorm.id,
              index
            }))
          }
        }
      }

      console.log(`[ProjectBrainstormPage] Final parsed state:`, { status, progress, ideasCount: ideas.length })
    } catch (err) {
      console.error('Failed to parse brainstorm data:', err)
    }

    return {
      ideas,
      status,
      progress,
      error: projectData.error?.message || null,
      isLoading: projectData.isLoading,
      lastSyncedAt: latestBrainstorm.updated_at
    }
  }, [projectData])

  // Show loading state during initial sync
  if (isLoading && ideas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Syncing brainstorm data...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Brainstorm Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/projects')}
                className="text-blue-400 hover:text-blue-300 mb-2 flex items-center gap-2"
              >
                ← Back to Projects
              </button>
              <h1 className="text-3xl font-bold">Brainstorm Results</h1>
              <p className="text-gray-400 mt-1">Project: {projectId}</p>
              {lastSyncedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-4">
              {status === 'streaming' && (
                <div className="flex items-center gap-2">
                  <ReasoningIndicator isVisible={false} />
                  <span className="text-sm text-blue-400">Generating ideas...</span>
                </div>
              )}
              {status === 'completed' && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-400">Complete</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {status === 'streaming' && (
            <div className="mt-4">
              正在生成想法...
            </div>
          )}
        </div>

        {/* Results */}
        {ideas.length > 0 ? (
          <DynamicBrainstormingResults
            ideas={ideas}
            isStreaming={status === 'streaming'}
            onIdeaSelect={(ideaText) => {
              // For now, just log the selected idea
              // TODO: Implement proper idea selection logic
              console.log('Selected idea:', ideaText)
            }}
          />
        ) : status === 'idle' ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤔</div>
            <h2 className="text-xl font-semibold mb-2">No brainstorm started yet</h2>
            <p className="text-gray-400 mb-6">
              This project doesn't have any brainstorm results.
              Go back to start a new brainstorm.
            </p>
            <button
              onClick={() => navigate('/projects')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start New Brainstorm
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-semibold mb-2">Brainstorm in Progress</h2>
              <p className="text-gray-400">
                Your ideas are being generated. Results will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {ideas.length > 0 && status === 'completed' && (
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => navigate(`/projects/${projectId}/outline`)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Continue to Outline →
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Projects
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 