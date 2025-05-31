import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Spin, Alert, Button, Typography, Breadcrumb, Space, Card } from 'antd';
import { HomeOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { OutlineInputForm } from './OutlineInputForm';
import { OutlineParameterSummary } from './OutlineParameterSummary';
import { DynamicOutlineResults } from './DynamicOutlineResults';
import { OutlinesList } from './OutlinesList';
import { apiService } from '../services/apiService';
import { OutlineStreamingService } from '../services/implementations/OutlineStreamingService';
import { useLLMStreaming } from '../hooks/useLLMStreaming';
import type { OutlineSessionData } from '../../server/services/OutlineService';
import type { OutlineSection } from '../services/implementations/OutlineStreamingService';

const { Title, Text } = Typography;

export const OutlineTab: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [sessionData, setSessionData] = useState<OutlineSessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // Get transform ID from URL parameters
    const transformId = searchParams.get('transform');

    // Create streaming service instance
    const streamingService = useMemo(() => new OutlineStreamingService(), []);

    // Use the LLM streaming hook
    const { status: streamingStatus, items: outlineItems, stop: stopStreaming, error: streamingError } = useLLMStreaming(
        streamingService,
        { transformId: transformId || undefined }
    );

    // Derived streaming state
    const isStreaming = streamingStatus === 'streaming';
    const isConnecting = streamingStatus === 'idle' && transformId;

    // Load session data when ID changes
    useEffect(() => {
        if (id) {
            loadSession(id);
        }
    }, [id]);

    // Update session data when streaming provides new outline data
    useEffect(() => {
        if (outlineItems.length > 0) {
            const latestOutline = outlineItems[outlineItems.length - 1];
            updateSessionComponents(latestOutline);
        }
    }, [outlineItems]);

    // Handle streaming completion
    useEffect(() => {
        if (streamingStatus === 'completed' && id) {
            // Reload session to get final state
            loadSession(id);
        }
    }, [streamingStatus, id]);

    // Handle streaming errors
    useEffect(() => {
        if (streamingStatus === 'error') {
            console.error('Streaming error occurred:', streamingError);
            setError('Streaming error occurred');
        }
    }, [streamingStatus, streamingError]);

    const loadSession = async (sessionId: string) => {
        try {
            setLoading(true);
            setError('');

            const data = await apiService.getOutlineSession(sessionId);
            setSessionData(data);

            // Check if there's an active streaming job (only if no transform ID in URL)
            if (!transformId) {
                try {
                    const activeJob = await apiService.checkActiveStreamingJob(sessionId);
                    if (activeJob) {
                        // Navigate to the streaming URL to trigger streaming
                        navigate(`/outlines/${sessionId}?transform=${activeJob.transformId}`, { replace: true });
                    }
                } catch (error) {
                    // Expected for completed sessions
                    console.log('No active streaming job found (this is normal for completed outlines)');
                }
            }

        } catch (error) {
            console.error('Error loading outline session:', error);
            setError('Failed to load outline session');
        } finally {
            setLoading(false);
        }
    };

    const updateSessionComponents = (outline: OutlineSection) => {
        setSessionData(prev => {
            if (!prev) return prev;

            return {
                ...prev,
                components: {
                    ...prev.components,
                    // Map outline structure to components
                    title: outline.title || prev.components.title,
                    genre: outline.genre || prev.components.genre,
                    target_audience: outline.target_audience || prev.components.target_audience,
                    selling_points: outline.selling_points?.join('\n') || prev.components.selling_points,
                    satisfaction_points: outline.satisfaction_points || prev.components.satisfaction_points,
                    setting: outline.setting?.core_setting_summary || prev.components.setting,
                    synopsis: prev.components.synopsis, // Keep existing synopsis for backward compatibility
                    synopsis_stages: outline.synopsis_stages || prev.components.synopsis_stages,
                    characters: outline.characters || prev.components.characters
                }
            };
        });
    };

    const handleStopStreaming = async () => {
        try {
            stopStreaming();
        } catch (error) {
            console.error('Error stopping streaming:', error);
        }
    };

    const handleComponentUpdate = (componentType: string, newValue: string, newArtifactId: string) => {
        // Update local state immediately for responsive UI
        setSessionData(prev => {
            if (!prev) return prev;

            let updatedComponents = { ...prev.components };

            if (componentType === 'characters') {
                try {
                    updatedComponents.characters = JSON.parse(newValue);
                } catch {
                    // If parsing fails, keep the current value
                }
            } else {
                updatedComponents = {
                    ...updatedComponents,
                    [componentType]: newValue
                };
            }

            return {
                ...prev,
                components: updatedComponents
            };
        });
    };

    // Route determination
    if (!id) {
        // If no ID, show either input form or list based on path
        const path = window.location.pathname;
        if (path === '/new-outline') {
            return <OutlineInputForm />;
        } else if (path === '/outlines') {
            return <OutlinesList />;
        } else {
            // Default to list
            return <OutlinesList />;
        }
    }

    // Loading state
    if (loading && !sessionData) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px'
            }}>
                <Spin size="large" />
                <Text style={{ marginLeft: '12px', color: '#fff' }}>加载大纲...</Text>
            </div>
        );
    }

    // Error state
    if (error && !sessionData) {
        return (
            <Alert
                message="加载失败"
                description={error}
                type="error"
                showIcon
                style={{ margin: '20px 0' }}
                action={
                    <Button onClick={() => id && loadSession(id)} size="small">
                        重试
                    </Button>
                }
            />
        );
    }

    // Not found state
    if (!sessionData) {
        return (
            <Card style={{ textAlign: 'center', margin: '20px 0' }}>
                <div style={{ padding: '40px 20px' }}>
                    <Title level={3} style={{ color: '#fff' }}>大纲未找到</Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
                        请求的大纲不存在或已被删除。
                    </Text>
                    <Space>
                        <Button
                            onClick={() => navigate('/outlines')}
                            icon={<FileTextOutlined />}
                        >
                            返回大纲列表
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => navigate('/new-outline')}
                            icon={<PlusOutlined />}
                        >
                            生成新大纲
                        </Button>
                    </Space>
                </div>
            </Card>
        );
    }

    // Main outline view
    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', overflowY: 'auto', padding: '20px' }}>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                }}>
                    <div style={{ flex: 1 }}>
                        <Title level={2} style={{ color: '#fff', margin: '0 0 8px 0' }}>
                            {sessionData.components.title || '大纲详情'}
                        </Title>
                        <Breadcrumb style={{ margin: 0 }}>
                            <Breadcrumb.Item>
                                <Button
                                    type="link"
                                    onClick={() => navigate('/outlines')}
                                    style={{ padding: 0, height: 'auto', color: '#1890ff' }}
                                >
                                    <HomeOutlined style={{ marginRight: '4px' }} />
                                    我的大纲
                                </Button>
                            </Breadcrumb.Item>
                            <Breadcrumb.Item>
                                <Text type="secondary">
                                    {sessionData.components.title || '无标题大纲'}
                                </Text>
                            </Breadcrumb.Item>
                        </Breadcrumb>
                    </div>

                    <Button
                        type="primary"
                        onClick={() => navigate('/new-outline')}
                        icon={<PlusOutlined />}
                    >
                        生成新大纲
                    </Button>
                </div>
            </div>

            {/* Parameter Summary */}
            <OutlineParameterSummary
                sourceArtifact={sessionData.sourceArtifact}
                ideationRunId={sessionData.ideationRunId}
                totalEpisodes={sessionData.totalEpisodes}
                episodeDuration={sessionData.episodeDuration}
                createdAt={sessionData.createdAt}
            />

            {/* Results */}
            <div style={{ marginTop: '20px' }}>
                <DynamicOutlineResults
                    sessionId={id || ''}
                    components={sessionData.components}
                    status={sessionData.status}
                    isStreaming={isStreaming}
                    isConnecting={isConnecting}
                    onStopStreaming={handleStopStreaming}
                    onComponentUpdate={handleComponentUpdate}
                    streamingItems={outlineItems}
                    onRegenerate={async () => {
                        try {
                            await apiService.regenerateOutline(id || '');
                        } catch (error) {
                            console.error('Error regenerating outline:', error);
                        }
                    }}
                    onExport={() => {
                        // TODO: Implement export functionality
                        console.log('Export outline');
                    }}
                />
            </div>

            {/* Error Display */}
            {error && (
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginTop: '20px' }}
                />
            )}
        </div>
    );
}; 