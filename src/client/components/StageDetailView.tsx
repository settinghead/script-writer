import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    Tag,
    Collapse
} from 'antd';
import { PlayCircleOutlined, EditOutlined, StopOutlined, ExportOutlined } from '@ant-design/icons';
import { OutlineExportModal } from './shared/OutlineExportModal';
import { formatEpisodesForExport, type EpisodeExportData } from '../utils/episodeExporter';
import { useEpisodeContext, EpisodeApiService } from '../contexts/EpisodeContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface StageDetailViewProps {
    selectedStageId: string | null;
    stages: any[];
    stageEpisodeData: Record<string, any>;
    onEpisodeSelect?: (episodeNumber: number) => void;
}

export const StageDetailView: React.FC<StageDetailViewProps> = ({
    stages,
    stageEpisodeData,
    onEpisodeSelect
}) => {
    const { actions } = useEpisodeContext();
    const { scriptId, stageId } = useParams<{ scriptId: string; stageId: string }>();
    const navigate = useNavigate();
    const [editMode, setEditMode] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');
    const [stageDetailsCollapsed, setStageDetailsCollapsed] = useState(false);
    const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);

    // Editable parameters
    const [editedEpisodes, setEditedEpisodes] = useState<number>(0);
    const [editedRequirements, setEditedRequirements] = useState<string>('');

    // Get current stage data and episode data
    const stageData = stages.find(s => s.artifactId === stageId);
    const currentStageEpisodeData = stageId ? stageEpisodeData[stageId] : undefined;
    const episodes = currentStageEpisodeData?.episodes || [];
    const isLoading = currentStageEpisodeData?.loading || false;
    const isStreaming = currentStageEpisodeData?.isStreaming || false;
    const sessionData = currentStageEpisodeData?.sessionData;

    // 🔥 DEBUG: Log stage data to see what fields are available
    React.useEffect(() => {
        if (stageData) {
            console.log('🔍 StageDetailView - Current stage data:', stageData);
            console.log('🔍 Available fields:', Object.keys(stageData));
            console.log('🔍 keyPoints:', stageData.keyPoints);
            console.log('🔍 timeframe:', stageData.timeframe);
            console.log('🔍 Enhanced fields present:', {
                hasKeyPoints: !!stageData.keyPoints,
                hasTimeframe: !!stageData.timeframe,
                hasStartingCondition: !!stageData.startingCondition,
                hasEndingCondition: !!stageData.endingCondition,
                hasStageStartEvent: !!stageData.stageStartEvent,
                hasStageEndEvent: !!stageData.stageEndEvent,
                hasExternalPressure: !!stageData.externalPressure
            });
        }
    }, [stageData]);

    // 🔥 NEW: Debug episode data to see if new fields are present
    React.useEffect(() => {
        if (episodes.length > 0) {
            console.log('🔍 StageDetailView - Episodes data:', episodes);
            console.log('🔍 First episode structure:', episodes[0]);
            console.log('🔍 Episode fields available:', Object.keys(episodes[0]));
            console.log('🔍 Enhanced episode fields present:', {
                hasEmotionDevelopments: !!episodes[0].emotionDevelopments,
                hasRelationshipDevelopments: !!episodes[0].relationshipDevelopments,
                emotionDevelopmentsLength: episodes[0].emotionDevelopments?.length || 0,
                relationshipDevelopmentsLength: episodes[0].relationshipDevelopments?.length || 0
            });
        }
    }, [episodes]);

    // Check if this stage is currently streaming
    const isActiveStreaming = isStreaming;

    // Episode selection is handled by parent component

    // Initialize editable parameters when stage data loads
    React.useEffect(() => {
        if (stageData) {
            setEditedEpisodes(stageData.numberOfEpisodes);
        }
    }, [stageData]);

    // Auto-collapse stage details when generation starts or episodes are generated
    React.useEffect(() => {
        // Auto-collapse when streaming starts
        if (isActiveStreaming && !stageDetailsCollapsed) {
            setStageDetailsCollapsed(true);
        }
        // Auto-collapse when episodes are generated (only once)
        else if (episodes.length > 0 && !stageDetailsCollapsed && !hasAutoCollapsed) {
            setStageDetailsCollapsed(true);
            setHasAutoCollapsed(true);
        }
    }, [isActiveStreaming, episodes.length, stageDetailsCollapsed, hasAutoCollapsed]);

    const handleStartGeneration = async () => {
        if (!stageData) return;

        try {
            // Fetch cascaded parameters before starting generation
            const cascadedParams = await EpisodeApiService.getCascadedParams(stageData.outlineSessionId);
            
            await actions.startEpisodeGeneration(
                stageData.artifactId, 
                editedEpisodes, 
                editedRequirements.trim() || undefined,
                cascadedParams // Include cascaded parameters
            );
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
        <div style={{ position: 'relative' }}>
            {/* CSS for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
            
            {/* Top Progress Bar - NProgress Style */}
            {(isActiveStreaming || episodes.length > 0) && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: '#0d1117',
                    borderBottom: '1px solid #21262d',
                    padding: '0',
                    marginBottom: '1px'
                }}>
                    <Progress
                        percent={progress}
                        status={isActiveStreaming ? "active" : "normal"}
                        showInfo={false}
                        size="small"
                        strokeWidth={2}
                        strokeColor={isActiveStreaming ? {
                            '0%': '#1890ff',
                            '50%': '#52c41a', 
                            '100%': '#faad14'
                        } : '#52c41a'}
                        trailColor="rgba(255, 255, 255, 0.1)"
                        style={{ 
                            margin: 0,
                            padding: 0
                        }}
                    />
                    {isActiveStreaming && (
                        <div style={{
                            position: 'absolute',
                            top: '6px',
                            right: '12px',
                            fontSize: '11px',
                            color: '#8b949e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <span>正在生成 {episodes.length}/{expectedEpisodes}</span>
                            <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#1890ff',
                                animation: 'pulse 2s infinite'
                            }} />
                        </div>
                    )}
                    {!isActiveStreaming && episodes.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '6px',
                            right: '12px',
                            fontSize: '11px',
                            color: '#52c41a',
                            fontWeight: 500
                        }}>
                            已完成 {episodes.length}/{expectedEpisodes}
                        </div>
                    )}
                </div>
            )}

            {/* Main Content */}
            <div style={{ padding: '20px 40px' }}>
                {/* Episode selection is handled by navigation now */}

            {/* Collapsible Stage Information */}
            <Collapse
                activeKey={stageDetailsCollapsed ? [] : ['stage-details']}
                onChange={(keys) => {
                    setStageDetailsCollapsed(!keys.includes('stage-details'));
                    // Mark that user has manually interacted, preventing auto-collapse interference
                    if (!hasAutoCollapsed) {
                        setHasAutoCollapsed(true);
                    }
                }}
                style={{ marginBottom: '20px' }}
                size="large"
            >
                <Panel 
                    header={`第${stageData.stageNumber}阶段`} 
                    key="stage-details"
                    extra={
                        <Space size="small">
                            {episodes.length > 0 && (
                                <Tag color="green">{episodes.length}集已生成</Tag>
                            )}
                            {isActiveStreaming && (
                                <Tag color="processing">生成中</Tag>
                            )}
                        </Space>
                    }
                >
                    <Paragraph>{stageData.stageSynopsis}</Paragraph>

                    {/* 🔥 NEW: Enhanced Stage Context Display */}
                    {(stageData.timeframe || stageData.startingCondition || stageData.endingCondition) && (
                        <>
                            <Divider />
                            <Title level={5}>阶段背景</Title>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                {stageData.timeframe && (
                                    <div>
                                        <Text strong>时间跨度：</Text>
                                        <Text>{stageData.timeframe}</Text>
                                    </div>
                                )}
                                {stageData.startingCondition && (
                                    <div>
                                        <Text strong>开始状态：</Text>
                                        <Text>{stageData.startingCondition}</Text>
                                    </div>
                                )}
                                {stageData.endingCondition && (
                                    <div>
                                        <Text strong>结束状态：</Text>
                                        <Text>{stageData.endingCondition}</Text>
                                    </div>
                                )}
                                {stageData.stageStartEvent && (
                                    <div>
                                        <Text strong>起始事件：</Text>
                                        <Text>{stageData.stageStartEvent}</Text>
                                    </div>
                                )}
                                {stageData.stageEndEvent && (
                                    <div>
                                        <Text strong>结束事件：</Text>
                                        <Text>{stageData.stageEndEvent}</Text>
                                    </div>
                                )}
                                {stageData.externalPressure && (
                                    <div>
                                        <Text strong>外部压力：</Text>
                                        <Text>{stageData.externalPressure}</Text>
                                    </div>
                                )}
                            </Space>
                        </>
                    )}

                    {/* 🔥 NEW: Enhanced Key Points Display */}
                    {stageData.keyPoints && Array.isArray(stageData.keyPoints) && stageData.keyPoints.length > 0 && (
                        <>
                            <Divider />
                            <Title level={5}>关键故事节点（将传递给AI生成剧集）</Title>
                            <div style={{ marginBottom: '16px' }}>
                                {stageData.keyPoints.map((point: any, index: number) => (
                                    <Card 
                                        key={index} 
                                        size="small" 
                                        style={{ 
                                            marginBottom: '12px',
                                            backgroundColor: '#1f1f1f',
                                            borderColor: '#404040'
                                        }}
                                        title={
                                            <div style={{ color: '#e6edf3' }}>
                                                <Text strong style={{ color: '#58a6ff' }}>
                                                    节点 {index + 1}: {point.event}
                                                </Text>
                                                {point.timeSpan && (
                                                    <Tag color="blue" style={{ marginLeft: '8px' }}>
                                                        {point.timeSpan}
                                                    </Tag>
                                                )}
                                            </div>
                                        }
                                    >
                                        {/* Emotion Arcs */}
                                        {point.emotionArcs && Array.isArray(point.emotionArcs) && point.emotionArcs.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <Text strong style={{ color: '#f85149' }}>情感发展：</Text>
                                                {point.emotionArcs.map((arc: any, arcIndex: number) => (
                                                    <div key={arcIndex} style={{ marginLeft: '16px', marginTop: '4px' }}>
                                                        <Text style={{ color: '#e6edf3' }}>
                                                            <Text style={{ color: '#ffa657' }}>
                                                                {Array.isArray(arc.characters) ? arc.characters.join('、') : arc.characters}
                                                            </Text>
                                                            : {arc.content}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Relationship Developments */}
                                        {point.relationshipDevelopments && Array.isArray(point.relationshipDevelopments) && point.relationshipDevelopments.length > 0 && (
                                            <div>
                                                <Text strong style={{ color: '#a5f3fc' }}>关系发展：</Text>
                                                {point.relationshipDevelopments.map((rel: any, relIndex: number) => (
                                                    <div key={relIndex} style={{ marginLeft: '16px', marginTop: '4px' }}>
                                                        <Text style={{ color: '#e6edf3' }}>
                                                            <Text style={{ color: '#ffa657' }}>
                                                                {Array.isArray(rel.characters) ? rel.characters.join('、') : rel.characters}
                                                            </Text>
                                                            : {rel.content}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                            <Alert
                                message="AI剧集生成上下文"
                                description="以上详细的角色情感发展和关系变化信息将被传递给AI，用于生成具有连贯性和深度的分集剧情。这确保了每集都能推进角色发展和情感线。"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        </>
                    )}

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
                                {episodes.length > 0 ? '重新生成剧集' : '开始生成剧集'}
                            </Button>
                        ) : (
                            <Button
                                type="primary"
                                danger
                                icon={<StopOutlined />}
                                onClick={handleStopGeneration}
                                disabled={true}
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
                </Panel>
            </Collapse>



            {/* Episodes List */}
            {episodes.length > 0 && (
                <Card title={`已生成剧集 (${episodes.length}集)`}>
                    <List
                        dataSource={episodes}
                        renderItem={(episode, index) => (
                            <List.Item
                                key={episode.episodeNumber}
                                style={{
                                    padding: '12px',
                                    margin: '4px 0',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    transition: 'background-color 0.2s'
                                }}
                                onClick={() => {
                                    if (scriptId && stageId) {
                                        navigate(`/scripts/${scriptId}/stages/${stageId}/episodes/${episode.episodeNumber}`);
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <Text strong>第{episode.episodeNumber}集: {episode.title}</Text>
                                        {isActiveStreaming && index === episodes.length - 1 && (
                                            <Tag color="processing">正在生成</Tag>
                                        )}
                                        <Tag color="blue" style={{ fontSize: '11px' }}>点击生成剧本</Tag>
                                    </div>
                                    
                                    {/* Episode Summary */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <Paragraph ellipsis={{ rows: 2, expandable: true }}>
                                            {episode.briefSummary}
                                        </Paragraph>
                                    </div>

                                    {/* Key Events */}
                                    {episode.keyEvents && episode.keyEvents.length > 0 && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                                                📋 关键事件:
                                            </Text>
                                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                                {episode.keyEvents.map((event, eventIndex) => (
                                                    <li key={eventIndex} style={{ fontSize: '14px', color: '#666', marginBottom: '2px' }}>
                                                        {event}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* 🔥 NEW: Two-column layout for Emotion & Relationship Developments */}
                                    {((episode.emotionDevelopments && episode.emotionDevelopments.length > 0) || 
                                      (episode.relationshipDevelopments && episode.relationshipDevelopments.length > 0)) && (
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: '1fr 1fr', 
                                            gap: '16px', 
                                            marginBottom: '12px' 
                                        }}>
                                            {/* Emotion Developments Column */}
                                            <div>
                                                {episode.emotionDevelopments && episode.emotionDevelopments.length > 0 && (
                                                    <>
                                                        <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                                                            💚 情感发展:
                                                        </Text>
                                                        <div style={{ marginTop: '4px' }}>
                                                            {episode.emotionDevelopments.map((dev, devIndex) => (
                                                                <div key={devIndex} style={{ 
                                                                    backgroundColor: '#0a2000', 
                                                                    border: '1px solid #237a00',
                                                                    borderRadius: '4px',
                                                                    padding: '8px',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    <div style={{ fontSize: '14px', color: '#52c41a', marginBottom: '2px' }}>
                                                                        角色: {dev.characters.join(', ')}
                                                                    </div>
                                                                    <div style={{ fontSize: '14px', color: '#d9d9d9' }}>
                                                                        {dev.content}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Relationship Developments Column */}
                                            <div>
                                                {episode.relationshipDevelopments && episode.relationshipDevelopments.length > 0 && (
                                                    <>
                                                        <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                                                            💙 关系发展:
                                                        </Text>
                                                        <div style={{ marginTop: '4px' }}>
                                                            {episode.relationshipDevelopments.map((dev, devIndex) => (
                                                                <div key={devIndex} style={{ 
                                                                    backgroundColor: '#001529', 
                                                                    border: '1px solid #1890ff',
                                                                    borderRadius: '4px',
                                                                    padding: '8px',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    <div style={{ fontSize: '14px', color: '#1890ff', marginBottom: '2px' }}>
                                                                        角色: {dev.characters.join(', ')}
                                                                    </div>
                                                                    <div style={{ fontSize: '14px', color: '#d9d9d9' }}>
                                                                        {dev.content}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* End Hook */}
                                    {episode.hooks && (
                                        <div style={{ marginTop: '8px' }}>
                                            <Text strong style={{ color: '#ff7a45', fontSize: '14px' }}>
                                                🎬 结尾悬念:
                                            </Text>
                                            <div style={{ fontSize: '14px', color: '#888', fontStyle: 'italic', marginTop: '2px' }}>
                                                {episode.hooks}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
        </div>
    );
}; 