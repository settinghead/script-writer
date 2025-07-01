import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Divider } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import { IdeaWithTitle } from '../../../common/utils/lineageResolution';
import { ReasoningIndicator } from '../shared/ReasoningIndicator';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLatestBrainstormIdeas } from '../../hooks/useLineageResolution';
import { useChosenBrainstormIdea } from '../../hooks/useChosenBrainstormIdea';
import { useEditableDescendants } from '../../hooks/useEditableDescendants';
import { BrainstormIdeaEditor } from './BrainstormIdeaEditor';
import { OutlineGenerationOutput } from '../../../common/schemas/outlineSchemas';

const { Text } = Typography;

// Wrapper component to handle editable descendants detection
const IdeaCardWrapper: React.FC<{
  idea: IdeaWithTitle;
  index: number;
  isSelected: boolean;
  chosenIdea: any;
  ideaOutlines: any[];
  onIdeaClick: (collectionId: string, index: number) => void;
}> = ({ idea, index, isSelected, chosenIdea, ideaOutlines, onIdeaClick }) => {
  // Ensure we have the required fields
  if (!idea.artifactId || !idea.originalArtifactId || !idea.artifactPath) {
    return null;
  }

  // Check if this idea has editable descendants
  const { hasEditableDescendants } = useEditableDescendants(idea.artifactId);

  // Check if this idea is the chosen one
  const isChosenIdea = chosenIdea &&
    chosenIdea.originalArtifactId === idea.originalArtifactId &&
    chosenIdea.originalArtifactPath === idea.artifactPath;

  return (
    <BrainstormIdeaEditor
      artifactId={idea.artifactId}
      artifactPath={idea.artifactPath}
      originalCollectionId={idea.originalArtifactId}
      index={index}
      isSelected={isSelected}
      isChosen={!!isChosenIdea}
      hasEditableDescendants={hasEditableDescendants}
      ideaOutlines={ideaOutlines}
      onIdeaClick={onIdeaClick}
    />
  );
};

export default function ProjectBrainstormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const [ideaOutlines, setIdeaOutlines] = useState<Record<string, any[]>>({});

  if (!projectId) {
    navigate('/projects')
    return null
  }

  // Use unified project data context
  const projectData = useProjectData()

  // Get latest brainstorm ideas using the new hook
  const latestIdeas = useLatestBrainstormIdeas();

  // Check for chosen brainstorm idea
  const { chosenIdea, isLoading: chosenIdeaLoading } = useChosenBrainstormIdea();

  // Extract brainstorm data using the new collection-based approach as fallback
  const { ideas: fallbackIdeas, status, progress, error, isLoading, lastSyncedAt } = useMemo(() => {
    // If we have latest ideas from the hook, use those
    if (latestIdeas.length > 0) {
      return {
        ideas: latestIdeas,
        status: 'completed' as const,
        progress: 100,
        error: null,
        isLoading: false,
        lastSyncedAt: null
      }
    }

    // Fallback to legacy collection-based approach
    const collections = projectData.getBrainstormCollections();

    const hasAnyBrainstormData = collections.length > 0;

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
      // Process collections
      for (const collection of collections) {
        try {
          const collectionData = JSON.parse(collection.data);

          if (collectionData.ideas && Array.isArray(collectionData.ideas)) {
            for (let i = 0; i < collectionData.ideas.length; i++) {
              ideas.push({
                title: `想法 ${ideas.length + 1}`,
                body: '内容加载中...',
                artifactId: `${collection.id}-${i}`,
                originalArtifactId: collection.id,
                artifactPath: `$.ideas[${i}]`,
                index: ideas.length
              });
            }
          }

          lastSyncedAt = collection.updated_at || collection.created_at;

          if (collection.streaming_status === 'streaming') {
            status = 'streaming';
            progress = 50;
          }

        } catch (parseErr) {
          console.warn(`Failed to parse collection ${collection.id}:`, parseErr);
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
  }, [latestIdeas, projectData])

  // Use the better data source
  const ideas = latestIdeas.length > 0 ? latestIdeas : fallbackIdeas;
  const isStreaming = status === 'streaming';
  const isConnecting = isLoading && ideas.length === 0;

  // Determine if we should show collapsed view
  const isCollapsedView = chosenIdea && !chosenIdeaLoading;



  // Handle idea card click - create human transform to start editing
  const handleIdeaClick = useCallback((collectionId: string, index: number) => {
    // Don't handle clicks if we already have a chosen idea
    if (chosenIdea) {
      return;
    }

    // Find the idea that was clicked
    const clickedIdea = ideas[index];
    if (!clickedIdea || !clickedIdea.artifactId || !clickedIdea.artifactPath) {
      console.warn('Invalid idea clicked:', clickedIdea);
      return;
    }

    // Determine the correct transform name based on artifact path
    const transformName = clickedIdea.artifactPath === '$' ? 'edit_brainstorm_idea' : 'edit_brainstorm_collection_idea';

    // Create human transform to start editing
    projectData.createHumanTransform.mutate({
      transformName,
      sourceArtifactId: clickedIdea.artifactId,
      derivationPath: clickedIdea.artifactPath,
      fieldUpdates: {} // Start with empty updates
    }, {
      onSuccess: (response) => {
        console.log('Human transform created successfully, editing will begin automatically');
      },
      onError: (error) => {
        console.error('Failed to create human transform:', error);
      }
    });

    // Set selected idea for visual feedback during transition
    setSelectedIdea(index);
  }, [chosenIdea, ideas, projectData.createHumanTransform]);



  // Handle stop streaming
  const handleStop = useCallback(() => {
    // TODO: Implement stop streaming logic
    console.log('Stop brainstorm streaming');
  }, []);

  // Show loading state during initial sync
  if (isConnecting) {
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
    <div id="brainstorm-ideas" className={`${isCollapsedView ? 'bg-gray-900' : 'min-h-screen bg-gray-900'} text-white`}>
      <div className={`container mx-auto px-4 ${isCollapsedView ? 'py-4' : 'py-8'}`}>
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
              {isStreaming && (
                <div className="flex items-center gap-2">
                  <ReasoningIndicator isVisible={false} />
                  <span className="text-sm text-blue-400">正在生成想法...</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isStreaming && (
            <div className="mt-4">
              正在生成想法...
            </div>
          )}
        </div>

        {/* Results */}
        {ideas.length > 0 ? (
          <div className="space-y-6">
            {/* Header with controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">

                {isStreaming && (
                  <div className="flex items-center gap-2">
                    <ReasoningIndicator isVisible={false} />
                    <Text className="text-sm text-blue-400">
                      生成中...
                    </Text>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isStreaming && (
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<StopOutlined />}
                    onClick={handleStop}
                  >
                    停止生成
                  </Button>
                )}
              </div>
            </div>

            {/* Ideas grid - responsive layout based on collapsed state */}
            <div className={isCollapsedView
              ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            }>
              {ideas.map((idea, index) => (
                <IdeaCardWrapper
                  key={`${idea.artifactId}-${index}`}
                  idea={idea}
                  index={index}
                  isSelected={selectedIdea === index}
                  chosenIdea={chosenIdea}
                  ideaOutlines={ideaOutlines[idea.artifactId || ''] || []}
                  onIdeaClick={handleIdeaClick}
                />
              ))}
            </div>

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="text-center py-4">
                <Text className="text-sm text-gray-400">
                  正在生成更多创意想法...
                </Text>
              </div>
            )}


          </div>
        ) : status === 'idle' ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">🤔尚未开始头脑风暴</h2>
            <p className="text-gray-400 mb-6">
              还没有头脑风暴结果，稍等一下可能就会有
            </p>

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