import React, { useState } from 'react';
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
import { PlayCircleOutlined, EditOutlined, StopOutlined, ExportOutlined } from '@ant-design/icons';
import { EpisodeSynopsisV1 } from '../../common/types';
import { EpisodeSynopsis } from '../services/implementations/EpisodeStreamingService';
import { OutlineExportModal } from './shared/OutlineExportModal';
import { formatEpisodesForExport, type EpisodeExportData } from '../utils/episodeExporter';
import { useStageSession } from '../hooks/useStageSession';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StageDetailViewProps {
    scriptId: string;
    stageId: string | null;
    onGenerateStart?: () => void;
}

export const StageDetailView: React.FC<StageDetailViewProps> = ({
    scriptId,
    stageId,
    onGenerateStart
}) => {
    const [editMode, setEditMode] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    // Editable parameters
    const [editedEpisodes, setEditedEpisodes] = useState<number>(0);
    const [editedRequirements, setEditedRequirements] = useState<string>('');

    // Use the stage session hook for all data management
    const {
        stageData,
        sessionData,
        streamingEpisodes,
        isStreaming,
        isThinking,
        streamingError,
        loading,
        generating,
        startGeneration,
        stopGeneration,
        progress,
        episodeCount
    } = useStageSession(stageId);

    // Initialize editable parameters when stage data loads
    React.useEffect(() => {
        if (stageData) {
            setEditedEpisodes(stageData.numberOfEpisodes);
        }
    }, [stageData]);

    const handleStartGeneration = async () => {
        if (!stageData) return;

        try {
            await startGeneration(editedEpisodes, editedRequirements.trim() || undefined);
            onGenerateStart?.();
            message.success('剧集生成已开始');
        } catch (error) {
            console.error('Error starting episode generation:', error);
            message.error('启动剧集生成失败');
        }
    };

    const handleStopGeneration = async () => {
        try {
            await stopGeneration();
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

    const handleExport = () => {
        if (!stageData) return;

        // Get episodes from either streaming data or session data
        const episodes = streamingEpisodes.length > 0 ? streamingEpisodes : (sessionData?.episodes || []);

        // Prepare export data
        const exportData: EpisodeExportData = {
            sessionId: sessionData?.session.id || 'unknown',
            stageData: {
                stageNumber: stageData.stageNumber,
                stageSynopsis: stageData.stageSynopsis,
                numberOfEpisodes: stageData.numberOfEpisodes,
                artifactId: stageData.artifactId
            },
            episodes,
            generatedAt: new Date().toISOString()
        };

        // Generate formatted text
        const formattedText = formatEpisodesForExport(exportData);
        setExportText(formattedText);
        setIsExportModalVisible(true);
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

    if (!stageId) {
        return (
            <Alert
                message="请选择阶段"
                description="在左侧树形菜单中选择一个阶段开始生成剧集"
                type="info"
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

    // Calculate expected episodes
    const expectedEpisodes = editedEpisodes || stageData.numberOfEpisodes;

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
                                        已生成 {episodeCount} / {expectedEpisodes} 集
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
                <Card
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>剧集大纲</span>
                            {!isStreaming && (
                                <Button
                                    onClick={handleExport}
                                    icon={<ExportOutlined />}
                                    type="default"
                                    size="small"
                                >
                                    导出剧集大纲
                                </Button>
                            )}
                        </div>
                    }
                    style={{ marginBottom: '20px' }}
                >
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

            {streamingError && (
                <Alert
                    message="流式传输错误"
                    description={typeof streamingError === 'string' ? streamingError : streamingError.message}
                    type="error"
                    showIcon
                    style={{ marginBottom: '20px' }}
                />
            )}

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                exportText={exportText}
                title="导出剧集大纲"
            />
        </div>
    );
}; 