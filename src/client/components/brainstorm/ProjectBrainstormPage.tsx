import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import { IdeaWithTitle } from '../../../common/transform-artifact-framework/lineageResolution';
import { ReasoningIndicator, SectionWrapper, } from '../shared';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLatestBrainstormIdeas } from '../../transform-artifact-framework/useLineageResolution';
import { useChosenBrainstormIdea } from '../../hooks/useChosenBrainstormIdea';
import { useActionItemsStore } from '../../stores/actionItemsStore';
import { BrainstormIdeaEditor } from './BrainstormIdeaEditor';

const { Text } = Typography;

// Wrapper component to handle editable descendants detection
const IdeaCardWrapper: React.FC<{
  idea: IdeaWithTitle;
  index: number;
  isSelected: boolean;
  chosenIdea: any;
  ideaOutlines: any[];
  onIdeaClick: (collectionId: string, index: number) => void;
  readOnly?: boolean;
}> = ({ idea, index, isSelected, chosenIdea, ideaOutlines, onIdeaClick, readOnly = false }) => {
  const projectData = useProjectData();

  // Check if this idea has descendants (transforms using it as input)
  const hasEditableDescendants = useMemo(() => {
    if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
      return false;
    }
    return projectData.transformInputs.some(input =>
      input.artifact_id === idea.artifactId
    );
  }, [projectData.transformInputs, idea.artifactId]);

  // Check if this idea is the chosen one
  // Handle both original artifacts (collection items) and edited artifacts (standalone)
  const isChosenIdea = chosenIdea && (
    // Case 1: Original artifact comparison (for unedited ideas in collections)
    (chosenIdea.originalArtifactId === idea.originalArtifactId &&
      chosenIdea.originalArtifactPath === idea.artifactPath) ||
    // Case 2: Edited artifact comparison (for edited ideas that became standalone)
    (chosenIdea.editableArtifactId === idea.artifactId &&
      idea.artifactPath === '$')
  );

  // Ensure we have the required fields - check after all hooks are called
  if (!idea.artifactId || !idea.originalArtifactId || !idea.artifactPath) {
    return null;
  }

  return (
    <BrainstormIdeaEditor
      artifactId={idea.artifactId}
      artifactPath={idea.artifactPath}
      originalCollectionId={idea.originalArtifactId}
      index={index}
      isSelected={isSelected}
      isChosen={!!isChosenIdea}
      hasEditableDescendants={hasEditableDescendants || readOnly} // Treat read-only as having descendants to disable clicks
      ideaOutlines={ideaOutlines}
      onIdeaClick={readOnly ? () => { } : onIdeaClick} // Disable clicks in read-only mode
    />
  );
};

interface ProjectBrainstormPageProps {
  ideas?: IdeaWithTitle[];
  selectionMode?: boolean;
  isLoading?: boolean;
  readOnly?: boolean;
}

export default function ProjectBrainstormPage(props: ProjectBrainstormPageProps = {}) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [ideaOutlines, setIdeaOutlines] = useState<Record<string, any[]>>({});

  // Extract props with defaults
  const {
    ideas: propsIdeas,
    selectionMode: propsSelectionMode,
    isLoading: propsIsLoading,
    readOnly = false
  } = props;

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

  // Use action items store for selection
  const store = useActionItemsStore(projectId);

  // Extract brainstorm data using the new collection-based approach as fallback
  const { ideas: fallbackIdeas, status, progress, error, isLoading, lastSyncedAt } = useMemo(() => {
    // If we have latest ideas from the hook, use those
    if (latestIdeas !== "pending" && latestIdeas !== "error" && latestIdeas.length > 0) {
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

    if (collections === "pending") {
      return {
        ideas: [],
        status: 'idle' as const,
        progress: 0,
        error: null,
        isLoading: projectData.isLoading,
        lastSyncedAt: null
      }
    }

    if (collections === "error") {
      return {
        ideas: [],
        status: 'failed' as const,
        progress: 0,
        error: projectData.error?.message || null,
        isLoading: projectData.isLoading,
        lastSyncedAt: null
      }
    }

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
    const ideas: IdeaWithTitle[] = []
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
  }, [latestIdeas, projectData.isLoading, projectData.error]);

  // Use the better data source - prioritize props when available
  const ideas = useMemo(() => {

    // If props provide ideas, use them (for read-only mode)
    if (propsIdeas && propsIdeas.length > 0) {
      return propsIdeas;
    }

    // Otherwise use the computed data
    if (latestIdeas === "pending" || latestIdeas === "error") {
      return fallbackIdeas;
    }
    const finalIdeas = latestIdeas.length > 0 ? latestIdeas : fallbackIdeas;
    return finalIdeas;
  }, [propsIdeas, latestIdeas, fallbackIdeas]);

  const isStreaming = propsIsLoading ?? status === 'streaming';
  const isConnecting = (propsIsLoading ?? isLoading) && ideas.length === 0;

  // Determine if we should show collapsed view
  const isCollapsedView = chosenIdea && !chosenIdeaLoading;

  // Determine if we're in selection mode
  const inSelectionMode = propsSelectionMode ?? (!chosenIdea && !readOnly);

  // Handle idea card click - store selection in action items store
  const handleIdeaClick = useCallback((collectionId: string, index: number) => {
    // Don't handle clicks if in read-only mode
    if (readOnly) {
      return;
    }

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

    console.log('[ProjectBrainstormPage] Selecting idea:', {
      index,
      clickedIdea
    });

    // Store selection in action items store
    store.setSelectedBrainstormIdea({
      artifactId: clickedIdea.artifactId,
      originalArtifactId: clickedIdea.originalArtifactId || clickedIdea.artifactId,
      artifactPath: clickedIdea.artifactPath,
      index: index,
      title: clickedIdea.title
    });
  }, [readOnly, chosenIdea, ideas, store]);

  // Handle stop streaming
  const handleStop = useCallback(() => {
    // TODO: Implement stop streaming logic
    console.log('Stop brainstorm streaming');
  }, []);

  // Determine selected idea index for visual feedback
  const selectedIdea = store.selectedBrainstormIdea?.index ?? null;

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
    <SectionWrapper
      schemaType={"brainstorm_collection"}
      title="头脑风暴"
      sectionId="brainstorm-ideas"
    >
      <div className={`${isCollapsedView ? 'bg-gray-900' : 'min-h-screen bg-gray-900'} text-white`}>
        <div className={`container mx-auto px-4 ${isCollapsedView ? 'py-4' : 'py-8'}`}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
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

              {/* Selection instruction */}
              {inSelectionMode && !chosenIdea && (
                <div className="text-center py-4 " style={{ padding: "12px 12px" }}>
                  <Text className="text-gray-400" >
                    {store.selectedBrainstormIdea
                      ? `已选择创意 ${store.selectedBrainstormIdea.index + 1}，请使用下方的操作面板确认选择`
                      : '点击选择一个创意想法继续开发'
                    }
                  </Text>
                </div>
              )}

              {/* Read-only mode instruction */}
              {readOnly && (
                <div className="text-center py-4 " style={{ padding: "12px 12px" }}>
                  <Text className="text-gray-400">
                    创意回顾 - 这些是之前生成的创意想法
                  </Text>
                </div>
              )}

              {/* Ideas grid - responsive layout based on collapsed state */}
              <div className={isCollapsedView
                ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              } style={{ padding: "12px 12px" }}>
                {ideas.map((idea, index) => (
                  <IdeaCardWrapper
                    key={`${idea.artifactId}-${index}`}
                    idea={idea}
                    index={index}
                    isSelected={selectedIdea === index}
                    chosenIdea={chosenIdea}
                    ideaOutlines={ideaOutlines[idea.artifactId || ''] || []}
                    onIdeaClick={handleIdeaClick}
                    readOnly={readOnly}
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
    </SectionWrapper>
  )
} 