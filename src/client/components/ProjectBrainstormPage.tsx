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
      // Check streaming status directly from artifact
      const streamingStatus = latestBrainstorm.streaming_status || 'completed'

      if (streamingStatus === 'streaming') {
        status = 'streaming'
        progress = 50 // Generic progress for streaming state
      } else if (streamingStatus === 'completed') {
        status = 'completed'
        progress = 100
      } else if (streamingStatus === 'failed') {
        status = 'failed'
        progress = 0
      } else {
        status = 'completed'
        progress = 100
      }

      // Parse data (same for both streaming and completed states)
      if (latestBrainstorm.data) {
        try {
          const artifactData = JSON.parse(latestBrainstorm.data)

          // Debug logging removed - issue resolved

          if (Array.isArray(artifactData)) {
            // Data is directly an array of ideas
            ideas = artifactData.map((idea: any, index: number) => ({
              ...idea,
              artifactId: latestBrainstorm.id,
              index
            }))
            // Debug logging removed - issue resolved
          } else if (artifactData.ideas && Array.isArray(artifactData.ideas)) {
            // Data has an 'ideas' property
            ideas = artifactData.ideas.map((idea: any, index: number) => ({
              ...idea,
              artifactId: latestBrainstorm.id,
              index
            }))
            // Debug logging removed - issue resolved
          } else if (typeof artifactData === 'object' && artifactData !== null) {
            // Data is an object with numeric string keys (e.g., {'0': {...}, '1': {...}, '2': {...}})
            const keys = Object.keys(artifactData).filter(key => !isNaN(Number(key))).sort((a, b) => Number(a) - Number(b))
            if (keys.length > 0) {
              ideas = keys.map((key, index) => ({
                ...artifactData[key],
                artifactId: latestBrainstorm.id,
                index: Number(key)
              }))
              // Debug logging removed - issue resolved
            }
          }

          // Debug logging removed - issue resolved
        } catch (parseErr) {
          console.warn('Failed to parse brainstorm data:', parseErr)
        }
      }

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
          <p className="text-gray-300">正在同步头脑风暴数据...</p>
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
          <h2 className="text-xl font-semibold text-white mb-2">头脑风暴错误</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            返回项目
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

              {lastSyncedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  最后同步: {new Date(lastSyncedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-4">
              {status === 'streaming' && (
                <div className="flex items-center gap-2">
                  <ReasoningIndicator isVisible={false} />
                  <span className="text-sm text-blue-400">正在生成想法...</span>
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
            <h2 className="text-xl font-semibold mb-2">尚未开始头脑风暴</h2>
            <p className="text-gray-400 mb-6">
              此项目还没有头脑风暴结果。
              返回开始新的头脑风暴。
            </p>
            <button
              onClick={() => navigate('/projects')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              开始新的头脑风暴
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-semibold mb-2">头脑风暴进行中</h2>
              <p className="text-gray-400">
                正在生成您的创意。结果将自动显示在这里。
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
} 