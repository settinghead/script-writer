import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Typography, Spin, Alert, Card, Divider, Input, InputNumber, Form, Space } from 'antd';
import { ArrowLeftOutlined, SendOutlined, FileTextOutlined } from '@ant-design/icons';
import StoryInspirationEditor from './StoryInspirationEditor';
import { useStreamingTransform } from '../hooks/useStreamingTransform';
import StreamingDisplay from './StreamingDisplay';

const { Title, Text, Paragraph } = Typography;

interface OutlineData {
    title: string;
    genre: string;
    sellingPoints: string;
    setting: string;
    synopsis: string;
    characters: Array<{ name: string; description: string }>;
}

interface OutlineSession {
    sessionId: string;
    ideationSessionId: string;
    status: 'active' | 'completed';
    userInput?: string;
    outline?: OutlineData;
    createdAt: string;
}

const OutlineTab: React.FC = () => {
    const navigate = useNavigate();
    const { outlineId } = useParams<{ outlineId: string }>();
    const [searchParams] = useSearchParams();
    const artifactId = searchParams.get('artifact_id');

    const [currentArtifactId, setCurrentArtifactId] = useState<string | null>(artifactId);
    const [outlineSession, setOutlineSession] = useState<OutlineSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalEpisodes, setTotalEpisodes] = useState<number>(1);
    const [episodeDuration, setEpisodeDuration] = useState<number>(3);

    // Determine the mode based on URL
    const isCreationMode = !outlineId && currentArtifactId;
    const isViewingMode = !!outlineId;

    // Streaming transform hook
    const {
        isStreaming,
        displayData,
        progress,
        error: streamingError,
        startStreaming,
        stopStreaming,
        cleanup
    } = useStreamingTransform({
        onComplete: (result) => {
            console.log('Outline streaming completed:', result);
            setIsLoading(false);

            if (result.outlineSessionId) {
                // Navigate to the completed outline page
                navigate(`/outlines/${result.outlineSessionId}`);
            }
        },
        onError: (error) => {
            console.error('Outline streaming error:', error);
            setError(error);
            setIsLoading(false);
        }
    });

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    // Load outline session if in viewing mode
    useEffect(() => {
        if (isViewingMode && outlineId) {
            loadOutlineSession(outlineId);
        }
    }, [isViewingMode, outlineId]);

    const loadOutlineSession = async (sessionId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/outlines/${sessionId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('大纲会话未找到');
                }
                throw new Error(`加载失败: ${response.status}`);
            }

            const data = await response.json();
            setOutlineSession(data);

        } catch (err) {
            console.error('Error loading outline session:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateOutline = async () => {
        if (!currentArtifactId) {
            console.warn('handleGenerateOutline: No currentArtifactId, cannot generate.');
            return;
        }

        console.log('handleGenerateOutline: Generating outline for artifactId:', currentArtifactId, 'with totalEpisodes:', totalEpisodes, 'episodeDuration:', episodeDuration);

        setIsLoading(true);
        setError(null);

        try {
            // Start streaming generation
            await startStreaming(`/api/streaming/outlines/from-artifact/${currentArtifactId}`, {
                totalEpisodes,
                episodeDuration,
            });

        } catch (err) {
            console.error('Error generating outline:', err);
            setError(err instanceof Error ? err.message : String(err));
            setIsLoading(false);
        }
    };

    const handleStopGeneration = () => {
        stopStreaming();
        setIsLoading(false);
    };

    const handleBackToIdeation = () => {
        if (isCreationMode && currentArtifactId) {
            // Navigate back to ideation with artifact ID
            navigate(`/ideation?artifact_id=${currentArtifactId}`);
        } else if (isViewingMode && outlineSession) {
            navigate(`/ideation/${outlineSession.ideationSessionId}`);
        } else {
            navigate('/ideations');
        }
    };

    const currentError = error || streamingError;

    if (isLoading && !isStreaming) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text>加载中...</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={handleBackToIdeation}
                    style={{ marginBottom: '16px' }}
                >
                    返回创意页面
                </Button>

                <Title level={2}>
                    {isCreationMode ? '设计大纲' : '查看大纲'}
                </Title>

                {isCreationMode && (
                    <Text type="secondary">
                        基于故事灵感生成详细的短剧大纲
                    </Text>
                )}
            </div>

            {/* Error Display */}
            {currentError && (
                <Alert
                    message="错误"
                    description={currentError}
                    type="error"
                    showIcon
                    style={{ marginBottom: '24px' }}
                />
            )}

            {/* Creation Mode */}
            {isCreationMode && (
                <div>
                    {/* Story Inspiration Editor */}
                    <Card title="故事灵感" style={{ marginBottom: '24px' }}>
                        <StoryInspirationEditor
                            currentArtifactId={currentArtifactId!}
                            readOnly={isLoading || isStreaming}
                        />
                    </Card>

                    {/* Generation Options */}
                    <Card title="生成选项" style={{ marginBottom: '24px' }}>
                        <Form layout="vertical">
                            <Space size="large">
                                <Form.Item label="总集数">
                                    <InputNumber
                                        min={1}
                                        max={100}
                                        value={totalEpisodes}
                                        onChange={(value) => setTotalEpisodes(value || 1)}
                                        disabled={isLoading || isStreaming}
                                    />
                                </Form.Item>
                                <Form.Item label="每集时长（分钟）">
                                    <InputNumber
                                        min={1}
                                        max={60}
                                        value={episodeDuration}
                                        onChange={(value) => setEpisodeDuration(value || 3)}
                                        disabled={isLoading || isStreaming}
                                    />
                                </Form.Item>
                            </Space>
                        </Form>
                    </Card>

                    {/* Generate Button */}
                    <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<SendOutlined />}
                            onClick={handleGenerateOutline}
                            disabled={!currentArtifactId || isLoading || isStreaming}
                            loading={isLoading || isStreaming}
                            style={{ marginRight: 12 }}
                        >
                            {isLoading || isStreaming ? '正在生成大纲...' : '生成大纲'}
                        </Button>

                        {(isLoading || isStreaming) && (
                            <Button
                                onClick={handleStopGeneration}
                                size="large"
                            >
                                停止生成
                            </Button>
                        )}
                    </div>

                    {/* Streaming Display */}
                    {(isStreaming || displayData) && (
                        <StreamingDisplay
                            data={displayData}
                            isStreaming={isStreaming}
                            progress={progress}
                            error={streamingError}
                            type="outline"
                        />
                    )}
                </div>
            )}

            {/* Viewing Mode */}
            {isViewingMode && outlineSession && (
                <div>
                    {/* Session Info */}
                    <Card style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong>会话ID: </Text>
                                <Text code>{outlineSession.sessionId}</Text>
                            </div>
                            <div>
                                <Text strong>状态: </Text>
                                <Text type={outlineSession.status === 'completed' ? 'success' : 'warning'}>
                                    {outlineSession.status === 'completed' ? '已完成' : '进行中'}
                                </Text>
                            </div>
                        </div>
                        {outlineSession.userInput && (
                            <div style={{ marginTop: '16px' }}>
                                <Text strong>故事灵感:</Text>
                                <Paragraph style={{ marginTop: '8px', background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                                    {outlineSession.userInput}
                                </Paragraph>
                            </div>
                        )}
                    </Card>

                    {/* Outline Display */}
                    {outlineSession.outline && (
                        <div>
                            <Title level={3} style={{ marginBottom: '24px' }}>
                                <FileTextOutlined style={{ marginRight: '8px' }} />
                                大纲内容
                            </Title>

                            <div style={{ display: 'grid', gap: '16px' }}>
                                {/* Title */}
                                <Card size="small" title="🎬 剧名">
                                    <Text strong style={{ fontSize: '18px' }}>
                                        {outlineSession.outline.title}
                                    </Text>
                                </Card>

                                {/* Genre */}
                                <Card size="small" title="🎭 题材类型">
                                    <Text>{outlineSession.outline.genre}</Text>
                                </Card>

                                {/* Selling Points */}
                                <Card size="small" title="⭐ 核心看点">
                                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                                        {outlineSession.outline.sellingPoints}
                                    </Paragraph>
                                </Card>

                                {/* Setting */}
                                <Card size="small" title="🌍 故事设定">
                                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                                        {outlineSession.outline.setting}
                                    </Paragraph>
                                </Card>

                                {/* Characters */}
                                {outlineSession.outline.characters && outlineSession.outline.characters.length > 0 && (
                                    <Card size="small" title="👥 主要人物">
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            {outlineSession.outline.characters.map((character, index) => (
                                                <div key={index} style={{ padding: '12px', background: '#f9f9f9', borderRadius: '4px' }}>
                                                    <Text strong>{character.name}</Text>
                                                    <br />
                                                    <Text type="secondary">{character.description}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {/* Synopsis */}
                                <Card size="small" title="📖 故事梗概">
                                    <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                        {outlineSession.outline.synopsis}
                                    </Paragraph>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OutlineTab; 