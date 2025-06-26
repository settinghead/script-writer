import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DynamicBrainstormingResults } from './DynamicBrainstormingResults'
import { IdeaWithTitle } from '../types/brainstorm'
import { ReasoningIndicator } from './shared/ReasoningIndicator'
import { useProjectData } from '../contexts/ProjectDataContext'
import { findLatestBrainstormIdeasWithLineage } from '../../common/utils/lineageResolution'

export default function ProjectBrainstormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate('/projects')
    return null
  }

  // Use unified project data context
  const projectData = useProjectData()

  // Extract brainstorm data using the new collection-based approach
  const { ideas, status, progress, error, isLoading, lastSyncedAt } = useMemo(() => {
    // NEW: Get brainstorm collections first
    const collections = projectData.getBrainstormCollections();

    // LEGACY: Also check for individual brainstorm ideas for backward compatibility
    const lineageGraph = projectData.getLineageGraph();
    const legacyIdeas = findLatestBrainstormIdeasWithLineage(lineageGraph, projectData.artifacts);

    const hasAnyBrainstormData = collections.length > 0 || legacyIdeas.length > 0;

    if (!hasAnyBrainstormData) {
      return {
        ideas: [],
        status: 'idle' as const,
        progress: 0,
        error: null,
        isLoading: projectData.isLoading,
        lastSyncedAt: null
      }
    }

    // Convert brainstorm data to IdeaWithTitle format
    let ideas: IdeaWithTitle[] = []
    let status: 'idle' | 'streaming' | 'completed' | 'failed' = 'completed'
    let progress = 100
    let lastSyncedAt: string | null = null

    try {
      // Process collections first (NEW format)
      for (const collection of collections) {
        try {
          const collectionData = JSON.parse(collection.data);
          // Collection has ideas array

          if (collectionData.ideas && Array.isArray(collectionData.ideas)) {
            for (let i = 0; i < collectionData.ideas.length; i++) {
              // Simply create a reference to each idea in the collection
              ideas.push({
                title: `想法 ${ideas.length + 1}`, // Simple placeholder title
                body: '内容加载中...', // Placeholder - ArtifactEditor will handle actual content
                artifactId: `${collection.id}-${i}`, // Unique display ID
                originalArtifactId: collection.id, // Collection ID
                artifactPath: `$.ideas[${i}]`, // JSON path to idea
                index: ideas.length
              });
            }
          }

          // Update last synced time
          lastSyncedAt = collection.updated_at || collection.created_at;

          // Check streaming status
          if (collection.streaming_status === 'streaming') {
            status = 'streaming';
            progress = 50;
          }

        } catch (parseErr) {
          console.warn(`Failed to parse collection ${collection.id}:`, parseErr);
        }
      }

      // Process legacy individual ideas (LEGACY format for backward compatibility)
      const sortedLegacyArtifacts = legacyIdeas
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (const artifact of sortedLegacyArtifacts) {
        try {
          const data = artifact.data ? JSON.parse(artifact.data) : {};
          ideas.push({
            title: data.title || `想法 ${ideas.length + 1}`,
            body: data.body || '内容加载中...',
            artifactId: artifact.id,
            originalArtifactId: artifact.id,
            artifactPath: '$',
            index: ideas.length
          });

          // Update last synced time if more recent
          if (!lastSyncedAt || new Date(artifact.updated_at || artifact.created_at) > new Date(lastSyncedAt)) {
            lastSyncedAt = artifact.updated_at || artifact.created_at;
          }

          // Check streaming status
          if (artifact.streaming_status === 'streaming') {
            status = 'streaming';
            progress = 50;
          }
        } catch (parseErr) {
          console.warn(`Failed to parse legacy artifact ${artifact.id}:`, parseErr);
        }
      }

    } catch (err) {
      console.error('❌ Failed to process brainstorm data:', err);
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
              // console.log('Selected idea:', ideaText)
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