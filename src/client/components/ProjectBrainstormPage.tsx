import React, { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Space, Button, Typography, Spin, Empty, Card, Tag, Alert } from 'antd';
import { StopOutlined, ReloadOutlined, EyeOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { IdeaWithTitle } from '../../common/utils/lineageResolution'
import { ReasoningIndicator } from './shared/ReasoningIndicator'
import { useProjectData } from '../contexts/ProjectDataContext'
import { useLatestBrainstormIdeas } from '../hooks/useLineageResolution';
import { ArtifactEditor } from './shared/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from './shared/fieldConfigs';

const { Text } = Typography;

// Component to check for human transforms and show outline generation button
const GenerateOutlineButton: React.FC<{
  artifactId: string;
}> = ({ artifactId }) => {
  const projectData = useProjectData();

  // Check if the artifact has been edited (has human source transform)
  const artifact = projectData.getArtifactById(artifactId);
  const hasEditTransform = artifact?.isEditable || false;

  const handleGenerateOutline = () => {
    alert('not implemented');
  };

  // Only show button if user has edited the idea
  if (!hasEditTransform) {
    return null;
  }

  return (
    <>
      <Button
        type="primary"
        size="small"
        icon={<FileTextOutlined />}
        onClick={handleGenerateOutline}
        style={{
          marginTop: '12px',
          marginBottom: '12px',
          background: 'linear-gradient(100deg, #40a9ff, rgb(22, 106, 184))',
          border: 'none',
          borderRadius: '4px',
          padding: "20px 20px",
          fontSize: "18px"
        }}
      >
        用这个灵感继续 &gt;&gt;
      </Button>
      （生成叙事大纲）
    </>
  );
};

// Component to display associated outlines for an idea
const IdeaOutlines: React.FC<{
  ideaId: string;
  outlines: any[];
  isLoading: boolean;
}> = ({ ideaId, outlines, isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ padding: '8px', textAlign: 'center' }}>
        <Spin size="small" />
        <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
          加载关联大纲...
        </Text>
      </div>
    );
  }

  if (outlines.length === 0) {
    return (
      <div style={{ padding: '8px' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          暂无关联大纲
        </Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <Text style={{ fontSize: '12px', fontWeight: 'bold', color: '#d9d9d9' }}>
        关联大纲 ({outlines.length})
      </Text>
      <div style={{ marginTop: '4px' }}>
        {outlines.map((outline, index) => (
          <div
            key={outline.sessionId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              marginBottom: '4px',
              background: '#262626',
              borderRadius: '4px',
              border: '1px solid #434343'
            }}
          >
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: '12px', color: '#d9d9d9' }}>
                {outline.title || '未命名大纲'}
              </Text>
              {outline.genre && (
                <Tag style={{ marginLeft: '4px', fontSize: '10px', padding: '0 4px', height: '18px', lineHeight: '16px' }}>
                  {outline.genre}
                </Tag>
              )}
              {outline.status && (
                <Tag
                  color={outline.status === 'completed' ? 'green' : outline.status === 'failed' ? 'red' : 'blue'}
                  style={{ marginLeft: '4px', fontSize: '10px', padding: '0 4px', height: '18px', lineHeight: '16px' }}
                >
                  {outline.status === 'completed' ? '已完成' :
                    outline.status === 'failed' ? '失败' : '进行中'}
                </Tag>
              )}
            </div>
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation(); // Prevent event bubbling to parent card
                navigate(`/projects/${outline.sessionId}/outline`);
              }}
              style={{ color: '#1890ff', fontSize: '12px' }}
            >
              查看
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Individual idea card component using ArtifactEditor
const BrainstormIdeaCard: React.FC<{
  artifactId: string;
  artifactPath: string;
  originalCollectionId: string;
  index: number;
  isSelected: boolean;
  ideaOutlines: any[];
  onIdeaClick: (collectionId: string, index: number) => void;
  debugInfo?: string;
}> = ({ artifactId, artifactPath, originalCollectionId, index, isSelected, ideaOutlines, onIdeaClick, debugInfo }) => {
  const [showSavedCheckmark, setShowSavedCheckmark] = useState(false);
  const projectData = useProjectData();

  // Determine the correct transform name based on artifact type and path
  const artifact = projectData.getArtifactById(artifactId);

  // For standalone brainstorm ideas (path '$'), use edit_brainstorm_idea
  // For collection ideas (path like '$.ideas[0]'), use edit_brainstorm_collection_idea
  const transformName = artifactPath === '$' ? 'edit_brainstorm_idea' : 'edit_brainstorm_collection_idea';

  // Check if this is a derived artifact (has been edited)
  const hasBeenEdited = artifact?.type === 'user_input' || artifact?.isEditable || false;

  // Handle successful save - show checkmark briefly
  const handleSaveSuccess = useCallback(() => {
    setShowSavedCheckmark(true);
    setTimeout(() => {
      setShowSavedCheckmark(false);
    }, 2000); // Show checkmark for 2 seconds
  }, []);

  return (
    <Card
      key={`${artifactId}-${index}`}
      style={{
        backgroundColor: isSelected ? '#2d3436' : '#262626',
        border: isSelected ? '1px solid #1890ff' : '1px solid #434343',
        transition: 'all 0.2s ease',
        animation: 'fadeIn 0.3s ease-out',
        position: 'relative'
      }}
      styles={{ body: { padding: '12px' } }}
      hoverable={!isSelected}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#1890ff';
          e.currentTarget.style.backgroundColor = '#2d3436';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#434343';
          e.currentTarget.style.backgroundColor = '#262626';
        }
      }}
      onClick={() => onIdeaClick(originalCollectionId, index)}
    >
      {/* Saved checkmark overlay */}
      {showSavedCheckmark && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            background: '#52c41a',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeInOut 2s ease-in-out'
          }}
        >
          <CheckOutlined style={{ color: 'white', fontSize: '12px' }} />
        </div>
      )}

      {/* Idea content using ArtifactEditor */}
      <ArtifactEditor
        artifactId={artifactId}
        path={artifactPath}
        fields={BRAINSTORM_IDEA_FIELDS}
        statusLabel={hasBeenEdited ? "📝 已编辑版本" : "AI生成"}
        statusColor={hasBeenEdited ? "#52c41a" : "#1890ff"}
        transformName={transformName}
        onSaveSuccess={handleSaveSuccess}
      />

      {/* DEBUG: Show debug info if available */}
      {debugInfo && (
        <div style={{
          marginTop: '8px',
          padding: '4px 8px',
          background: '#3b3b3b',
          borderRadius: '4px',
          fontSize: '10px',
          color: '#888',
          fontFamily: 'monospace'
        }}>
          🐛 {debugInfo}
        </div>
      )}

      {/* Generate outline button */}
      <GenerateOutlineButton artifactId={artifactId} />

      {/* Associated outlines */}
      <IdeaOutlines
        ideaId={artifactId}
        outlines={ideaOutlines}
        isLoading={false}
      />
    </Card>
  );
};

export default function ProjectBrainstormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const [ideaOutlines, setIdeaOutlines] = useState<Record<string, any[]>>({});
  const [loadingOutlines, setLoadingOutlines] = useState<Record<string, boolean>>({});
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(true);

  if (!projectId) {
    navigate('/projects')
    return null
  }

  // Use unified project data context
  const projectData = useProjectData()

  // Get latest brainstorm ideas using the new hook
  const latestIdeas = useLatestBrainstormIdeas();

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

  // Handle idea card click
  const handleIdeaClick = useCallback((collectionId: string, index: number) => {
    setSelectedIdea(prev => prev === index ? null : index);
  }, []);

  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    // TODO: Implement regeneration logic
    console.log('Regenerate brainstorm ideas');
  }, []);

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
                <Text className="text-lg font-semibold text-white">
                  创意想法 ({ideas.length})
                </Text>
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
                {/* DEBUG: Toggle button for debug info */}
                <Button
                  type="dashed"
                  size="small"
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  style={{ fontSize: '10px' }}
                >
                  🐛 {showDebugInfo ? '隐藏' : '显示'}调试
                </Button>

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
                {!isStreaming && (
                  <Button
                    type="default"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={handleRegenerate}
                  >
                    重新生成
                  </Button>
                )}
              </div>
            </div>

            {/* Ideas grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ideas.map((idea, index) => {
                if (!idea.artifactId || !idea.originalArtifactId || !idea.artifactPath) return null;

                return (
                  <BrainstormIdeaCard
                    key={`${idea.artifactId}-${index}`}
                    artifactId={idea.artifactId}
                    artifactPath={idea.artifactPath}
                    originalCollectionId={idea.originalArtifactId}
                    index={index}
                    isSelected={selectedIdea === index}
                    ideaOutlines={ideaOutlines[idea.artifactId || ''] || []}
                    onIdeaClick={handleIdeaClick}
                    debugInfo={showDebugInfo ? idea.debugInfo : undefined}
                  />
                );
              })}
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