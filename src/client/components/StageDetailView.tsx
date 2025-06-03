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
import { OutlineExportModal } from './shared/OutlineExportModal';
import { formatEpisodesForExport, type EpisodeExportData } from '../utils/episodeExporter';
import { useEpisodeContext } from '../contexts/EpisodeContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StageDetailViewProps {
    scriptId: string;
    stageId: string | null;
    selectedEpisodeId?: string | null;
}

export const StageDetailView: React.FC<StageDetailViewProps> = ({
    scriptId,
    stageId,
    selectedEpisodeId
}) => {
    const { state, actions } = useEpisodeContext();
    const [editMode, setEditMode] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    // Editable parameters
    const [editedEpisodes, setEditedEpisodes] = useState<number>(0);
    const [editedRequirements, setEditedRequirements] = useState<string>('');

    // Get current stage data and episode data
    const stageData = state.stages.find(s => s.artifactId === stageId);
    const stageEpisodeData = stageId ? state.stageEpisodeData[stageId] : undefined;
    const episodes = stageEpisodeData?.episodes || [];
    const isLoading = stageEpisodeData?.loading || false;
    const isStreaming = stageEpisodeData?.isStreaming || false;
    const sessionData = stageEpisodeData?.sessionData;

    // Check if this stage is currently streaming
    const isActiveStreaming = state.activeStreamingStageId === stageId;

    // Find selected episode if selectedEpisodeId is provided
    const selectedEpisode = selectedEpisodeId ?
        episodes.find(ep => ep.episodeNumber.toString() === selectedEpisodeId) : null;

    // Initialize editable parameters when stage data loads
    React.useEffect(() => {
        if (stageData) {
            setEditedEpisodes(stageData.numberOfEpisodes);
        }
    }, [stageData]);

    const handleStartGeneration = async () => {
        if (!stageData) return;

        try {
            await actions.startEpisodeGeneration(stageData.artifactId, editedEpisodes, editedRequirements.trim() || undefined);
            message.success('剧集生成已开始');
        } catch (error) {
            console.error('Error starting episode generation:', error);
            message.error('启动剧集生成失败');
        }
    };

    const handleStopGeneration = async () => {
        if (!stageData) return;

        try {
            await actions.stopEpisodeGeneration(stageData.artifactId);
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

    if (isLoading) {
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

    // Calculate expected episodes and progress
    const expectedEpisodes = editedEpisodes || stageData.numberOfEpisodes;
    const progress = Math.min((episodes.length / expectedEpisodes) * 100, 100);

    return (
        <div style={{ padding: '20px' }}>
            {/* Selected Episode Highlight */}
            {selectedEpisode && (
                <Card
                    size="small"
                    style={{
                        marginBottom: '20px',
                        borderColor: '#1890ff',
                        backgroundColor: '#f6ffed'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag color="blue">选中剧集</Tag>
                        <Text strong>第{selectedEpisode.episodeNumber}集: {selectedEpisode.title}</Text>
                    </div>
                    <Paragraph style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                        {selectedEpisode.briefSummary}
                    </Paragraph>
                </Card>
            )}

            {/* Stage Information */}
            <Card title={`第${stageData.stageNumber}阶段`} style={{ marginBottom: '20px' }}>
                <Paragraph>{stageData.stageSynopsis}</Paragraph>

                <Divider />

                {/* Generation Parameters */}
                <div style={{ marginBottom: '20px' }}>
                    <Title level={5}>生成参数</Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <div>
                            <Text strong>剧集数量: </Text>
                            {editMode ? (
                                <InputNumber
                                    min={1}
                                    max={20}
                                    value={editedEpisodes}
                                    onChange={value => setEditedEpisodes(value || 1)}
                                />
                            ) : (
                                <Text>{expectedEpisodes}集</Text>
                            )}
                        </div>

                        <div>
                            <Text strong>特殊要求: </Text>
                            {editMode ? (
                                <TextArea
                                    rows={3}
                                    placeholder="输入对剧集生成的特殊要求..."
                                    value={editedRequirements}
                                    onChange={e => setEditedRequirements(e.target.value)}
                                />
                            ) : (
                                <Text style={{ color: '#666' }}>
                                    {editedRequirements || '无特殊要求'}
                                </Text>
                            )}
                        </div>
                    </Space>
                </div>

                {/* Action Buttons */}
                <Space>
                    {editMode ? (
                        <>
                            <Button type="primary" onClick={handleSaveParameters}>
                                保存参数
                            </Button>
                            <Button onClick={() => setEditMode(false)}>
                                取消
                            </Button>
                        </>
                    ) : (
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => setEditMode(true)}
                        >
                            编辑参数
                        </Button>
                    )}

                    {!isActiveStreaming ? (
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={handleStartGeneration}
                            disabled={editMode}
                        >
                            开始生成剧集
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            danger
                            icon={<StopOutlined />}
                            onClick={handleStopGeneration}
                        >
                            停止生成
                        </Button>
                    )}

                    {episodes.length > 0 && (
                        <Button
                            icon={<ExportOutlined />}
                            onClick={handleExport}
                        >
                            导出剧集
                        </Button>
                    )}
                </Space>
            </Card>

            {/* Generation Progress */}
            {(isActiveStreaming || episodes.length > 0) && (
                <Card title="生成进度" style={{ marginBottom: '20px' }}>
                    <Progress
                        percent={progress}
                        status={isActiveStreaming ? "active" : "normal"}
                        format={() => `${episodes.length}/${expectedEpisodes}`}
                    />
                    {isActiveStreaming && (
                        <div style={{ marginTop: '10px' }}>
                            <Text type="secondary">正在生成剧集内容...</Text>
                        </div>
                    )}
                    {isStreaming && !isActiveStreaming && (
                        <div style={{ marginTop: '10px' }}>
                            <Text type="secondary">正在重新连接到生成会话...</Text>
                        </div>
                    )}
                </Card>
            )}

            {/* Episodes List */}
            {episodes.length > 0 && (
                <Card title={`已生成剧集 (${episodes.length}集)`}>
                    <List
                        dataSource={episodes}
                        renderItem={(episode, index) => (
                            <List.Item
                                key={episode.episodeNumber}
                                style={{
                                    backgroundColor: selectedEpisode?.episodeNumber === episode.episodeNumber ? '#f6ffed' : undefined,
                                    borderRadius: selectedEpisode?.episodeNumber === episode.episodeNumber ? '4px' : undefined,
                                    padding: '12px',
                                    margin: '4px 0'
                                }}
                            >
                                <List.Item.Meta
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Text strong>第{episode.episodeNumber}集: {episode.title}</Text>
                                            {isActiveStreaming && index === episodes.length - 1 && (
                                                <Tag color="processing">正在生成</Tag>
                                            )}
                                        </div>
                                    }
                                    description={
                                        <div>
                                            <Paragraph ellipsis={{ rows: 2, expandable: true }}>
                                                {episode.briefSummary}
                                            </Paragraph>
                                            {episode.keyEvents && (
                                                <Text type="secondary">
                                                    关键情节: {episode.keyEvents}
                                                </Text>
                                            )}
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            )}

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                exportText={exportText}
                title="剧集大纲导出"
            />
        </div>
    );
}; 