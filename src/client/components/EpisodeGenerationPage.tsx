import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Tree, Empty, Typography, Spin, Alert } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { StageDetailView } from './StageDetailView';
import { useEpisodeContext } from '../contexts/EpisodeContext';

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
    const { state, actions } = useEpisodeContext();

    // Get URL parameters
    const stageIdFromUrl = searchParams.get('stage_id');
    const episodeIdFromUrl = searchParams.get('episode_id');

    // Combined initialization and URL sync effect
    useEffect(() => {
        // Initialize script if needed
        if (scriptId && scriptId !== state.scriptId) {
            actions.setScriptId(scriptId);
            actions.loadStages(scriptId);
        }

        // Sync URL parameters with context state
        if (stageIdFromUrl && stageIdFromUrl !== state.selectedStageId) {
            actions.setSelectedStage(stageIdFromUrl);
        }
        if (episodeIdFromUrl && episodeIdFromUrl !== state.selectedEpisodeId) {
            actions.setSelectedEpisode(episodeIdFromUrl);
        }

        // Auto-select first stage if none selected and stages are loaded
        if (!state.selectedStageId && state.stages.length > 0 && !state.loading && !stageIdFromUrl) {
            const firstStageId = state.stages[0].artifactId;
            actions.setSelectedStage(firstStageId);
            setSearchParams({ stage_id: firstStageId });
        }
    }, [
        scriptId,
        state.scriptId,
        state.selectedStageId,
        state.selectedEpisodeId,
        state.stages.length,
        state.loading,
        stageIdFromUrl,
        episodeIdFromUrl,
        actions,
        setSearchParams
    ]);

    // Build tree data for rendering
    const treeData = useMemo(() => {
        return state.stages.map(stage => {
            const stageEpisodeData = state.stageEpisodeData[stage.artifactId];
            const episodes = stageEpisodeData?.episodes || [];
            const isLoadingEpisodes = stageEpisodeData?.loading || false;
            const isStreamingEpisodes = stageEpisodeData?.isStreaming || false;

            const episodeChildren: EpisodeNode[] = episodes.map(episode => ({
                key: `episode-${stage.artifactId}-${episode.episodeNumber}`,
                title: `第${episode.episodeNumber}集: ${episode.title}`,
                isLeaf: true,
                episodeNumber: episode.episodeNumber,
                episodeId: episode.episodeNumber.toString(),
                stageId: stage.artifactId,
                synopsis: episode.briefSummary
            }));

            // Build stage title with status
            let stageTitle = `第${stage.stageNumber}阶段 (${stage.numberOfEpisodes}集)`;
            if (isStreamingEpisodes && episodes.length > 0) {
                stageTitle += ` - 正在生成 ${episodes.length}/${stage.numberOfEpisodes}`;
            } else if (episodes.length > 0) {
                stageTitle += ` - 已生成 ${episodes.length}集`;
            }

            return {
                key: stage.artifactId,
                title: stageTitle,
                isLeaf: false,
                children: episodeChildren,
                stageNumber: stage.stageNumber,
                artifactId: stage.artifactId,
                numberOfEpisodes: stage.numberOfEpisodes,
                hasEpisodes: episodes.length > 0,
                icon: isLoadingEpisodes ? <Spin size="small" /> : undefined
            } as StageNode;
        });
    }, [state.stages, state.stageEpisodeData]);

    // Handle tree selection
    const onTreeSelect = (selectedKeys: React.Key[]) => {
        const nodeKey = selectedKeys[0] as string;

        if (nodeKey && nodeKey.includes('episode-')) {
            // Episode selected
            const [, stageId, episodeNumber] = nodeKey.split('-');
            actions.setSelectedStage(stageId);
            actions.setSelectedEpisode(episodeNumber);
            setSearchParams({ stage_id: stageId, episode_id: episodeNumber });
        } else if (nodeKey) {
            // Stage selected
            actions.setSelectedStage(nodeKey);
            actions.setSelectedEpisode(null);
            setSearchParams({ stage_id: nodeKey });
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

    // Loading state
    if (state.loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    // Error state
    if (state.error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Alert
                    message="加载失败"
                    description={state.error}
                    type="error"
                    showIcon
                    action={
                        <button
                            onClick={() => navigate(-1)}
                            style={{
                                background: 'none',
                                border: '1px solid #d32f2f',
                                color: '#d32f2f',
                                padding: '4px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            返回
                        </button>
                    }
                />
            </div>
        );
    }

    // Selected keys for tree
    const selectedNodeKeys = state.selectedEpisodeId
        ? [`episode-${state.selectedStageId}-${state.selectedEpisodeId}`]
        : state.selectedStageId ? [state.selectedStageId] : [];

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            backgroundColor: '#0d1117'
        }}>
            {/* Left: Tree View */}
            <div style={{
                width: '350px',
                borderRight: '1px solid #303030',
                padding: '20px',
                overflowY: 'auto',
                backgroundColor: '#161b22'
            }}>
                <Title level={4} style={{ color: '#e6edf3', marginBottom: '20px' }}>
                    剧集结构
                </Title>

                {treeData.length > 0 ? (
                    <Tree
                        treeData={treeData}
                        onSelect={onTreeSelect}
                        selectedKeys={selectedNodeKeys}
                        expandedKeys={state.expandedKeys}
                        onExpand={onTreeExpand}
                        style={{
                            background: 'transparent',
                            color: '#e6edf3'
                        }}
                        className="episode-tree"
                        showIcon={true}
                    />
                ) : (
                    <Empty
                        description="暂无阶段数据"
                        style={{ color: '#8b949e' }}
                    />
                )}
            </div>

            {/* Right: Content Area */}
            <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                backgroundColor: '#0d1117'
            }}>
                {state.selectedStageId && scriptId ? (
                    <StageDetailView
                        scriptId={scriptId}
                        stageId={state.selectedStageId}
                        selectedEpisodeId={state.selectedEpisodeId}
                    />
                ) : (
                    <Empty
                        description="请选择一个阶段开始生成剧集"
                        style={{
                            marginTop: '100px',
                            color: '#8b949e'
                        }}
                    />
                )}
            </div>
        </div>
    );
}; 