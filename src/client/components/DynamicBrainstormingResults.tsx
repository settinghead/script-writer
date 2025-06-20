import React from 'react';
import { Space, Button, Typography, Spin, Empty, Card, Tag, Alert } from 'antd';
import { StopOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { IdeaCard } from './shared/streaming';
import { ThinkingIndicator } from './shared/ThinkingIndicator';
import { ReasoningIndicator } from './shared/ReasoningIndicator';
import { IdeaWithTitle } from '../types/brainstorm';
import { apiService } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { ReasoningEvent } from '../../common/streaming/types';
// NEW: Import the new streamObject hook
import { useBrainstormingStream } from '../hooks/useStreamObject';

const { Text } = Typography;

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
                                <Tag size="small" style={{ marginLeft: '4px', fontSize: '10px' }}>
                                    {outline.genre}
                                </Tag>
                            )}
                            {outline.status && (
                                <Tag
                                    size="small"
                                    color={outline.status === 'completed' ? 'green' : outline.status === 'failed' ? 'red' : 'blue'}
                                    style={{ marginLeft: '4px', fontSize: '10px' }}
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
    const [ideaOutlines, setIdeaOutlines] = React.useState<{ [ideaId: string]: any[] }>({});
    const [outlinesLoading, setOutlinesLoading] = React.useState(false);
    const navigate = useNavigate();

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
        onIdeaSelect(ideaText);
    }, [onIdeaSelect]);

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

                        return (
                            <Card
                                key={`${idea.artifactId || 'idea'}-${index}`}
                                style={{
                                    backgroundColor: isSelected ? '#2d3436' : '#262626',
                                    border: isSelected ? '1px solid #1890ff' : '1px solid #434343',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    animation: 'fadeIn 0.3s ease-out'
                                }}
                                styles={{ body: { padding: '12px' } }}
                                hoverable={!isSelected}
                                onClick={() => handleIdeaClick(idea, index)}
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
                                    {/* Idea header */}
                                    <div style={{ marginBottom: '8px' }}>
                                        <Text strong style={{
                                            color: '#d9d9d9',
                                            fontSize: '14px'
                                        }}>
                                            {idea.title}
                                        </Text>
                                    </div>

                                    {/* Idea body */}
                                    <Text style={{
                                        color: '#a6a6a6',
                                        fontSize: '13px',
                                        lineHeight: '1.4',
                                        display: 'block',
                                        marginBottom: ideaOutlinesForThis.length > 0 ? '8px' : '0'
                                    }}>
                                        {idea.body}
                                    </Text>

                                    {/* Associated outlines - only show if there are outlines */}
                                    {ideaOutlinesForThis.length > 0 && (
                                        <div style={{
                                            borderTop: '1px solid #434343',
                                            marginTop: '8px',
                                            paddingTop: '8px'
                                        }}>
                                            <IdeaOutlines
                                                ideaId={idea.artifactId || ''}
                                                outlines={ideaOutlinesForThis}
                                                isLoading={false}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Card>
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

/**
 * NEW: Modern brainstorming component using AI SDK streamObject
 * This replaces the complex manual JSON parsing with clean, typed streaming
 */
export const ModernBrainstormingResults: React.FC<{
    initialParams: {
        platform: string;
        genrePaths: string[][];
        genreProportions: number[];
        requirements: string;
    };
    onIdeaSelect: (ideaText: string) => void;
    ideationRunId?: string;
}> = ({
    initialParams,
    onIdeaSelect,
    ideationRunId
}) => {
        const navigate = useNavigate();
        const [selectedIdeaIndex, setSelectedIdeaIndex] = React.useState<number | null>(null);

        // Use the new streamObject hook - much simpler!
        const brainstormingStream = useBrainstormingStream((ideas) => {
            console.log('Brainstorming completed:', ideas);
            // You could save the results to artifacts here if needed
        });

        // Auto-start streaming when component mounts
        React.useEffect(() => {
            if (initialParams) {
                brainstormingStream.submit(initialParams);
            }
        }, []); // Only run once

        // Handle idea selection
        const handleIdeaClick = React.useCallback((idea: any, index: number) => {
            const ideaText = `${idea.title}: ${idea.body}`;
            setSelectedIdeaIndex(index);
            onIdeaSelect(ideaText);
        }, [onIdeaSelect]);

        const handleRegenerate = () => {
            brainstormingStream.submit(initialParams);
            setSelectedIdeaIndex(null);
        };

        if (brainstormingStream.error) {
            return (
                <div style={{
                    padding: '16px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #ff4d4f',
                    marginBottom: '24px'
                }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text style={{ color: '#ff6b6b' }}>生成失败: {brainstormingStream.error.message}</Text>
                        <Button size="small" onClick={handleRegenerate}>
                            重新生成
                        </Button>
                    </Space>
                </div>
            );
        }

        if (brainstormingStream.isLoading && !brainstormingStream.object) {
            return (
                <div style={{
                    padding: '16px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #303030',
                    marginBottom: '24px',
                    textAlign: 'center'
                }}>
                    <Space direction="vertical" align="center" style={{ width: '100%' }}>
                        <Spin size="large" />
                        <Text type="secondary">正在生成创意灵感...</Text>
                        {brainstormingStream.isStreaming && (
                            <Button
                                danger
                                size="small"
                                icon={<StopOutlined />}
                                onClick={brainstormingStream.stop}
                            >
                                停止生成
                            </Button>
                        )}
                    </Space>
                </div>
            );
        }

        const ideas = brainstormingStream.object || [];

        if (ideas.length === 0) {
            return (
                <div style={{
                    padding: '40px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #303030',
                    marginBottom: '24px',
                    textAlign: 'center'
                }}>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无创意灵感"
                    >
                        <Button type="primary" onClick={handleRegenerate}>
                            开始生成
                        </Button>
                    </Empty>
                </div>
            );
        }

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
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                            <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                                💡 故事灵感 ({ideas.length})
                            </Text>
                            {brainstormingStream.isStreaming && (
                                <Spin size="small" />
                            )}
                        </Space>
                        <Space>
                            {brainstormingStream.isStreaming && (
                                <Button
                                    size="small"
                                    danger
                                    icon={<StopOutlined />}
                                    onClick={brainstormingStream.stop}
                                >
                                    停止
                                </Button>
                            )}
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={handleRegenerate}
                                disabled={brainstormingStream.isStreaming}
                            >
                                重新生成
                            </Button>
                        </Space>
                    </Space>
                </div>

                {/* Ideas list */}
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {ideas.map((idea, index) => {
                        const isSelected = selectedIdeaIndex === index;

                        return (
                            <Card
                                key={`${idea.artifactId || 'idea'}-${index}`}
                                style={{
                                    backgroundColor: isSelected ? '#2d3436' : '#262626',
                                    border: isSelected ? '1px solid #1890ff' : '1px solid #434343',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                bodyStyle={{ padding: '12px' }}
                                hoverable={!isSelected}
                                onClick={() => handleIdeaClick(idea, index)}
                            >
                                <div>
                                    <div style={{ marginBottom: '8px' }}>
                                        <Text strong style={{
                                            color: '#d9d9d9',
                                            fontSize: '14px'
                                        }}>
                                            {idea.title}
                                        </Text>
                                    </div>

                                    <Text style={{
                                        color: '#a6a6a6',
                                        fontSize: '13px',
                                        lineHeight: '1.4',
                                        display: 'block'
                                    }}>
                                        {idea.body}
                                    </Text>
                                </div>
                            </Card>
                        );
                    })}
                </Space>

                {brainstormingStream.isStreaming && (
                    <div style={{ marginTop: '16px', textAlign: 'center' }}>
                        <Text type="secondary">
                            <Spin size="small" style={{ marginRight: 8 }} />
                            正在生成更多创意...
                        </Text>
                    </div>
                )}
            </div>
        );
    }; 