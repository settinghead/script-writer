import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space } from 'antd';
import { IdeaWithTitle } from '../../../common/types';
import { ReasoningIndicator, SectionWrapper, } from '../shared';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLatestBrainstormIdeas } from '../../transform-jsondoc-framework/useLineageResolution';
import { useChosenBrainstormIdea } from '../../hooks/useChosenBrainstormIdea';
import { useActionItemsStore } from '../../stores/actionItemsStore';
import { BrainstormIdeaEditor } from './BrainstormIdeaEditor';
import { DownOutlined, UpOutlined } from '@ant-design/icons';

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
      input.jsondoc_id === idea.jsondocId
    );
  }, [projectData.transformInputs, idea.jsondocId]);

  // Check if this idea is the chosen one
  // Handle both original jsondocs (collection items) and edited jsondocs (standalone)
  const isChosenIdea = chosenIdea && (
    // Case 1: Original jsondoc comparison (for unedited ideas in collections)
    (chosenIdea.originalJsondocId === idea.originalJsondocId &&
      chosenIdea.originalJsondocPath === idea.jsondocPath) ||
    // Case 2: Edited jsondoc comparison (for edited ideas that became standalone)
    (chosenIdea.editableJsondocId === idea.jsondocId &&
      idea.jsondocPath === '$')
  );

  // Ensure we have the required fields - check after all hooks are called
  if (!idea.jsondocId || !idea.originalJsondocId || !idea.jsondocPath) {
    return null;
  }

  return (
    <BrainstormIdeaEditor
      jsondocId={idea.jsondocId}
      jsondocPath={idea.jsondocPath}
      originalCollectionId={idea.originalJsondocId}
      index={index}
      isSelected={isSelected}
      isChosen={!!isChosenIdea}
      hasEditableDescendants={hasEditableDescendants || readOnly} // Treat read-only as having descendants to disable clicks
      isHistory={readOnly && !isChosenIdea}
      ideaOutlines={ideaOutlines}
      onIdeaClick={readOnly ? () => { } : onIdeaClick} // Disable clicks in read-only mode
    />
  );
};

interface IdeaCollection {
  ideas?: IdeaWithTitle[];
  selectionMode?: boolean;
  isLoading?: boolean;
  readOnly?: boolean;
}

export default function IdeaCollection(props: IdeaCollection = {}) {
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

  // When a chosen idea exists, build read-only items from the canonical brainstorm collection
  const collectionIdeasWhenChosen = useMemo((): IdeaWithTitle[] => {
    try {
      if (!chosenIdea || chosenIdeaLoading) return [];
      if (!projectData || !projectData.canonicalContext || projectData.canonicalContext === 'pending' || projectData.canonicalContext === 'error') return [];
      const collection = projectData.canonicalContext.canonicalBrainstormCollection;
      if (!collection || !collection.data) return [];

      const data = typeof collection.data === 'string' ? JSON.parse(collection.data) : collection.data;
      const ideasArray: any[] = Array.isArray(data) ? data : Array.isArray(data?.ideas) ? data.ideas : [];
      return ideasArray.map((idea: any, index: number) => ({
        title: idea.title || `创意 ${index + 1}`,
        body: idea.body || idea.description || '',
        jsondocId: collection.id,
        originalJsondocId: collection.id,
        jsondocPath: `$.ideas[${index}]`,
        index
      }));
    } catch {
      return [];
    }
  }, [chosenIdea, chosenIdeaLoading, projectData.canonicalContext]);

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
    const collections = projectData.getIdeaCollections();

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
              const ideaData = {
                title: `想法 ${ideas.length + 1}`,
                body: '内容加载中...',
                jsondocId: `${collection.id}-${i}`,
                originalJsondocId: collection.id,
                jsondocPath: `$.ideas[${i}]`,
                index: ideas.length
              };

              ideas.push(ideaData);
            }
          }

          lastSyncedAt = collection.updated_at || collection.created_at;

          if (collection.streaming_status === 'streaming') {
            status = 'streaming';
            progress = 50;
          }

        } catch (parseErr) {
          // Skip invalid collections
        }
      }

    } catch (err) {
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

    // If a chosen idea exists and we can load the original collection, prefer showing the collection
    if (collectionIdeasWhenChosen.length > 0) {
      return collectionIdeasWhenChosen;
    }

    // Otherwise use the computed data
    if (latestIdeas === "pending" || latestIdeas === "error") {
      return fallbackIdeas;
    }
    const finalIdeas = latestIdeas.length > 0 ? latestIdeas : fallbackIdeas;

    return finalIdeas;
  }, [propsIdeas, latestIdeas, fallbackIdeas, collectionIdeasWhenChosen]);

  const isStreaming = propsIsLoading ?? status === 'streaming';
  const isConnecting = (propsIsLoading ?? isLoading) && ideas.length === 0;

  // Determine if we should show collapsed view
  // Show collapsed view if we have a chosen idea OR if we only have individual ideas (not collections)
  const hasOnlyIndividualIdeas = ideas.length === 1 && ideas[0]?.jsondocPath === '$';
  // Collapsible behavior: default collapsed if an idea has been chosen
  const [collapsed, setCollapsed] = useState<boolean>(!!chosenIdea);
  const isCollapsedView = (chosenIdea && !chosenIdeaLoading && collapsed) || hasOnlyIndividualIdeas;

  // Determine if we're in selection mode
  // Don't show selection mode if we only have individual ideas
  const isReadOnly = readOnly || !!chosenIdea;
  const inSelectionMode = propsSelectionMode ?? (!chosenIdea && !isReadOnly && !hasOnlyIndividualIdeas);

  // Handle idea card click - store selection in action items store
  const handleIdeaClick = useCallback((collectionId: string, index: number) => {
    // Don't handle clicks if in read-only mode
    if (isReadOnly) {
      return;
    }

    // Don't handle clicks if we already have a chosen idea
    if (chosenIdea) {
      return;
    }

    // Find the idea that was clicked
    const clickedIdea = ideas[index];
    if (!clickedIdea || !clickedIdea.jsondocId || !clickedIdea.jsondocPath) {
      return;
    }

    // Store selection in action items store
    store.setSelectedJsondocAndPath({
      jsondocId: clickedIdea.jsondocId,
      originalJsondocId: clickedIdea.originalJsondocId || clickedIdea.jsondocId,
      jsondocPath: clickedIdea.jsondocPath,
      index: index,
      title: clickedIdea.title
    });
  }, [isReadOnly, chosenIdea, ideas, store]);

  // Handle stop streaming
  const handleStop = useCallback(() => {
    // TODO: Implement stop streaming logic
  }, []);

  // Determine selected idea index for visual feedback
  // Match based on jsondoc ID and path, not just index
  const getIsIdeaSelected = useCallback((idea: IdeaWithTitle, index: number) => {
    if (!store.selectedJsondocAndPath) return false;

    const selected = store.selectedJsondocAndPath;

    // First try to match by jsondoc ID and path (most precise)
    if (selected.jsondocId === idea.jsondocId && selected.jsondocPath === idea.jsondocPath) {
      return true;
    }

    // Fallback to original jsondoc ID and path matching (for collection items)
    if (selected.originalJsondocId === idea.originalJsondocId &&
      selected.jsondocPath === idea.jsondocPath) {
      return true;
    }

    // Final fallback to index matching (for backward compatibility)
    return selected.index === index;
  }, [store.selectedJsondocAndPath]);

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

  // Determine schema type based on whether we have individual ideas or collections
  const sectionSchemaType = hasOnlyIndividualIdeas ? "灵感创意" : "brainstorm_collection";
  const sectionJsondocId = hasOnlyIndividualIdeas ? ideas[0]?.jsondocId : undefined;

  return (
    <SectionWrapper
      schemaType={sectionSchemaType}
      title="头脑风暴"
      sectionId="ideas"
      jsondocId={sectionJsondocId}
    >
      {hasOnlyIndividualIdeas ? (
        // For individual ideas, show a collapsed summary with the idea title
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{
            padding: '12px 20px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            border: '1px solid #444',
            display: 'inline-block'
          }}>
            <Text style={{ color: '#1890ff', fontSize: '14px', fontWeight: 500 }}>
              已选择创意: {ideas[0]?.title}
            </Text>
          </div>
          <div style={{ marginTop: '8px' }}>
            <Text style={{ color: '#666', fontSize: '12px' }}>
              头脑风暴已完成 - 详细内容请查看下方创意编辑区
            </Text>
          </div>
        </div>
      ) : (
        // For collections, use the existing card-based rendering
        <div className={`bg-gray-900 text-white`}>
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
                {/* Collapse button when expanded with chosen idea */}
                {chosenIdea && !collapsed && (
                  <Button type="link" size="small" icon={<UpOutlined />} onClick={() => setCollapsed(true)}>
                    收起创意回顾
                  </Button>
                )}
              </div>


            </div>

            {/* Collapsed summary when a chosen idea exists */}
            {chosenIdea && collapsed && (
              <div className="text-center py-4" style={{ padding: '12px 12px' }}>
                <div
                  onClick={() => setCollapsed(false)}
                  role="button"
                  aria-label="展开原始创意"
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    display: 'inline-block',
                    cursor: 'pointer'
                  }}
                >
                  <Text style={{ color: '#1890ff', fontSize: '14px', fontWeight: 500 }}>
                    已选择创意: {collectionIdeasWhenChosen[0]?.title || '创意'}
                  </Text>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text className="text-gray-400">头脑风暴已完成。点击上方卡片展开原始创意</Text>
                </div>
              </div>
            )}

            {/* Results */}
            {!chosenIdea || !collapsed ? (
              ideas.length > 0 ? (
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

                  </div>

                  {/* Selection instruction */}
                  {inSelectionMode && !chosenIdea && (
                    <div className="text-center py-4 " style={{ padding: "12px 12px" }}>
                      <Text className="text-gray-400" >
                        {store.selectedJsondocAndPath
                          ? `已选择创意 ${store.selectedJsondocAndPath.title}，请使用下方的操作面板确认选择`
                          : '点击选择一个创意想法继续开发'
                        }
                      </Text>
                    </div>
                  )}

                  {/* Individual idea mode instruction */}
                  {hasOnlyIndividualIdeas && !isReadOnly && (
                    <div className="text-center py-4 " style={{ padding: "12px 12px" }}>
                      <Text className="text-gray-400">
                        当前创意 - 您可以继续编辑或进入下一步骤
                      </Text>
                    </div>
                  )}

                  {/* Read-only mode instruction */}
                  {isReadOnly && (
                    <div className="text-center py-4 " style={{ padding: "12px 12px" }}>
                      <Text className="text-gray-400">
                        创意回顾 - 这些是之前生成的创意想法
                      </Text>
                    </div>
                  )}

                  {/* Ideas grid - responsive layout based on collapsed state and content type */}
                  <div className={
                    hasOnlyIndividualIdeas
                      ? "grid grid-cols-1 gap-6" // Full width for individual ideas
                      : isCollapsedView
                        ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
                        : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  } style={{ padding: "12px 12px" }}>
                    {(() => {
                      return ideas.map((idea, index) => {
                        return (
                          <IdeaCardWrapper
                            key={`${idea.jsondocId}-${index}`}
                            idea={idea}
                            index={index}
                            isSelected={getIsIdeaSelected(idea, index)}
                            chosenIdea={chosenIdea}
                            ideaOutlines={ideaOutlines[idea.jsondocId || ''] || []}
                            onIdeaClick={handleIdeaClick}
                            readOnly={isReadOnly}
                          />
                        );
                      });
                    })()}
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
              )) : null}
          </div>
        </div>
      )}
    </SectionWrapper>
  )
} 