import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Tree, Empty, Typography, Spin, Alert, Button } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { StageDetailView } from './StageDetailView';
import { EpisodeScriptGeneration } from './EpisodeScriptGeneration';
import { useEpisodeContext } from '../contexts/EpisodeContext';
import { OutlineExportModal } from './shared/OutlineExportModal';
import { formatMultiStageEpisodesForExport, type MultiStageEpisodeExportData } from '../utils/episodeExporter';
import { ExportOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface EpisodeNode extends DataNode {
    episodeNumber: number;
    episodeId: string;
    stageId: string;
    title: string;
    synopsis: string;
}

export const ScriptLayout: React.FC = () => {
    const { scriptId } = useParams<{ scriptId: string }>();
    const navigate = useNavigate();
    const { state, actions } = useEpisodeContext();
    
    // Export modal state
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    if (!scriptId) {
        return <div>Script ID not found</div>;
    }

    // Multi-stage export function
    const handleExportAllEpisodes = () => {
        if (!scriptId) return;

        // Calculate total episodes
        const totalEpisodes = state.stages.reduce((sum, stage) => sum + stage.numberOfEpisodes, 0);

        // Get outline session ID from first stage (they should all have the same one)
        const outlineSessionId = state.stages.length > 0 ? state.stages[0].outlineSessionId : 'unknown';

        // Prepare multi-stage export data
        const exportData: MultiStageEpisodeExportData = {
            scriptId,
            outlineSessionId,
            stages: state.stages.map(stage => ({
                stageNumber: stage.stageNumber,
                stageSynopsis: stage.stageSynopsis,
                numberOfEpisodes: stage.numberOfEpisodes,
                artifactId: stage.artifactId,
                episodes: state.stageEpisodeData[stage.artifactId]?.episodes || []
            })),
            totalEpisodes,
            generatedAt: new Date().toISOString()
        };

        // Generate formatted text
        const formattedText = formatMultiStageEpisodesForExport(exportData);
        setExportText(formattedText);
        setIsExportModalVisible(true);
    };

    // Check if there are any generated episodes across all stages
    const hasGeneratedEpisodes = state.stages.some(stage => 
        state.stageEpisodeData[stage.artifactId]?.episodes?.length > 0
    );

    // Initialize script when component mounts
    useEffect(() => {
        if (scriptId && scriptId !== state.scriptId) {
            actions.setScriptId(scriptId);
            actions.loadStages(scriptId);
        }
    }, [scriptId, state.scriptId, actions]);

    // Build tree data from stages and episodes
    const treeData: DataNode[] = useMemo(() => {
        return state.stages.map(stage => {
            const stageEpisodeData = state.stageEpisodeData[stage.artifactId];
            const episodes = stageEpisodeData?.episodes || [];
            const isLoading = stageEpisodeData?.loading || false;
            const isStreaming = stageEpisodeData?.isStreaming || false;

            const stageKey = stage.artifactId;

            const children: DataNode[] = episodes.map(episode => ({
                key: `episode-${stageKey}-${episode.episodeNumber}`,
                title: `第${episode.episodeNumber}集: ${episode.title || '无标题'}`,
                isLeaf: true,
                style: { color: '#d9d9d9' }
            }));

            // Add loading indicator if needed
            if (isLoading || isStreaming) {
                children.push({
                    key: `loading-${stageKey}`,
                    title: (
                        <span style={{ color: '#666', fontStyle: 'italic' }}>
                            {isStreaming ? '生成中...' : '加载中...'}
                        </span>
                    ),
                    isLeaf: true,
                    selectable: false
                });
            }

            let title = `第${stage.stageNumber}阶段 (${stage.numberOfEpisodes}集)`;
            if (isStreaming) {
                title += ' 🔄';
            } else if (episodes.length > 0) {
                title += ` ✅ ${episodes.length}/${stage.numberOfEpisodes}`;
            }

            return {
                key: stageKey,
                title,
                children: children.length > 0 ? children : undefined,
                isLeaf: children.length === 0 && !isLoading && !isStreaming,
                style: { color: isStreaming ? '#1890ff' : episodes.length > 0 ? '#52c41a' : '#d9d9d9' }
            };
        });
    }, [state.stages, state.stageEpisodeData]);

    // Handle tree selection - navigate to appropriate route
    const onTreeSelect = (selectedKeys: React.Key[]) => {
        const nodeKey = selectedKeys[0] as string;

        if (nodeKey && nodeKey.includes('episode-')) {
            // Episode selected - navigate to episode script generation
            const episodePrefix = 'episode-';
            const afterPrefix = nodeKey.substring(episodePrefix.length);
            const lastHyphenIndex = afterPrefix.lastIndexOf('-');
            
            if (lastHyphenIndex !== -1) {
                const stageId = afterPrefix.substring(0, lastHyphenIndex);
                const episodeNumber = afterPrefix.substring(lastHyphenIndex + 1);
                navigate(`/scripts/${scriptId}/stages/${stageId}/episodes/${episodeNumber}`);
            }
        } else if (nodeKey) {
            // Stage selected - navigate to stage detail
            navigate(`/scripts/${scriptId}/stages/${nodeKey}`);
        }
    };

    // Handle tree expansion
    const onTreeExpand = (expandedKeys: React.Key[]) => {
        const newExpandedKeys = expandedKeys as string[];
        actions.setExpandedKeys(newExpandedKeys);

        // Load episodes for newly expanded stages
        const currentExpandedKeys = state.expandedKeys;
        const newlyExpanded = newExpandedKeys.filter(key =>
            !currentExpandedKeys.includes(key) && !key.includes('episode-')
        );

        newlyExpanded.forEach(stageId => {
            if (!state.stageEpisodeData[stageId]) {
                actions.loadStageEpisodes(stageId);
            }
        });
    };

    if (state.loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px',
                flexDirection: 'column'
            }}>
                <Spin size="large" />
                <Typography.Text style={{ marginTop: '16px', color: '#fff' }}>
                    加载剧本数据...
                </Typography.Text>
            </div>
        );
    }

    if (state.error) {
        return (
            <Alert
                message="加载失败"
                description={state.error}
                type="error"
                showIcon
                style={{ margin: '20px' }}
            />
        );
    }

    if (state.stages.length === 0) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px',
                flexDirection: 'column'
            }}>
                <Empty
                    description={
                        <span style={{ color: '#666' }}>
                            暂无阶段数据
                        </span>
                    }
                />
            </div>
        );
    }

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            backgroundColor: '#0a0a0a'
        }}>
            {/* Left Panel - Stage Tree (Always Visible) */}
            <div style={{
                width: '400px',
                borderRight: '1px solid #404040',
                backgroundColor: '#1a1a1a',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #404040',
                    backgroundColor: '#262626'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                    }}>
                        <Title level={4} style={{ color: '#fff', margin: 0 }}>
                            剧集结构
                        </Title>
                        {hasGeneratedEpisodes && (
                            <Button
                                icon={<ExportOutlined />}
                                onClick={handleExportAllEpisodes}
                                size="small"
                                style={{
                                    backgroundColor: '#1f1f1f',
                                    borderColor: '#404040',
                                    color: '#fff'
                                }}
                            >
                                导出
                            </Button>
                        )}
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        点击阶段或剧集查看详情
                    </Typography.Text>
                </div>

                {/* Tree */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                    <Tree
                        treeData={treeData}
                        onSelect={onTreeSelect}
                        onExpand={onTreeExpand}
                        expandedKeys={state.expandedKeys}
                        style={{
                            backgroundColor: 'transparent',
                            color: '#fff'
                        }}
                        blockNode
                    />
                </div>
            </div>

            {/* Right Panel - Content Based on Route */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <Routes>
                    {/* Default route - instructions */}
                    <Route index element={
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            backgroundColor: '#0a0a0a'
                        }}>
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                maxWidth: '500px'
                            }}>
                                <Title level={3} style={{ color: '#fff', marginBottom: '16px' }}>
                                    选择阶段或剧集
                                </Title>
                                <Typography.Text type="secondary" style={{ fontSize: '16px', lineHeight: '1.6' }}>
                                    从左侧树形结构中选择：
                                    <br />
                                    • 点击<strong>阶段</strong>查看和管理该阶段的剧集大纲
                                    <br />
                                    • 点击<strong>具体剧集</strong>生成详细剧本内容
                                </Typography.Text>
                            </div>
                        </div>
                    } />
                    
                    {/* Stage detail route - episode synopsis generation */}
                    <Route path="stages/:stageId" element={
                        <StageDetailView 
                            selectedStageId={undefined} // Will be read from URL params inside component
                            stages={state.stages}
                            stageEpisodeData={state.stageEpisodeData}
                            onEpisodeSelect={(episodeNumber) => {
                                // This will be handled by the component itself using URL params
                            }}
                        />
                    } />
                    
                    {/* Episode script generation route */}
                    <Route path="stages/:stageId/episodes/:episodeId" element={<EpisodeScriptGeneration />} />
                </Routes>
            </div>

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                content={exportText}
                title="多阶段剧集导出"
            />
        </div>
    );
}; 