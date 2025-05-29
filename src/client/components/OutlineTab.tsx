import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Spin, Alert, Button, Typography, Breadcrumb, Space, Card } from 'antd';
import { HomeOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { OutlineInputForm } from './OutlineInputForm';
import { OutlineParameterSummary } from './OutlineParameterSummary';
import { OutlineResults } from './OutlineResults';
import { OutlinesList } from './OutlinesList';
import { apiService } from '../services/apiService';
import { OutlineStreamingService } from '../services/implementations/OutlineStreamingService';
import type { OutlineSessionData } from '../../server/services/OutlineService';

const { Title, Text } = Typography;

export const OutlineTab: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [sessionData, setSessionData] = useState<OutlineSessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [streamingService, setStreamingService] = useState<OutlineStreamingService | null>(null);

    // Load session data when ID changes
    useEffect(() => {
        if (id) {
            loadSession(id);
        }
    }, [id]);

    // Set up streaming if transform ID is provided
    useEffect(() => {
        const transformId = searchParams.get('transform');
        if (transformId && id) {
            startStreaming(transformId);
        }
    }, [searchParams, id]);

    const loadSession = async (sessionId: string) => {
        try {
            setLoading(true);
            setError('');

            const data = await apiService.getOutlineSession(sessionId);
            setSessionData(data);

            // Check if there's an active streaming job
            try {
                const activeJob = await apiService.checkActiveStreamingJob(sessionId);
                if (activeJob) {
                    startStreaming(activeJob.transformId);
                }
            } catch (error) {
                // Expected for completed sessions
                console.log('No active streaming job found (this is normal for completed outlines)');
            }

        } catch (error) {
            console.error('Error loading outline session:', error);
            setError('Failed to load outline session');
        } finally {
            setLoading(false);
        }
    };

    const startStreaming = async (transformId: string) => {
        try {
            setIsConnecting(true);

            const service = new OutlineStreamingService();
            setStreamingService(service);

            const streamResponse = await service.startStreaming(transformId);

            setIsConnecting(false);
            setIsStreaming(true);

            // Listen for streaming updates
            service.on('item', (outline) => {
                updateSessionComponents(outline);
            });

            service.on('error', (error) => {
                console.error('Streaming error:', error);
                setError('Streaming error occurred');
                setIsStreaming(false);
                setIsConnecting(false);
            });

            service.on('complete', () => {
                console.log('Streaming completed');
                setIsStreaming(false);
                setIsConnecting(false);
                // Reload session to get final state
                if (id) {
                    loadSession(id);
                }
            });

        } catch (error) {
            console.error('Error starting streaming:', error);
            setError('Failed to start streaming');
            setIsConnecting(false);
            setIsStreaming(false);
        }
    };

    const updateSessionComponents = (outline: any) => {
        setSessionData(prev => {
            if (!prev) return prev;

            return {
                ...prev,
                components: {
                    ...prev.components,
                    // Map outline structure to components
                    title: outline.title || prev.components.title,
                    genre: outline.genre || prev.components.genre,
                    selling_points: outline.selling_points?.join('\n') || prev.components.selling_points,
                    setting: outline.setting?.core_setting_summary || prev.components.setting,
                    synopsis: outline.synopsis || prev.components.synopsis,
                    characters: outline.main_characters || prev.components.characters
                }
            };
        });
    };

    const handleStopStreaming = async () => {
        if (streamingService) {
            try {
                streamingService.stop();
                setIsStreaming(false);
                setIsConnecting(false);
            } catch (error) {
                console.error('Error stopping streaming:', error);
            }
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
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
                <OutlineResults
                    sessionId={id}
                    components={sessionData.components}
                    status={sessionData.status}
                    isStreaming={isStreaming}
                    isConnecting={isConnecting}
                    onStopStreaming={handleStopStreaming}
                    onComponentUpdate={handleComponentUpdate}
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