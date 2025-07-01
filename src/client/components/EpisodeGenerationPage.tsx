import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Tree, Empty, Typography, Spin, Alert, Button } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useProjectData, useStageEpisodes } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';
import { OutlineExportModal } from './shared/OutlineExportModal';
import { formatMultiStageEpisodesForExport, type MultiStageEpisodeExportData } from '../utils/episodeExporter';
import { ExportOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface EpisodeNode extends DataNode {
    episodeNumber: number;
    episodeId: string;
    stageId: string;
    title: string;
    synopsis: string;
}

interface StageNode extends DataNode {
    stageNumber: number;
    artifactId: string;
    numberOfEpisodes: number;
    children?: EpisodeNode[];
    hasEpisodes?: boolean;
}

export const EpisodeGenerationPage: React.FC = () => {
    const { scriptId } = useParams<{ scriptId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Modern state management with TanStack Query + Zustand
    const { isLoading, error } = useProjectData(scriptId!);
    const stages = useProjectStore(state => state.projects[scriptId!]?.stages || []);
    const episodes = useProjectStore(state => state.projects[scriptId!]?.episodes || {});
    const expandedKeys = useProjectStore(state => state.projects[scriptId!]?.expandedKeys || []);
    const setExpandedKeys = useProjectStore(state => state.setExpandedKeys);

    // Export modal state
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    // Selection state
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

    // Get URL parameters
    const stageIdFromUrl = searchParams.get('stage_id');
    const episodeIdFromUrl = searchParams.get('episode_id');

    // Multi-stage export function
    const handleExportAllEpisodes = () => {
        if (!scriptId) return;

        // Calculate total episodes
        const totalEpisodes = stages.reduce((sum, stage) => sum + stage.numberOfEpisodes, 0);

        // Get outline session ID from first stage (they should all have the same one)
        const outlineSessionId = stages.length > 0 ? stages[0].outlineSessionId : 'unknown';

        // Prepare multi-stage export data
        const exportData: MultiStageEpisodeExportData = {
            scriptId,
            outlineSessionId,
            stages: stages.map(stage => ({
                stageNumber: stage.stageNumber,
                stageSynopsis: stage.stageSynopsis,
                numberOfEpisodes: stage.numberOfEpisodes,
                artifactId: stage.artifactId,
                episodes: episodes[stage.artifactId]?.episodes || []
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
    const hasGeneratedEpisodes = stages.some(stage =>
        episodes[stage.artifactId]?.episodes?.length > 0
    );

    // URL sync and auto-selection effect
    useEffect(() => {
        // Sync URL parameters with component state
        if (stageIdFromUrl && stageIdFromUrl !== selectedStageId) {
            setSelectedStageId(stageIdFromUrl);
        }
        if (episodeIdFromUrl && episodeIdFromUrl !== selectedEpisodeId) {
            setSelectedEpisodeId(episodeIdFromUrl);
        }

        // Auto-select first stage if none selected and stages are loaded
        if (!selectedStageId && stages.length > 0 && !isLoading && !stageIdFromUrl) {
            const firstStageId = stages[0].artifactId;
            setSelectedStageId(firstStageId);
            setSearchParams({ stage_id: firstStageId });
        }
    }, [
        selectedStageId,
        selectedEpisodeId,
        stages.length,
        isLoading,
        stageIdFromUrl,
        episodeIdFromUrl,
        setSearchParams
    ]);

    // Load episodes for expanded stages
    const expandedStageIds = expandedKeys.filter(key =>
        !key.includes('episode-') && stages.some(stage => stage.artifactId === key)
    );

    // Use hooks for each expanded stage (conditional rendering to avoid Rules of Hooks violation)
    const stageHooks = expandedStageIds.map(stageId => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useStageEpisodes(scriptId!, stageId, true);
    });

    // Build tree data for rendering
    const treeData = useMemo(() => {
        return stages.map(stage => {
            const stageEpisodeData = episodes[stage.artifactId];
            const stageEpisodes = stageEpisodeData?.episodes || [];
            const isLoadingEpisodes = stageEpisodeData?.loading || false;
            const isStreamingEpisodes = stageEpisodeData?.isStreaming || false;

            // Create episode children for existing episodes with normal icons
            const existingEpisodeChildren: EpisodeNode[] = stageEpisodes.map(episode => ({
                key: `episode-${stage.artifactId}-${episode.episodeNumber}`,
                title: `第${episode.episodeNumber}集: ${episode.title}`,
                isLeaf: true,
                episodeNumber: episode.episodeNumber,
                episodeId: episode.episodeNumber.toString(),
                stageId: stage.artifactId,
                synopsis: episode.briefSummary,
                icon: <FileTextOutlined style={{ color: '#e6edf3' }} />
            }));

            // Create placeholder children for missing episodes with greyed out icons
            const missingEpisodeChildren: EpisodeNode[] = [];
            const existingNumbers = stageEpisodes.map(ep => ep.episodeNumber);

            for (let i = 1; i <= stage.numberOfEpisodes; i++) {
                if (!existingNumbers.includes(i)) {
                    missingEpisodeChildren.push({
                        key: `missing-episode-${stage.artifactId}-${i}`,
                        title: `第${i}集: 待生成`,
                        isLeaf: true,
                        episodeNumber: i,
                        episodeId: i.toString(),
                        stageId: stage.artifactId,
                        synopsis: '',
                        icon: <FileTextOutlined style={{ color: '#6e7681', opacity: 0.5 }} />,
                        disabled: true
                    });
                }
            }

            // Combine and sort all episodes by episode number
            const allEpisodeChildren = [...existingEpisodeChildren, ...missingEpisodeChildren]
                .sort((a, b) => a.episodeNumber - b.episodeNumber);

            // Build stage title with status
            let stageTitle = `第${stage.stageNumber}阶段 (${stage.numberOfEpisodes}集)`;
            if (isStreamingEpisodes && stageEpisodes.length > 0) {
                stageTitle += ` - 正在生成 ${stageEpisodes.length}/${stage.numberOfEpisodes}`;
            } else if (stageEpisodes.length > 0) {
                stageTitle += ` - 已生成 ${stageEpisodes.length}集`;
            }

            return {
                key: stage.artifactId,
                title: stageTitle,
                isLeaf: false,
                children: allEpisodeChildren,
                stageNumber: stage.stageNumber,
                artifactId: stage.artifactId,
                numberOfEpisodes: stage.numberOfEpisodes,
                hasEpisodes: stageEpisodes.length > 0,
                icon: isLoadingEpisodes ? <Spin size="small" /> : undefined
            } as StageNode;
        });
    }, [stages, episodes]);

    // Handle tree selection
    const onTreeSelect = (selectedKeys: React.Key[]) => {
        const nodeKey = selectedKeys[0] as string;

        if (nodeKey && nodeKey.includes('episode-')) {
            // Skip if it's a missing episode
            if (nodeKey.includes('missing-episode-')) {
                return;
            }

            // Episode selected
            const episodePrefix = 'episode-';
            const afterPrefix = nodeKey.substring(episodePrefix.length);
            const lastHyphenIndex = afterPrefix.lastIndexOf('-');

            if (lastHyphenIndex !== -1) {
                const stageId = afterPrefix.substring(0, lastHyphenIndex);
                const episodeNumber = afterPrefix.substring(lastHyphenIndex + 1);

                setSelectedEpisodeId(episodeNumber);
                setSearchParams({
                    stage_id: stageId,
                    episode_id: episodeNumber
                });
            }
        } else if (nodeKey) {
            // Stage selected
            setSelectedStageId(nodeKey);
            setSelectedEpisodeId(null);
            setSearchParams({ stage_id: nodeKey });
        }
    };

    // Handle tree expansion
    const onTreeExpand = (expandedKeys: React.Key[]) => {
        if (scriptId) {
            setExpandedKeys(scriptId, expandedKeys as string[]);
        }
    };

    if (isLoading) {
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

    if (error) {
        return (
            <Alert
                message="加载失败"
                description={error.message}
                type="error"
                showIcon
                style={{ margin: '20px' }}
            />
        );
    }

    if (stages.length === 0) {
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
            display: 'flex',
            height: '100vh',
            backgroundColor: '#0a0a0a'
        }}>
            {/* Left Sidebar - Episode Tree */}
            <div style={{
                width: '300px',
                backgroundColor: '#1a1a1a',
                borderRight: '1px solid #333',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>
                        剧集结构
                    </Title>
                    {hasGeneratedEpisodes && (
                        <Button
                            icon={<ExportOutlined />}
                            size="small"
                            onClick={handleExportAllEpisodes}
                            style={{
                                backgroundColor: 'transparent',
                                borderColor: '#444',
                                color: '#fff'
                            }}
                        >
                            导出
                        </Button>
                    )}
                </div>

                {/* Tree */}
                <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                    <Tree
                        treeData={treeData}
                        expandedKeys={expandedKeys}
                        onExpand={onTreeExpand}
                        onSelect={onTreeSelect}
                        style={{
                            backgroundColor: 'transparent',
                            color: '#fff'
                        }}
                        blockNode
                    />
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {selectedStageId ? (
                    <>nothing</>
                ) : (
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
                                选择阶段开始生成剧集
                            </Title>
                            <Typography.Text type="secondary" style={{ fontSize: '16px', lineHeight: '1.6' }}>
                                从左侧剧集结构中选择一个阶段来查看和生成剧集内容
                            </Typography.Text>
                        </div>
                    </div>
                )}
            </div>

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                title="导出所有剧集大纲"
                content={exportText}
                onClose={() => setIsExportModalVisible(false)}
            />
        </div>
    );
}; 