import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Tree, Empty, Typography, Spin, Alert, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { StageDetailView } from './StageDetailView';

const { Title } = Typography;

interface StageNode extends DataNode {
    stageNumber: number;
    artifactId: string;
}

// Real API service - replace the mock
const apiService = {
    async getStageArtifacts(outlineSessionId: string): Promise<Array<{
        artifactId: string;
        stageNumber: number;
        numberOfEpisodes: number;
        stageSynopsis: string;
        outlineSessionId: string;
    }>> {
        try {
            const response = await fetch(`/api/episodes/outlines/${outlineSessionId}/stages`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to fetch stage artifacts');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching stage artifacts:', error);
            throw error;
        }
    }
};

export const EpisodeGenerationPage: React.FC = () => {
    const { scriptId, stageId: urlStageId } = useParams<{ scriptId: string; stageId?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session');
    const transformId = searchParams.get('transform');

    const [selectedStageId, setSelectedStageId] = useState<string | null>(urlStageId || null);
    const [treeData, setTreeData] = useState<StageNode[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (scriptId) {
            loadOutlineData();
        }
    }, [scriptId]);

    // Update selected stage when URL changes
    useEffect(() => {
        if (urlStageId && urlStageId !== selectedStageId) {
            setSelectedStageId(urlStageId);
        }
    }, [urlStageId]);

    const loadOutlineData = async () => {
        if (!scriptId) return;

        try {
            setLoading(true);
            setError(null);

            // Load stage artifacts for this outline session
            const stages = await apiService.getStageArtifacts(scriptId);

            if (!stages || stages.length === 0) {
                setError('该大纲还没有生成分阶段内容，请返回重新生成大纲。');
                return;
            }

            // Build tree nodes from stage artifacts
            const treeNodes: StageNode[] = stages.map(stage => ({
                key: stage.artifactId,
                title: `第${stage.stageNumber}阶段 (${stage.numberOfEpisodes}集)`,
                isLeaf: false,
                children: [], // Will be populated when episodes are generated
                stageNumber: stage.stageNumber,
                artifactId: stage.artifactId
            }));

            setTreeData(treeNodes);

            // Auto-select first stage if none selected
            if (!selectedStageId && treeNodes.length > 0) {
                setSelectedStageId(treeNodes[0].artifactId);
            }

        } catch (error) {
            console.error('Error loading outline data:', error);
            setError('加载大纲数据失败，请重试。');
            message.error('加载大纲数据失败');
        } finally {
            setLoading(false);
        }
    };

    const onTreeSelect = (selectedKeys: React.Key[], info: any) => {
        const nodeKey = selectedKeys[0] as string;

        if (nodeKey && nodeKey.includes('episode-')) {
            // Navigate to episode detail
            const [stageId, episodeId] = parseEpisodeKey(nodeKey);
            navigate(`/scripts/${scriptId}/stages/${stageId}/episodes/${episodeId}`);
        } else if (nodeKey) {
            // Stage selected
            setSelectedStageId(nodeKey);
        }
    };

    const onTreeExpand = (expandedKeys: React.Key[]) => {
        setExpandedKeys(expandedKeys as string[]);
    };

    const parseEpisodeKey = (episodeKey: string): [string, string] => {
        // Format: "episode-{stageId}-{episodeId}"
        const parts = episodeKey.split('-');
        if (parts.length >= 3) {
            return [parts[1], parts[2]];
        }
        throw new Error('Invalid episode key format');
    };

    const startStreamingEpisodes = () => {
        // The URL navigation is already handled in StageDetailView's handleStartGeneration
        // This callback is just to notify that generation has started
        console.log('[EpisodeGenerationPage] Episode generation started for stage:', selectedStageId);
    };

    if (loading) {
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

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Alert
                    message="加载失败"
                    description={error}
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

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            backgroundColor: '#0d1117'
        }}>
            {/* Left: Tree View */}
            <div style={{
                width: '300px',
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
                        selectedKeys={selectedStageId ? [selectedStageId] : []}
                        expandedKeys={expandedKeys}
                        onExpand={onTreeExpand}
                        style={{
                            background: 'transparent',
                            color: '#e6edf3'
                        }}
                        className="episode-tree"
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
                {selectedStageId && scriptId ? (
                    <StageDetailView
                        scriptId={scriptId}
                        stageId={selectedStageId}
                        onGenerateStart={startStreamingEpisodes}
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