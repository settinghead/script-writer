import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Typography,
    Button,
    Input,
    InputNumber,
    Alert,
    Spin,
    message,
    Space,
    Divider,
    Progress,
    List,
    Tag
} from 'antd';
import { PlayCircleOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { EpisodeGenerationSessionV1, EpisodeSynopsisV1, OutlineSynopsisStageV1 } from '../../common/types';
import { EpisodeStreamingService, EpisodeSynopsis } from '../services/implementations/EpisodeStreamingService';
import { useLLMStreaming } from '../hooks/useLLMStreaming';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StageData {
    artifactId: string;
    stageNumber: number;
    stageSynopsis: string;
    numberOfEpisodes: number;
    outlineSessionId: string;
}

interface EpisodeGenerationSessionData {
    session: EpisodeGenerationSessionV1;
    status: 'active' | 'completed' | 'failed';
    episodes: EpisodeSynopsisV1[];
}

interface StageDetailViewProps {
    scriptId: string;
    stageId: string;
    onGenerateStart?: () => void;
}

// API service functions
const apiService = {
    async getStageDetails(stageId: string): Promise<StageData | null> {
        console.log('[API] getStageDetails called for stageId:', stageId);
        try {
            const response = await fetch(`/api/episodes/stages/${stageId}`, {
                credentials: 'include'
            });
            console.log('[API] getStageDetails response status:', response.status);
            if (!response.ok) {
                throw new Error('Failed to fetch stage details');
            }
            const data = await response.json();
            console.log('[API] getStageDetails response data:', data);
            return data;
        } catch (error) {
            console.error('[API] getStageDetails error:', error);
            return null;
        }
    },

    async getEpisodeGenerationSession(sessionId: string): Promise<EpisodeGenerationSessionData | null> {
        console.log('[API] getEpisodeGenerationSession called for sessionId:', sessionId);
        try {
            const response = await fetch(`/api/episodes/episode-generation/${sessionId}`, {
                credentials: 'include'
            });
            console.log('[API] getEpisodeGenerationSession response status:', response.status);
            if (!response.ok) {
                throw new Error('Failed to fetch episode generation session');
            }
            const data = await response.json();
            console.log('[API] getEpisodeGenerationSession response data:', data);
            return data;
        } catch (error) {
            console.error('[API] getEpisodeGenerationSession error:', error);
            return null;
        }
    },

    async checkActiveEpisodeGeneration(stageId: string): Promise<EpisodeGenerationSessionData | null> {
        console.log('[API] checkActiveEpisodeGeneration called for stageId:', stageId);
        try {
            const response = await fetch(`/api/episodes/stages/${stageId}/active-generation`, {
                credentials: 'include'
            });
            console.log('[API] checkActiveEpisodeGeneration response status:', response.status);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            console.log('[API] checkActiveEpisodeGeneration response data:', data);
            return data;
        } catch (error) {
            console.error('[API] checkActiveEpisodeGeneration error:', error);
            return null;
        }
    },

    async startEpisodeGeneration(
        stageId: string,
        numberOfEpisodes: number,
        customRequirements?: string
    ): Promise<{ sessionId: string; transformId: string }> {
        console.log('[API] startEpisodeGeneration called for stageId:', stageId);
        const response = await fetch(`/api/episodes/stages/${stageId}/episodes/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                numberOfEpisodes,
                customRequirements
            })
        });

        if (!response.ok) {
            throw new Error('Failed to start episode generation');
        }

        const data = await response.json();
        console.log('[API] startEpisodeGeneration response data:', data);
        return data;
    },

    async stopEpisodeGeneration(sessionId: string): Promise<void> {
        console.log('[API] stopEpisodeGeneration called for sessionId:', sessionId);
        const response = await fetch(`/api/episodes/episode-generation/${sessionId}/stop`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to stop episode generation');
        }
    }
};

export const StageDetailView: React.FC<StageDetailViewProps> = ({
    scriptId,
    stageId,
    onGenerateStart
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [stageData, setStageData] = useState<StageData | null>(null);
    const [sessionData, setSessionData] = useState<EpisodeGenerationSessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Editable parameters
    const [editedEpisodes, setEditedEpisodes] = useState<number>(0);
    const [editedRequirements, setEditedRequirements] = useState<string>('');

    // Get session and transform IDs from URL parameters
    const sessionId = searchParams.get('session');
    const transformId = searchParams.get('transform');

    console.log('[StageDetailView] URL parameters:', { sessionId, transformId, stageId });

    // Create streaming service instance
    const streamingService = useMemo(() => new EpisodeStreamingService(), []);

    // Use the LLM streaming hook
    const {
        status: streamingStatus,
        items: streamingEpisodes,
        isThinking,
        stop: stopStreaming,
        error: streamingError
    } = useLLMStreaming(streamingService, {
        transformId: transformId && transformId !== 'undefined' ? transformId : undefined
    });

    console.log('[StageDetailView] Streaming state:', {
        status: streamingStatus,
        episodeCount: streamingEpisodes.length,
        isThinking,
        hasError: !!streamingError,
        transformId: transformId && transformId !== 'undefined' ? transformId : undefined
    });

    // Derived streaming state
    const isStreaming = streamingStatus === 'streaming';
    const isConnecting = !!(streamingStatus === 'idle' && transformId);

    useEffect(() => {
        console.log('[StageDetailView] useEffect triggered - loading stage data and checking sessions');
        console.log('[StageDetailView] sessionId from URL:', sessionId);
        console.log('[StageDetailView] transformId from URL:', transformId);
        console.log('[StageDetailView] stageId:', stageId);

        // Validate stageId before making API calls
        if (!stageId || stageId === 'undefined') {
            console.log('[StageDetailView] Invalid stageId, skipping data loading');
            setLoading(false);
            return;
        }

        loadStageData();
        // If we have session info from URL, check that specific session
        if (sessionId && sessionId !== 'undefined' && transformId && transformId !== 'undefined') {
            console.log('[StageDetailView] Checking session from URL parameters:', sessionId);
            checkSessionStatus(sessionId);
        } else {
            console.log('[StageDetailView] No valid session in URL, checking for active generation');
            checkActiveGeneration();
        }
    }, [stageId, sessionId, transformId]);

    // Handle streaming completion
    useEffect(() => {
        if (streamingStatus === 'completed' && sessionId) {
            // Reload session to get final state
            checkSessionStatus(sessionId);
        }
    }, [streamingStatus, sessionId]);

    // Handle streaming errors
    useEffect(() => {
        if (streamingStatus === 'error') {
            console.error('Streaming error occurred:', streamingError);
            message.error('剧集生成出现错误');
        }
    }, [streamingStatus, streamingError]);

    // Update session data when streaming provides new episode data
    useEffect(() => {
        if (streamingEpisodes.length > 0) {
            setSessionData(prev => {
                if (!prev) return prev;

                // Convert streaming episodes to EpisodeSynopsisV1 format
                const convertedEpisodes: EpisodeSynopsisV1[] = streamingEpisodes.map(episode => ({
                    episodeNumber: episode.episodeNumber,
                    title: episode.title,
                    briefSummary: episode.synopsis || episode.briefSummary || '',
                    keyEvents: episode.keyEvents,
                    hooks: episode.endHook || episode.hooks || '',
                    stageArtifactId: stageData?.artifactId || '',
                    episodeGenerationSessionId: prev.session.id
                }));

                return {
                    ...prev,
                    episodes: convertedEpisodes,
                    status: isStreaming ? 'active' : prev.status
                };
            });
        }
    }, [streamingEpisodes, isStreaming, stageData]);

    const loadStageData = async () => {
        console.log('[StageDetailView] loadStageData called for stageId:', stageId);

        // Validate stageId before API call
        if (!stageId || stageId === 'undefined') {
            console.log('[StageDetailView] Invalid stageId, cannot load stage data');
            setLoading(false);
            return;
        }

        try {
            const data = await apiService.getStageDetails(stageId);
            if (data) {
                setStageData(data);
                setEditedEpisodes(data.numberOfEpisodes);
            }
        } catch (error) {
            console.error('Error loading stage data:', error);
            message.error('加载阶段数据失败');
        } finally {
            setLoading(false);
        }
    };

    const checkSessionStatus = async (sessionId: string) => {
        console.log('[StageDetailView] checkSessionStatus called for sessionId:', sessionId);
        try {
            const sessionData = await apiService.getEpisodeGenerationSession(sessionId);
            console.log('[StageDetailView] Session data received:', sessionData);
            if (sessionData) {
                setSessionData(sessionData);
                setGenerating(sessionData.status === 'active');
            } else {
                // Session not found - this can happen if database was reset
                console.log('[StageDetailView] Session not found, resetting state');
                setSessionData(null);
                setGenerating(false);
            }
        } catch (error) {
            console.log('[StageDetailView] Error checking session status (may be expected):', error);
            // Don't show error to user as this is expected when session doesn't exist
            setSessionData(null);
            setGenerating(false);
        }
    };

    const checkActiveGeneration = async () => {
        console.log('[StageDetailView] checkActiveGeneration called for stageId:', stageId);
        try {
            const activeGeneration = await apiService.checkActiveEpisodeGeneration(stageId);
            console.log('[StageDetailView] Active generation check result:', activeGeneration);
            if (activeGeneration) {
                setSessionData(activeGeneration);
                setGenerating(activeGeneration.status === 'active');
            } else {
                setGenerating(false);
            }
        } catch (error) {
            console.error('Error checking active generation:', error);
            setGenerating(false);
        }
    };

    const handleStartGeneration = async () => {
        if (!stageData) return;

        try {
            setGenerating(true);
            setSessionData(null); // Clear previous session data

            const result = await apiService.startEpisodeGeneration(
                stageId,
                editedEpisodes,
                editedRequirements.trim() || undefined
            );

            // Update URL with new session and transform IDs using React Router
            setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set('session', result.sessionId);
                newParams.set('transform', result.transformId);
                return newParams;
            });

            console.log('[StageDetailView] Updated URL with session and transform:', {
                sessionId: result.sessionId,
                transformId: result.transformId
            });

            onGenerateStart?.();
            message.success('剧集生成已开始');

        } catch (error) {
            console.error('Error starting episode generation:', error);
            message.error('启动剧集生成失败');
            setGenerating(false);
        }
    };

    const handleStopGeneration = async () => {
        if (!sessionData) return;

        try {
            await stopStreaming();
            if (sessionData.session.id) {
                await apiService.stopEpisodeGeneration(sessionData.session.id);
            }
            setGenerating(false);
            message.success('剧集生成已停止');
        } catch (error) {
            console.error('Error stopping episode generation:', error);
            message.error('停止剧集生成失败');
        }
    };

    const handleSaveParameters = () => {
        setEditMode(false);
        message.success('参数已保存');
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text>加载阶段详情...</Text>
                </div>
            </div>
        );
    }

    if (!stageId || stageId === 'undefined') {
        return (
            <Alert
                message="无效的阶段ID"
                description="请选择一个有效的阶段"
                type="error"
                showIcon
            />
        );
    }

    if (!stageData) {
        return (
            <Alert
                message="未找到阶段数据"
                description="请求的阶段不存在或已被删除"
                type="error"
                showIcon
            />
        );
    }

    // Calculate progress for streaming
    const expectedEpisodes = editedEpisodes || stageData.numberOfEpisodes;
    const currentEpisodes = streamingEpisodes.length || (sessionData?.episodes.length || 0);
    const progress = expectedEpisodes > 0 ? Math.min((currentEpisodes / expectedEpisodes) * 100, 100) : 0;

    return (
        <div style={{ padding: '20px' }}>
            {/* Stage Information */}
            <Card title={`第${stageData.stageNumber}阶段详情`} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <Text strong>阶段简介：</Text>
                    <Paragraph style={{ marginTop: '8px' }}>
                        {stageData.stageSynopsis}
                    </Paragraph>
                </div>

                {/* Generation Parameters */}
                <Divider />
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <Text strong>生成参数</Text>
                        {!editMode && !generating && (
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => setEditMode(true)}
                                size="small"
                            >
                                编辑
                            </Button>
                        )}
                    </div>

                    {editMode ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <div>
                                <Text>集数：</Text>
                                <InputNumber
                                    value={editedEpisodes}
                                    onChange={(value) => setEditedEpisodes(value || 0)}
                                    min={1}
                                    max={50}
                                    style={{ marginLeft: '8px' }}
                                />
                            </div>
                            <div>
                                <Text>特殊要求：</Text>
                                <TextArea
                                    value={editedRequirements}
                                    onChange={(e) => setEditedRequirements(e.target.value)}
                                    placeholder="可选：添加特殊要求或偏好"
                                    rows={3}
                                    style={{ marginTop: '8px' }}
                                />
                            </div>
                            <Space>
                                <Button onClick={handleSaveParameters} type="primary">
                                    保存
                                </Button>
                                <Button onClick={() => setEditMode(false)}>
                                    取消
                                </Button>
                            </Space>
                        </Space>
                    ) : (
                        <div>
                            <div style={{ marginBottom: '8px' }}>
                                <Text>集数：{editedEpisodes || stageData.numberOfEpisodes}</Text>
                            </div>
                            {editedRequirements && (
                                <div>
                                    <Text>特殊要求：{editedRequirements}</Text>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Generation Controls */}
                <Divider />
                <div style={{ textAlign: 'center' }}>
                    {!generating ? (
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={handleStartGeneration}
                            size="large"
                            disabled={editMode}
                        >
                            开始剧集生成
                        </Button>
                    ) : (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <div style={{ textAlign: 'center' }}>
                                <Text strong>
                                    {isThinking ? '正在思考...' : '正在生成剧集大纲...'}
                                </Text>
                                <Progress
                                    percent={progress}
                                    style={{ marginTop: '8px' }}
                                    status={isStreaming ? "active" : "normal"}
                                />
                                <div style={{ marginTop: '8px' }}>
                                    <Text type="secondary">
                                        已生成 {currentEpisodes} / {expectedEpisodes} 集
                                    </Text>
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <Button
                                    icon={<StopOutlined />}
                                    onClick={handleStopGeneration}
                                    danger
                                >
                                    停止生成
                                </Button>
                            </div>
                        </Space>
                    )}
                </div>
            </Card>

            {/* Episodes List */}
            {(streamingEpisodes.length > 0 || (sessionData && sessionData.episodes.length > 0)) && (
                <Card title="剧集大纲" style={{ marginBottom: '20px' }}>
                    {isStreaming && (
                        <Alert
                            message="正在实时生成剧集大纲"
                            type="info"
                            style={{ marginBottom: '16px' }}
                            showIcon
                        />
                    )}

                    <List
                        dataSource={streamingEpisodes.length > 0 ? streamingEpisodes : (sessionData?.episodes || [])}
                        renderItem={(episode: EpisodeSynopsis | EpisodeSynopsisV1) => (
                            <List.Item>
                                <Card
                                    size="small"
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Tag color="blue">第{episode.episodeNumber}集</Tag>
                                            <Text strong>{episode.title}</Text>
                                        </div>
                                    }
                                    style={{ width: '100%' }}
                                >
                                    <div style={{ marginBottom: '12px' }}>
                                        <Text>
                                            {('briefSummary' in episode ? episode.briefSummary : (episode as EpisodeSynopsis).synopsis) ||
                                                ('synopsis' in episode ? (episode as EpisodeSynopsis).synopsis : '')}
                                        </Text>
                                    </div>

                                    {episode.keyEvents && episode.keyEvents.length > 0 && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <Text strong>关键事件：</Text>
                                            <ul style={{ marginTop: '4px', marginBottom: '0' }}>
                                                {episode.keyEvents.map((event, index) => (
                                                    <li key={index}>
                                                        <Text>{event}</Text>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(('hooks' in episode ? episode.hooks : (episode as EpisodeSynopsis).endHook) ||
                                        ('endHook' in episode ? (episode as EpisodeSynopsis).endHook : '')) && (
                                            <div>
                                                <Text strong>剧集钩子：</Text>
                                                <Text style={{ marginLeft: '8px' }}>
                                                    {('hooks' in episode ? episode.hooks : (episode as EpisodeSynopsis).endHook) ||
                                                        ('endHook' in episode ? (episode as EpisodeSynopsis).endHook : '')}
                                                </Text>
                                            </div>
                                        )}
                                </Card>
                            </List.Item>
                        )}
                    />
                </Card>
            )}

            {/* Status Messages */}
            {sessionData && sessionData.status === 'failed' && (
                <Alert
                    message="生成失败"
                    description="剧集生成过程中出现错误，请重试"
                    type="error"
                    showIcon
                    style={{ marginBottom: '20px' }}
                />
            )}
        </div>
    );
}; 