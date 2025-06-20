import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useElectricBrainstorm } from '../hooks/useElectricBrainstorm'
import { DynamicBrainstormingResults } from './DynamicBrainstormingResults'
import { ReasoningIndicator } from './shared/ReasoningIndicator'
import { StreamingProgress } from './shared/StreamingProgress'

export default function ProjectBrainstormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate('/projects')
    return null
  }

  const {
    ideas,
    status,
    progress,
    error,
    isLoading,
    lastSyncedAt
  } = useElectricBrainstorm(projectId)

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