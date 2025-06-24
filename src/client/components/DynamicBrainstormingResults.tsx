import React, { useState, useCallback } from 'react';
import { Space, Button, Typography, Spin, Empty, Card, Tag, Alert } from 'antd';
import { StopOutlined, ReloadOutlined, EyeOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { ThinkingIndicator } from './shared/ThinkingIndicator';
import { ReasoningIndicator } from './shared/ReasoningIndicator';
import { IdeaWithTitle } from '../types/brainstorm';
import { apiService } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { ReasoningEvent } from '../../common/streaming/types';
// NEW: Import the new streamObject hook
import { ArtifactEditor } from './shared/ArtifactEditor';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useBrainstormLineageResolution } from '../hooks/useLineageResolution';

const { Text } = Typography;

// Component to check for human transforms and show outline generation button
const GenerateOutlineButton: React.FC<{
    artifactId: string;
    path: string;
}> = ({ artifactId, path }) => {
    const projectData = useProjectData();

    // Check if there's a human transform of type 'edit_brainstorm_idea' for this artifact and path
    const humanTransforms = projectData.getHumanTransformsForArtifact(artifactId, path);
    const hasEditTransform = humanTransforms.some(
        transform => transform.transform_name === 'edit_brainstorm_idea'
    );

    const handleGenerateOutline = () => {
        alert('not implemented');
    };

    // Only show button if user has edited the idea
    if (!hasEditTransform) {
        return null;
    }

    return (
        <Button
            type="primary"
            size="small"
            icon={<FileTextOutlined />}
            onClick={handleGenerateOutline}
            style={{
                marginTop: '8px',
                background: 'linear-gradient(100deg, #40a9ff, rgb(22, 106, 184))',
                border: 'none',
                borderRadius: '4px',
                padding: "20px 20px",
                fontSize: "18px"
            }}
        >
            开始生成叙事大纲 &gt;&gt;
        </Button>
    );
};

interface DynamicBrainstormingResultsProps {
    ideas: IdeaWithTitle[];
    onIdeaSelect?: (ideaText: string) => void;
    isStreaming?: boolean;
    isConnecting?: boolean;
    isThinking?: boolean;
    onStop?: () => void;
    onRegenerate?: () => void;
    error?: Error | null;
    selectedIdeaIndex?: number | null;
    canRegenerate?: boolean;
    ideationRunId?: string;
    reasoningEvent?: ReasoningEvent | null;
}

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

// Simplified idea card component that delegates editing to ArtifactEditor
const EditableIdeaCardComponent: React.FC<{
    idea: IdeaWithTitle;
    index: number;
    isSelected: boolean;
    ideaOutlines: any[];
    onIdeaClick: (idea: IdeaWithTitle, index: number) => void;
    resolvedArtifactId?: string | null; // NEW: Pass resolved artifact ID
    hasLineage?: boolean; // NEW: Indicate if there's lineage history
}> = ({ idea, index, isSelected, ideaOutlines, onIdeaClick, resolvedArtifactId, hasLineage }) => {
    const [showSavedCheckmark, setShowSavedCheckmark] = useState(false);



    // Handle successful save - show checkmark briefly
    const handleSaveSuccess = useCallback(() => {
        setShowSavedCheckmark(true);
        setTimeout(() => {
            setShowSavedCheckmark(false);
        }, 2000); // Show checkmark for 2 seconds
    }, []);


    if (idea.artifactId) {
        return (
            <Card
                key={`${idea.artifactId || 'idea'}-${index}`}
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
            >
                <div>
                    {/* Show checkmark if recently saved */}
                    {showSavedCheckmark && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                color: '#52c41a',
                                opacity: 0.9
                            }}
                            title="已保存"
                        >
                            <CheckOutlined />
                        </div>
                    )}

                    <div>
                        {/* Show lineage indicator if there's edit history */}
                        {hasLineage && (
                            <div style={{
                                fontSize: '11px',
                                color: '#1890ff',
                                marginBottom: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span>📝</span>
                                <span>已编辑版本</span>
                            </div>
                        )}

                        <ArtifactEditor
                            artifactId={resolvedArtifactId || idea.artifactId}
                            path={`[${index}]`}
                            transformName="edit_brainstorm_idea"
                            className="!border-none !p-0"
                            onSaveSuccess={handleSaveSuccess}
                        />

                        {/* Generate outline button - only shows if user has edited the idea */}
                        <GenerateOutlineButton
                            artifactId={resolvedArtifactId || idea.artifactId}
                            path={`[${index}]`}
                        />
                    </div>

                    {/* Associated outlines - only show if there are outlines */}
                    {ideaOutlines.length > 0 && (
                        <div style={{
                            borderTop: '1px solid #434343',
                            marginTop: '8px',
                            paddingTop: '8px'
                        }}>
                            <IdeaOutlines
                                ideaId={idea.artifactId || ''}
                                outlines={ideaOutlines}
                                isLoading={false}
                            />
                        </div>
                    )}
                </div>
            </Card>
        );
    }

    // Default read-only view - this should not be reached since we always have artifactId
    // But keeping it as fallback
    return (
        <Card
            key={`${idea.artifactId || 'idea'}-${index}`}
            style={{
                backgroundColor: isSelected ? '#2d3436' : '#262626',
                border: isSelected ? '1px solid #1890ff' : '1px solid #434343',
                cursor: 'text',
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
        >
            <div>
                {/* Show checkmark if recently saved */}
                {idea.artifactId && showSavedCheckmark && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            color: '#52c41a',
                            opacity: 0.9
                        }}
                        title="已保存"
                    >
                        <CheckOutlined />
                    </div>
                )}

                {/* Read-only display */}
                <div style={{ marginBottom: '8px' }}>
                    <Typography.Text strong style={{
                        color: '#d9d9d9',
                        fontSize: '14px'
                    }}>
                        {idea.title}
                    </Typography.Text>
                </div>

                <div style={{ marginBottom: ideaOutlines.length > 0 ? '8px' : '0' }}>
                    <Typography.Text style={{
                        color: '#a6a6a6',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        display: 'block'
                    }}>
                        {idea.body}
                    </Typography.Text>
                </div>

                {/* Generate outline button - only shows if user has edited the idea */}
                {idea.artifactId && (
                    <GenerateOutlineButton
                        artifactId={resolvedArtifactId || idea.artifactId}
                        path={`[${index}]`}
                    />
                )}

                {/* Associated outlines - only show if there are outlines */}
                {ideaOutlines.length > 0 && (
                    <div style={{
                        borderTop: '1px solid #434343',
                        marginTop: '8px',
                        paddingTop: '8px'
                    }}>
                        <IdeaOutlines
                            ideaId={idea.artifactId || ''}
                            outlines={ideaOutlines}
                            isLoading={false}
                        />
                    </div>
                )}
            </div>
        </Card>
    );
};

// Memoized version to prevent unnecessary re-renders
const EditableIdeaCard = React.memo(EditableIdeaCardComponent, (prevProps, nextProps) => {
    const isEqual = (
        prevProps.idea.artifactId === nextProps.idea.artifactId &&
        prevProps.idea.title === nextProps.idea.title &&
        prevProps.idea.body === nextProps.idea.body &&
        prevProps.index === nextProps.index &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.ideaOutlines.length === nextProps.ideaOutlines.length &&
        prevProps.resolvedArtifactId === nextProps.resolvedArtifactId &&
        prevProps.hasLineage === nextProps.hasLineage
        // Note: We don't compare onIdeaClick as it's likely to be a new function each render
    );

    // React.memo should now work properly with stable callbacks
    return isEqual;
});

export const DynamicBrainstormingResults: React.FC<DynamicBrainstormingResultsProps> = ({
    ideas,
    onIdeaSelect,
    isStreaming = false,
    isConnecting = false,
    isThinking = false,
    onStop,
    onRegenerate,
    error,
    selectedIdeaIndex = null,
    canRegenerate = true,
    ideationRunId,
    reasoningEvent
}) => {
    // Debug logging removed - issue should be fixed with proper useCallback usage

    const [ideaOutlines, setIdeaOutlines] = React.useState<{ [ideaId: string]: any[] }>({});
    const [outlinesLoading, setOutlinesLoading] = React.useState(false);
    const navigate = useNavigate();

    // NEW: Get the first idea's artifact ID to use as the collection source
    const collectionArtifactId = ideas.length > 0 ? (ideas[0].artifactId || null) : null;

    // NEW: Use lineage resolution for all brainstorm ideas
    const lineageResolutions = useBrainstormLineageResolution(
        collectionArtifactId,
        ideas.length,
        { enabled: !isStreaming && !isConnecting } // Only resolve when not streaming
    );

    // Debug logging for lineage resolution
    React.useEffect(() => {
        if (collectionArtifactId && Object.keys(lineageResolutions).length > 0) {
            console.log('🔗 Lineage resolutions:', lineageResolutions);

            // Log which ideas have been edited
            Object.entries(lineageResolutions).forEach(([path, resolution]) => {
                if (resolution.hasLineage) {
                    console.log(`📝 Idea ${path} has lineage: ${resolution.originalArtifactId} → ${resolution.latestArtifactId}`);
                }
            });
        }
    }, [collectionArtifactId, lineageResolutions]);

    // Fetch associated outlines when ideationRunId is available
    React.useEffect(() => {
        if (ideationRunId && ideas.length > 0 && !isStreaming) {
            fetchIdeaOutlines();
        }
    }, [ideationRunId, ideas.length, isStreaming]);

    const fetchIdeaOutlines = async () => {
        if (!ideationRunId) return;

        setOutlinesLoading(true);
        try {
            const outlines = await apiService.getIdeaOutlines(ideationRunId);
            setIdeaOutlines(outlines);
        } catch (error) {
            console.error('Error fetching idea outlines:', error);
        } finally {
            setOutlinesLoading(false);
        }
    };

    // Determine streaming status
    const streamingStatus = isConnecting ? 'idle' : isStreaming ? 'streaming' : 'completed';

    // Handle idea selection
    const handleIdeaClick = React.useCallback((idea: IdeaWithTitle, index: number) => {
        const ideaText = `${idea.title}: ${idea.body}`;
        onIdeaSelect?.(ideaText);
    }, [onIdeaSelect]);

    // Callback should now be stable due to proper memoization in parent

    // Determine if reasoning is active
    const isReasoning = reasoningEvent?.type === 'reasoning_start';

    return (
        <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #303030',
            marginBottom: '24px'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                    💡 故事灵感
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>
                    {isConnecting ? '连接中...' : isStreaming ? '正在生成中...' : '选择一个灵感继续'}
                </Text>
            </div>

            {/* Reasoning indicator */}
            <ReasoningIndicator
                isVisible={isReasoning}
                phase="brainstorming"
                className="mb-4"
            />

            {/* Legacy thinking indicator for non-reasoning models */}
            {!isReasoning && isThinking && (
                <ThinkingIndicator
                    isThinking={isThinking}
                    className="mb-4"
                />
            )}

            {/* Streaming progress for non-thinking mode */}
            {!isThinking && (isStreaming || isConnecting) && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #1890ff',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Spin size="small" />
                        <span style={{ color: '#1890ff' }}>
                            {isConnecting ? '正在连接...' : '正在生成灵感...'}
                        </span>
                    </div>
                    {onStop && (
                        <Button
                            size="small"
                            icon={<StopOutlined />}
                            onClick={onStop}
                            style={{
                                background: '#ff4d4f',
                                borderColor: '#ff4d4f',
                                color: 'white'
                            }}
                        >
                            停止
                        </Button>
                    )}
                </div>
            )}

            {/* Error display */}
            {error && (
                <div style={{
                    padding: '12px',
                    marginBottom: '16px',
                    backgroundColor: '#2d1b1b',
                    border: '1px solid #d32f2f',
                    borderRadius: '6px',
                    color: '#fff'
                }}>
                    <Text style={{ color: '#ff6b6b' }}>生成失败: {error.message}</Text>
                </div>
            )}

            {/* Ideas Display */}
            {ideas.length > 0 ? (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {ideas.map((idea, index) => {
                        const isSelected = selectedIdeaIndex === index;
                        const ideaOutlinesForThis = ideaOutlines[idea.artifactId || ''] || [];

                        // NEW: Get lineage resolution for this idea
                        const pathKey = `[${index}]`;
                        const lineageResolution = lineageResolutions[pathKey];
                        const resolvedArtifactId = lineageResolution?.latestArtifactId;
                        const hasLineage = lineageResolution?.hasLineage || false;

                        return (
                            <EditableIdeaCard
                                key={`${idea.artifactId || 'idea'}-${index}`}
                                idea={idea}
                                index={index}
                                isSelected={isSelected}
                                ideaOutlines={ideaOutlinesForThis}
                                onIdeaClick={handleIdeaClick}
                                resolvedArtifactId={resolvedArtifactId}
                                hasLineage={hasLineage}
                            />
                        );
                    })}
                </Space>
            ) : (
                <Empty
                    description={
                        <Text type="secondary">
                            {isConnecting ? '正在连接...' : isStreaming ? '正在生成灵感...' : '暂无灵感'}
                        </Text>
                    }
                    style={{ padding: '40px 0' }}
                />
            )}

            {/* Action buttons */}
            {streamingStatus === 'streaming' && onStop && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Button
                        icon={<StopOutlined />}
                        onClick={onStop}
                        danger
                        size="small"
                    >
                        停止生成
                    </Button>
                </div>
            )}

            {streamingStatus === 'completed' && ideas.length > 0 && onRegenerate && canRegenerate && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={onRegenerate}
                        type="default"
                        size="small"
                    >
                        重新生成
                    </Button>
                </div>
            )}
        </div>
    );
};

export default DynamicBrainstormingResults;
