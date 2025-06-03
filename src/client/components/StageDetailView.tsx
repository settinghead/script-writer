import React, { useState, useEffect } from 'react';
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

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StageData {
    artifactId: string;
    stageNumber: number;
    stageSynopsis: string;
    numberOfEpisodes: number;
    outlineSessionId: string;
}

interface EpisodeSynopsis {
    episodeNumber: number;
    title: string;
    synopsis: string;
    keyEvents: string[];
    endHook: string;
}

interface ActiveGeneration {
    sessionId: string;
    transformId: string;
    status: 'running' | 'completed' | 'failed';
    progress?: number;
    episodes?: EpisodeSynopsis[];
}

interface StageDetailViewProps {
    scriptId: string;
    stageId: string;
    onGenerateStart: (stageId: string, sessionId: string, transformId: string) => void;
}

// API service functions
const apiService = {
    async getStageDetails(stageId: string): Promise<StageData | null> {
        try {
            const response = await fetch(`/api/episodes/stages/${stageId}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to fetch stage details');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching stage details:', error);
            return null;
        }
    },

    async checkActiveGeneration(stageId: string): Promise<ActiveGeneration | null> {
        try {
            const response = await fetch(`/api/episodes/stages/${stageId}/active-generation`, {
                credentials: 'include'
            });
            if (response.status === 404) {
                return null; // No active generation
            }
            if (!response.ok) {
                throw new Error('Failed to check active generation');
            }
            return await response.json();
        } catch (error) {
            console.error('Error checking active generation:', error);
            return null;
        }
    },

    async getEpisodeGenerationSession(sessionId: string): Promise<any> {
        try {
            const response = await fetch(`/api/episodes/episode-generation/${sessionId}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to get episode generation session');
            }
            return await response.json();
        } catch (error) {
            console.error('Error getting episode generation session:', error);
            return null;
        }
    },

    async startEpisodeGeneration(
        stageId: string,
        numberOfEpisodes: number,
        customRequirements?: string
    ): Promise<{ sessionId: string; transformId: string }> {
        const response = await fetch(`/api/episodes/stages/${stageId}/episodes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ numberOfEpisodes, customRequirements })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start episode generation');
        }

        return await response.json();
    }
};

export const StageDetailView: React.FC<StageDetailViewProps> = ({
    scriptId,
    stageId,
    onGenerateStart
}) => {
    const [stageData, setStageData] = useState<StageData | null>(null);
    const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Editable parameters
    const [editedEpisodes, setEditedEpisodes] = useState<number>(0);
    const [editedRequirements, setEditedRequirements] = useState<string>('');

    // Get session and transform IDs from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    const transformId = urlParams.get('transform');

    useEffect(() => {
        loadStageData();
        // If we have session info from URL, check that specific session
        if (sessionId && transformId) {
            checkSessionStatus(sessionId);
        } else {
            checkActiveGeneration();
        }
    }, [stageId, sessionId, transformId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeGeneration?.status === 'running') {
            // Poll for updates every 2 seconds while generation is running
            interval = setInterval(() => {
                if (sessionId) {
                    checkSessionStatus(sessionId);
                } else {
                    checkActiveGeneration();
                }
            }, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeGeneration?.status, sessionId]);

    const loadStageData = async () => {
        try {
            setLoading(true);
            const data = await apiService.getStageDetails(stageId);
            if (data) {
                setStageData(data);
                setEditedEpisodes(data.numberOfEpisodes);
                setEditedRequirements('');
            }
        } catch (error) {
            console.error('Error loading stage data:', error);
            message.error('加载阶段数据失败');
        } finally {
            setLoading(false);
        }
    };

    const checkActiveGeneration = async () => {
        try {
            const generation = await apiService.checkActiveGeneration(stageId);
            setActiveGeneration(generation);
        } catch (error) {
            console.error('Error checking active generation:', error);
        }
    };

    const checkSessionStatus = async (sessionId: string) => {
        try {
            const sessionData = await apiService.getEpisodeGenerationSession(sessionId);
            if (sessionData) {
                setActiveGeneration({
                    sessionId: sessionData.session.id,
                    transformId: transformId || '',
                    status: sessionData.status,
                    episodes: sessionData.episodes || []
                });
            }
        } catch (error) {
            console.error('Error checking session status:', error);
        }
    };

    const handleStartGeneration = async () => {
        if (!stageData) return;

        try {
            setGenerating(true);
            const result = await apiService.startEpisodeGeneration(
                stageId,
                editedEpisodes,
                editedRequirements.trim() || undefined
            );

            message.success('剧集生成已开始');
            setActiveGeneration({
                sessionId: result.sessionId,
                transformId: result.transformId,
                status: 'running',
                progress: 0
            });

            // Notify parent component to start streaming
            onGenerateStart(stageId, result.sessionId, result.transformId);

        } catch (error: any) {
            console.error('Error starting generation:', error);
            message.error(error.message || '开始生成失败');
        } finally {
            setGenerating(false);
        }
    };

    const toggleEditMode = () => {
        if (editMode) {
            // Reset to original values when canceling edit
            if (stageData) {
                setEditedEpisodes(stageData.numberOfEpisodes);
                setEditedRequirements('');
            }
        }
        setEditMode(!editMode);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!stageData) {
        return (
            <Alert
                message="无法加载阶段数据"
                description="请稍后重试或联系技术支持"
                type="error"
                showIcon
            />
        );
    }

    const isGenerating = activeGeneration?.status === 'running';
    const hasActiveGeneration = activeGeneration !== null;
    const canStartGeneration = !isGenerating && !generating;

    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Stage Header */}
                <Card
                    title={`第${stageData.stageNumber}阶段`}
                    style={{ backgroundColor: '#161b22', border: '1px solid #303030' }}
                    headStyle={{ color: '#e6edf3', borderBottom: '1px solid #303030' }}
                    bodyStyle={{ color: '#e6edf3' }}
                >
                    <Paragraph style={{ color: '#e6edf3', marginBottom: '16px' }}>
                        {stageData.stageSynopsis}
                    </Paragraph>

                    <Space size="middle">
                        <Tag color="blue">原定 {stageData.numberOfEpisodes} 集</Tag>
                        <Tag color="geekblue">阶段 {stageData.stageNumber}</Tag>
                    </Space>
                </Card>

                {/* Generation Status */}
                {hasActiveGeneration && (
                    <Card
                        title="生成状态"
                        style={{ backgroundColor: '#161b22', border: '1px solid #303030' }}
                        headStyle={{ color: '#e6edf3', borderBottom: '1px solid #303030' }}
                        bodyStyle={{ color: '#e6edf3' }}
                    >
                        {isGenerating ? (
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Text style={{ color: '#e6edf3' }}>正在生成剧集大纲...</Text>
                                <Progress
                                    percent={activeGeneration.progress || 0}
                                    status="active"
                                    strokeColor="#1890ff"
                                />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    会话ID: {activeGeneration.sessionId}
                                </Text>
                            </Space>
                        ) : activeGeneration.status === 'completed' ? (
                            <Alert
                                message="生成完成"
                                description={`已生成 ${activeGeneration.episodes?.length || 0} 集剧集大纲`}
                                type="success"
                                showIcon
                            />
                        ) : (
                            <Alert
                                message="生成失败"
                                description="请稍后重试"
                                type="error"
                                showIcon
                            />
                        )}
                    </Card>
                )}

                {/* Episode Generation Parameters */}
                <Card
                    title={
                        <Space>
                            <span>剧集生成参数</span>
                            <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={toggleEditMode}
                                disabled={isGenerating}
                                style={{ color: '#e6edf3' }}
                            >
                                {editMode ? '取消' : '编辑'}
                            </Button>
                        </Space>
                    }
                    style={{ backgroundColor: '#161b22', border: '1px solid #303030' }}
                    headStyle={{ color: '#e6edf3', borderBottom: '1px solid #303030' }}
                    bodyStyle={{ color: '#e6edf3' }}
                >
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Text style={{ color: '#e6edf3', minWidth: '80px' }}>集数:</Text>
                            {editMode ? (
                                <InputNumber
                                    value={editedEpisodes}
                                    onChange={(value) => setEditedEpisodes(value || 1)}
                                    min={1}
                                    max={20}
                                    style={{ width: '120px' }}
                                />
                            ) : (
                                <Text style={{ color: '#58a6ff' }}>{editedEpisodes} 集</Text>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <Text style={{ color: '#e6edf3', minWidth: '80px', marginTop: '4px' }}>
                                特殊要求:
                            </Text>
                            {editMode ? (
                                <TextArea
                                    value={editedRequirements}
                                    onChange={(e) => setEditedRequirements(e.target.value)}
                                    placeholder="例如：增强悬疑元素，注意节奏控制..."
                                    rows={3}
                                    style={{ flex: 1 }}
                                />
                            ) : (
                                <Text style={{ color: '#8b949e', flex: 1 }}>
                                    {editedRequirements || '无特殊要求'}
                                </Text>
                            )}
                        </div>
                    </Space>
                </Card>

                {/* Generated Episodes List */}
                {activeGeneration?.episodes && activeGeneration.episodes.length > 0 && (
                    <Card
                        title={`已生成剧集 (${activeGeneration.episodes.length})`}
                        style={{ backgroundColor: '#161b22', border: '1px solid #303030' }}
                        headStyle={{ color: '#e6edf3', borderBottom: '1px solid #303030' }}
                        bodyStyle={{ color: '#e6edf3' }}
                    >
                        <List
                            dataSource={activeGeneration.episodes}
                            renderItem={(episode) => (
                                <List.Item style={{ borderBottom: '1px solid #303030', padding: '16px 0' }}>
                                    <div style={{ width: '100%' }}>
                                        <Title level={5} style={{ color: '#e6edf3', marginBottom: '8px' }}>
                                            第{episode.episodeNumber}集: {episode.title}
                                        </Title>
                                        <Paragraph style={{ color: '#8b949e', marginBottom: '12px' }}>
                                            {episode.synopsis}
                                        </Paragraph>
                                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                            <div>
                                                <Text strong style={{ color: '#e6edf3' }}>关键事件:</Text>
                                                <ul style={{ margin: '4px 0 0 16px', color: '#8b949e' }}>
                                                    {episode.keyEvents.map((event, index) => (
                                                        <li key={index}>{event}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <Text strong style={{ color: '#e6edf3' }}>结尾悬念:</Text>
                                                <Text style={{ color: '#8b949e', marginLeft: '8px' }}>
                                                    {episode.endHook}
                                                </Text>
                                            </div>
                                        </Space>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </Card>
                )}

                {/* Action Buttons */}
                <Card
                    style={{ backgroundColor: '#161b22', border: '1px solid #303030' }}
                    bodyStyle={{ padding: '16px' }}
                >
                    <Space>
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={handleStartGeneration}
                            loading={generating}
                            disabled={!canStartGeneration}
                            style={{
                                background: canStartGeneration ? '#1890ff' : undefined,
                                borderColor: canStartGeneration ? '#1890ff' : undefined
                            }}
                        >
                            {isGenerating ? '生成中...' : '开始生成剧集'}
                        </Button>

                        {isGenerating && (
                            <Button
                                danger
                                icon={<StopOutlined />}
                                onClick={() => {
                                    // TODO: Implement stop generation
                                    message.info('停止生成功能开发中');
                                }}
                            >
                                停止生成
                            </Button>
                        )}
                    </Space>
                </Card>
            </Space>
        </div>
    );
}; 