import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Spin, Alert, Space, Card } from 'antd';
import { StopOutlined, BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import { ThinkingIndicator } from './shared/ThinkingIndicator';
import { ReasoningIndicator } from './shared/ReasoningIndicator';

const { Text, Title } = Typography;

interface IdeaWithTitle {
    title: string;
    body: string;
    artifactId?: string;
}

interface ProjectBrainstormPageProps {}

const ProjectBrainstormPage: React.FC<ProjectBrainstormPageProps> = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    // Get parameters from URL
    const transformId = searchParams.get('transform');
    const ideationRunId = searchParams.get('ideationRun');
    
    // Component state
    const [ideas, setIdeas] = useState<IdeaWithTitle[]>([]);
    const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isReasoning, setIsReasoning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSelectingIdea, setIsSelectingIdea] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Set up EventSource for streaming when transformId is available
    useEffect(() => {
        if (!transformId) return;

        let eventSource: EventSource | null = null;
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 2000;

        const connectToStream = () => {
            try {
                setIsConnecting(true);
                setError(null);
                
                eventSource = new EventSource(`/api/streaming/transform/${transformId}`);
                
                eventSource.onopen = () => {
                    console.log('[ProjectBrainstorm] Connected to stream');
                    setIsConnecting(false);
                    setIsStreaming(true);
                    retryCount = 0;
                };
                
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'thinking') {
                            setIsThinking(data.isThinking);
                        } else if (data.type === 'reasoning') {
                            setIsReasoning(data.isReasoning);
                        } else if (data.type === 'progress') {
                            // Handle progress updates
                            console.log('[ProjectBrainstorm] Progress:', data);
                        } else if (data.type === 'data') {
                            // Handle idea data
                            if (data.ideas && Array.isArray(data.ideas)) {
                                setIdeas(data.ideas);
                            }
                        } else if (data.type === 'completed') {
                            console.log('[ProjectBrainstorm] Stream completed');
                            setIsStreaming(false);
                            setIsThinking(false);
                            setIsReasoning(false);
                            
                            // Final ideas from completion
                            if (data.ideas && Array.isArray(data.ideas)) {
                                setIdeas(data.ideas);
                            }
                        } else if (data.type === 'error') {
                            console.error('[ProjectBrainstorm] Stream error:', data.message);
                            setError(data.message);
                            setIsStreaming(false);
                            setIsThinking(false);
                            setIsReasoning(false);
                        }
                    } catch (err) {
                        console.error('[ProjectBrainstorm] Error parsing stream data:', err);
                    }
                };
                
                eventSource.onerror = (event) => {
                    console.error('[ProjectBrainstorm] EventSource error:', event);
                    setIsConnecting(false);
                    setIsStreaming(false);
                    
                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`[ProjectBrainstorm] Retrying connection (${retryCount}/${maxRetries})...`);
                        setTimeout(connectToStream, retryDelay);
                    } else {
                        setError('连接失败，请刷新页面重试');
                    }
                };
                
            } catch (err) {
                console.error('[ProjectBrainstorm] Error setting up EventSource:', err);
                setError('无法连接到流式服务');
                setIsConnecting(false);
            }
        };

        connectToStream();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [transformId]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleIdeaSelection = useCallback((index: number) => {
        if (isSelectingIdea) return;

        setIsSelectingIdea(true);
        const idea = ideas[index];
        const ideaText = `${idea.title}: ${idea.body}`;

        setSelectedIdeaIndex(index);

        // Add a small delay to allow the selection animation to be visible
        setTimeout(() => {
            // TODO: Navigate to outline generation with selected idea
            console.log('Selected idea:', ideaText);
            
            // For now, just navigate to the project outline page
            navigate(`/projects/${projectId}/outline`, {
                state: { selectedIdea: ideaText }
            });
            
            setIsSelectingIdea(false);
        }, 300);
    }, [ideas, isSelectingIdea, navigate, projectId]);

    const handleStopStreaming = () => {
        // TODO: Implement stop streaming API call
        console.log('Stop streaming requested');
        setIsStreaming(false);
        setIsThinking(false);
        setIsReasoning(false);
    };

    const handleRegenerate = () => {
        // TODO: Implement regeneration
        console.log('Regenerate requested');
        window.location.reload(); // Simple approach for now
    };

    if (!projectId) {
        return (
            <Alert
                message="错误"
                description="项目ID缺失"
                type="error"
                showIcon
            />
        );
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Card
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #303030',
                    marginBottom: '24px'
                }}
                bodyStyle={{ padding: '24px' }}
            >
                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: '8px' }}>
                        💡 创意头脑风暴
                    </Title>
                    <Text type="secondary">
                        {isConnecting ? '正在连接...' : 
                         isStreaming ? '正在生成创意想法...' : 
                         ideas.length > 0 ? '选择一个创意想法继续项目开发' : 
                         '等待生成创意想法'}
                    </Text>
                </div>

                {/* Error display */}
                {error && (
                    <Alert
                        message="生成失败"
                        description={error}
                        type="error"
                        style={{ marginBottom: '24px' }}
                        action={
                            <Button size="small" onClick={handleRegenerate}>
                                重新生成
                            </Button>
                        }
                    />
                )}

                {/* Reasoning indicator for models that support it */}
                {isReasoning && (
                    <ReasoningIndicator
                        isVisible={isReasoning}
                        phase="brainstorming"
                        className="mb-4"
                    />
                )}

                {/* Legacy thinking indicator for non-reasoning models */}
                {!isReasoning && isThinking && (
                    <ThinkingIndicator
                        isThinking={isThinking}
                        className="mb-4"
                    />
                )}

                {/* Streaming progress */}
                {!isThinking && (isStreaming || isConnecting) && (
                    <div style={{ 
                        marginBottom: '24px', 
                        padding: '16px', 
                        backgroundColor: '#262626', 
                        border: '1px solid #1890ff',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Spin size="small" />
                            <span style={{ color: '#1890ff' }}>
                                {isConnecting ? '正在连接到生成服务...' : '正在生成创意想法...'}
                            </span>
                        </div>
                        {isStreaming && (
                            <Button
                                size="small"
                                icon={<StopOutlined />}
                                onClick={handleStopStreaming}
                                danger
                            >
                                停止生成
                            </Button>
                        )}
                    </div>
                )}

                {/* Ideas Display */}
                {ideas.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
                        gap: '16px',
                        marginBottom: '24px'
                    }}>
                        {ideas.map((idea, index) => (
                            <div
                                key={index}
                                onClick={() => handleIdeaSelection(index)}
                                style={{
                                    padding: '20px',
                                    background: selectedIdeaIndex === index ? '#1890ff20' : '#262626',
                                    border: selectedIdeaIndex === index ? '2px solid #1890ff' : '2px solid #404040',
                                    borderRadius: '12px',
                                    cursor: isSelectingIdea ? 'wait' : 'pointer',
                                    transition: 'all 0.3s ease-in-out',
                                    minHeight: '120px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transform: selectedIdeaIndex === index ? 'scale(1.02)' : 'scale(1)',
                                    boxShadow: selectedIdeaIndex === index ? '0 8px 24px rgba(24, 144, 255, 0.3)' : 'none',
                                    pointerEvents: isSelectingIdea ? 'none' : 'auto',
                                    opacity: isSelectingIdea && selectedIdeaIndex !== index ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedIdeaIndex !== index && !isSelectingIdea) {
                                        e.currentTarget.style.background = '#333333';
                                        e.currentTarget.style.transform = 'scale(1.01)';
                                        e.currentTarget.style.borderColor = '#666666';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedIdeaIndex !== index && !isSelectingIdea) {
                                        e.currentTarget.style.background = '#262626';
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.borderColor = '#404040';
                                    }
                                }}
                            >
                                <Text strong style={{ 
                                    color: '#fff', 
                                    fontSize: '16px',
                                    display: 'block', 
                                    marginBottom: '12px',
                                    lineHeight: '1.4'
                                }}>
                                    {idea.title}
                                </Text>
                                <Text style={{ 
                                    color: '#bfbfbf', 
                                    fontSize: '14px', 
                                    lineHeight: '1.5', 
                                    flex: 1 
                                }}>
                                    {idea.body}
                                </Text>
                                
                                {selectedIdeaIndex === index && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '8px 12px',
                                        background: '#1890ff',
                                        borderRadius: '6px',
                                        textAlign: 'center'
                                    }}>
                                        <Text style={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>
                                            已选择 - 即将进入大纲设计
                                        </Text>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Action buttons */}
                {!isStreaming && !isConnecting && ideas.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={handleRegenerate}
                            size="large"
                        >
                            重新生成想法
                        </Button>
                    </div>
                )}

                {/* Empty state */}
                {!isStreaming && !isConnecting && !isThinking && !isReasoning && ideas.length === 0 && !error && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <BulbOutlined style={{ fontSize: '48px', color: '#666', marginBottom: '16px' }} />
                        <Title level={4} style={{ color: '#999', margin: 0, marginBottom: '8px' }}>
                            等待创意生成
                        </Title>
                        <Text type="secondary">
                            创意想法将在这里显示
                        </Text>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ProjectBrainstormPage; 