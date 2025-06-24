import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DynamicBrainstormingResults } from './DynamicBrainstormingResults'
import { IdeaWithTitle } from '../types/brainstorm'
import { ReasoningIndicator } from './shared/ReasoningIndicator'
import { useProjectData } from '../contexts/ProjectDataContext'
import { buildLineageGraph, findLatestArtifact } from '../../common/utils/lineageResolution'

export default function ProjectBrainstormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate('/projects')
    return null
  }

  // Use unified project data context
  const projectData = useProjectData()

  // Extract brainstorm data with lineage resolution
  const { ideas, status, progress, error, isLoading, lastSyncedAt } = useMemo(() => {
    const brainstormArtifacts = projectData.getBrainstormArtifacts()

    if (brainstormArtifacts.length === 0) {
      return {
        ideas: [],
        status: 'idle' as const,
        progress: 0,
        error: null,
        isLoading: projectData.isLoading,
        lastSyncedAt: null
      }
    }



    // Convert individual brainstorm_idea artifacts to IdeaWithTitle format with lineage resolution
    let ideas: IdeaWithTitle[] = []
    let status: 'idle' | 'streaming' | 'completed' | 'failed' = 'completed'
    let progress = 100
    let lastSyncedAt: string | null = null

    try {
      // Build lineage graph for resolution
      const graph = buildLineageGraph(
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
      )

      // Group artifacts by their original source (to avoid duplicates)
      const processedArtifacts = new Set<string>()
      const resolvedIdeas: Array<{ artifact: any, resolvedId: string, originalId: string }> = []

      // Sort artifacts by creation time to get consistent ordering
      const sortedArtifacts = brainstormArtifacts
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      // Helper function to find the root (original) artifact in a lineage chain
      const findRootArtifact = (artifactId: string): string => {
        console.log(`🔍 [findRootArtifact] Looking for root of ${artifactId.substring(0, 8)}..., totalTransforms=${projectData.humanTransforms?.length || 0}`)

        // Look for human transforms that have this artifact as derived_artifact_id
        const sourceTransform = projectData.humanTransforms?.find(
          ht => ht.derived_artifact_id === artifactId
        )

        if (sourceTransform && sourceTransform.source_artifact_id) {
          // Recursively find the root
          const rootId = findRootArtifact(sourceTransform.source_artifact_id)
          console.log(`🔍 [findRootArtifact] ${artifactId.substring(0, 8)}... → ${sourceTransform.source_artifact_id.substring(0, 8)}... → ${rootId.substring(0, 8)}...`)
          return rootId
        }

        // This is the root artifact
        console.log(`🔍 [findRootArtifact] ${artifactId.substring(0, 8)}... is root (no transforms found, totalTransforms=${projectData.humanTransforms?.length || 0})`)
        return artifactId
      }

      for (const artifact of sortedArtifacts) {
        // Skip if we've already processed this artifact lineage
        if (processedArtifacts.has(artifact.id)) {
          continue
        }

        // Find the latest version using lineage resolution
        const resolution = findLatestArtifact(artifact.id, undefined, graph)
        const resolvedId = resolution.artifactId || artifact.id

        // Find the root (original) artifact in this lineage chain
        const rootId = findRootArtifact(artifact.id)

        // Check if we've already processed this lineage chain by checking all artifacts in the chain
        const allArtifactsInChain = new Set([artifact.id, resolvedId, rootId])
        const alreadyProcessed = Array.from(allArtifactsInChain).some(id => processedArtifacts.has(id))

        if (alreadyProcessed) {
          continue
        }

        // Mark all artifacts in this lineage chain as processed
        allArtifactsInChain.forEach(id => processedArtifacts.add(id))

        // Use the resolved (latest) version for display
        const resolvedArtifact = resolvedId !== artifact.id
          ? projectData.getArtifactById(resolvedId) || artifact
          : artifact

        resolvedIdeas.push({
          artifact: resolvedArtifact,
          resolvedId: resolvedId,
          originalId: rootId  // Use the root artifact ID as the original
        })
      }

      // Find the latest update time for sync status
      lastSyncedAt = resolvedIdeas.length > 0
        ? (resolvedIdeas[resolvedIdeas.length - 1].artifact.updated_at || null)
        : null

      // Check if any artifacts are still streaming
      const hasStreamingArtifacts = resolvedIdeas.some(
        ({ artifact }) => artifact.streaming_status === 'streaming'
      )

      if (hasStreamingArtifacts) {
        status = 'streaming'
        progress = 50
      }

      // Convert each resolved artifact to IdeaWithTitle format
      ideas = resolvedIdeas.map(({ artifact, resolvedId, originalId }, index) => {
        try {
          const data = artifact.data ? JSON.parse(artifact.data) : {}
          const idea = {
            title: data.title || `想法 ${index + 1}`,
            body: data.body || '内容加载中...',
            artifactId: resolvedId,
            originalArtifactId: originalId,
            index
          }

          // Debug logging for each idea
          console.log(`💡 [ProjectBrainstormPage] Idea ${index}:`, {
            artifactId: resolvedId?.substring(0, 8) + '...',
            originalArtifactId: originalId?.substring(0, 8) + '...',
            title: data.title,
            isResolved: resolvedId !== artifact.id,
            originalArtifactId_full: originalId,
            artifactId_full: resolvedId
          })

          return idea
        } catch (parseErr) {
          console.warn(`Failed to parse artifact ${resolvedId}:`, parseErr)
          return {
            title: `想法 ${index + 1}`,
            body: '内容解析失败',
            artifactId: resolvedId,
            originalArtifactId: originalId,
            index
          }
        }
      })

      console.log(`🔍 [ProjectBrainstormPage] Lineage resolution complete:`, {
        totalArtifacts: brainstormArtifacts.length,
        resolvedIdeas: resolvedIdeas.length,
        processedArtifacts: Array.from(processedArtifacts),
        resolvedArtifactIds: resolvedIdeas.map(r => r.resolvedId),
        originalArtifactIds: resolvedIdeas.map(r => r.originalId)
      })

    } catch (err) {
      console.error('Failed to process brainstorm artifacts with lineage resolution:', err)
      return {
        ideas: [],
        status: 'failed' as const,
        progress: 0,
        error: err instanceof Error ? err.message : '处理头脑风暴数据时出错',
        isLoading: false,
        lastSyncedAt: null
      }
    }

    return {
      ideas,
      status,
      progress,
      error: projectData.error?.message || null,
      isLoading: projectData.isLoading,
      lastSyncedAt
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