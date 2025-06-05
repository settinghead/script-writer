import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Collapse, Tree, Typography, Button, Space, Alert, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { 
    FileTextOutlined, 
    PlayCircleOutlined, 
    ExportOutlined,
    UserOutlined,
    TagOutlined,
    SettingOutlined,
    BulbOutlined,
    TeamOutlined,
    BookOutlined,
    CaretRightOutlined
} from '@ant-design/icons';

// Import existing components we'll reuse
import { OutlineResults } from './OutlineResults';
import { StageDetailView } from './StageDetailView';
import { EpisodeScriptGeneration } from './EpisodeScriptGeneration';
import { ScriptDisplayPage } from './ScriptDisplayPage';
import { OutlineParameterSummary } from './OutlineParameterSummary';

// Import services and contexts
import { apiService } from '../services/apiService';
import { useEpisodeContext } from '../contexts/EpisodeContext';
import { OutlineStreamingService } from '../services/implementations/OutlineStreamingService';
import { useLLMStreaming } from '../hooks/useLLMStreaming';
import type { OutlineSessionData } from '../../server/services/OutlineService';
import type { OutlineSection } from '../services/implementations/OutlineStreamingService';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

// Define outline section navigation items
const outlineTreeData: DataNode[] = [
    {
        title: '剧本标题',
        key: 'title',
        icon: <FileTextOutlined />,
    },
    {
        title: '剧本类型',
        key: 'genre',
        icon: <TagOutlined />,
    },
    {
        title: '目标受众',
        key: 'target-audience',
        icon: <UserOutlined />,
    },
    {
        title: '产品卖点',
        key: 'selling-points',
        icon: <BulbOutlined />,
    },
    {
        title: '情感爽点',
        key: 'satisfaction-points',
        icon: <BulbOutlined />,
    },
    {
        title: '故事设定',
        key: 'setting',
        icon: <SettingOutlined />,
    },
    {
        title: '角色设定',
        key: 'characters',
        icon: <TeamOutlined />,
    },
    {
        title: '分段故事梗概',
        key: 'synopsis-stages',
        icon: <BookOutlined />,
    },

];

interface ProjectLayoutProps {}

export const ProjectLayout: React.FC<ProjectLayoutProps> = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Episode context for managing episode tree data
    const { state: episodeState, actions: episodeActions } = useEpisodeContext();
    
    // Outline data state
    const [outlineData, setOutlineData] = useState<OutlineSessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    
    // UI state - both sections expanded by default
    const [activeAccordionKeys, setActiveAccordionKeys] = useState<string[]>(['outline', 'episodes']);
    const [selectedOutlineSection, setSelectedOutlineSection] = useState<string>('');
    const [selectedEpisodeNode, setSelectedEpisodeNode] = useState<string>('');
    
    // Outline streaming setup
    const searchParams = new URLSearchParams(location.search);
    const transformId = searchParams.get('transform');
    const streamingService = useMemo(() => new OutlineStreamingService(), []);
    const { 
        status: streamingStatus, 
        items: outlineItems, 
        isThinking, 
        stop: stopStreaming, 
        error: streamingError 
    } = useLLMStreaming(streamingService, { transformId: transformId || undefined });
    
    // Derived streaming state
    const isStreaming = streamingStatus === 'streaming';
    const isConnecting = !!(streamingStatus === 'idle' && transformId);

    // Initialize data when component mounts
    useEffect(() => {
        if (id) {
            loadProjectData(id);
        }
    }, [id]);

    // Update outline data when streaming provides new data
    useEffect(() => {
        if (outlineItems.length > 0) {
            const latestOutline = outlineItems[outlineItems.length - 1];
            updateOutlineComponents(latestOutline);
        }
    }, [outlineItems]);

    // Handle streaming completion
    useEffect(() => {
        if (streamingStatus === 'completed' && id) {
            loadProjectData(id);
        }
    }, [streamingStatus, id]);

    // Set active accordion based on current route (but keep both expanded)
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/outline')) {
            // Extract section if present
            const pathParts = path.split('/');
            const sectionIndex = pathParts.indexOf('outline') + 1;
            if (sectionIndex < pathParts.length) {
                setSelectedOutlineSection(pathParts[sectionIndex]);
            } else {
                setSelectedOutlineSection('');
            }
        }
        // Keep both sections expanded regardless of route
        setActiveAccordionKeys(['outline', 'episodes']);
    }, [location.pathname]);

    const loadProjectData = async (projectId: string) => {
        try {
            setLoading(true);
            setError('');

            // Load outline data
            const data = await apiService.getOutlineSession(projectId);
            console.log('🔍 [DEBUG] Loaded outline data:', data);
            console.log('🔍 [DEBUG] synopsis_stages structure:', data?.components?.synopsis_stages);
            console.log('🔍 [DEBUG] Full components structure:', data?.components);
            console.log('🔍 [DEBUG] Does stages field exist?', data?.components?.stages);
            console.log('🔍 [DEBUG] All component keys:', Object.keys(data?.components || {}));
            if (data?.components?.synopsis_stages) {
                data.components.synopsis_stages.forEach((stage, index) => {
                    console.log(`🔍 [DEBUG] Stage ${index + 1}:`, {
                        numberOfEpisodes: stage.numberOfEpisodes,
                        stageSynopsis: stage.stageSynopsis?.substring(0, 50) + '...',
                        hasNumberOfEpisodes: stage.hasOwnProperty('numberOfEpisodes'),
                        stageKeys: Object.keys(stage)
                    });
                });
            }
            setOutlineData(data);

            // Load episode data
            episodeActions.setScriptId(projectId);
            await episodeActions.loadStages(projectId);

            // Check for active streaming job
            if (!transformId) {
                try {
                    const activeJob = await apiService.checkActiveStreamingJob(projectId);
                    if (activeJob) {
                        navigate(`/projects/${projectId}/outline?transform=${activeJob.transformId}`, { replace: true });
                    }
                } catch (error) {
                    console.log('No active streaming job found');
                }
            }

        } catch (error) {
            console.error('Error loading project data:', error);
            setError('Failed to load project data');
        } finally {
            setLoading(false);
        }
    };

    const updateOutlineComponents = (outline: OutlineSection) => {
        console.log('🔍 [DEBUG] updateOutlineComponents called with:', outline);
        console.log('🔍 [DEBUG] outline.synopsis_stages:', outline.synopsis_stages);
        if (outline.synopsis_stages) {
            outline.synopsis_stages.forEach((stage, index) => {
                console.log(`🔍 [DEBUG] Streaming Stage ${index + 1}:`, {
                    numberOfEpisodes: stage.numberOfEpisodes,
                    hasNumberOfEpisodes: stage.hasOwnProperty('numberOfEpisodes'),
                    stageKeys: Object.keys(stage)
                });
            });
        }
        
        setOutlineData(prev => {
            if (!prev) return prev;

            return {
                ...prev,
                components: {
                    ...prev.components,
                    title: outline.title || prev.components.title,
                    genre: outline.genre || prev.components.genre,
                    target_audience: outline.target_audience || prev.components.target_audience,
                    selling_points: outline.selling_points?.join('\n') || prev.components.selling_points,
                    satisfaction_points: outline.satisfaction_points || prev.components.satisfaction_points,
                    setting: outline.setting?.core_setting_summary || prev.components.setting,
                    synopsis: prev.components.synopsis,
                    synopsis_stages: outline.synopsis_stages || prev.components.synopsis_stages,
                    characters: outline.characters || prev.components.characters
                }
            };
        });
    };

    // Handle outline section selection
    const handleOutlineTreeSelect = (selectedKeys: React.Key[]) => {
        const sectionKey = selectedKeys[0] as string;
        if (sectionKey) {
            setSelectedOutlineSection(sectionKey);
            navigate(`/projects/${id}/outline/${sectionKey}`);
        }
    };

    // Handle episode tree selection
    const handleEpisodeTreeSelect = (selectedKeys: React.Key[]) => {
        const nodeKey = selectedKeys[0] as string;
        setSelectedEpisodeNode(nodeKey);

        if (nodeKey && nodeKey.includes('episode-')) {
            // Episode selected
            const episodePrefix = 'episode-';
            const afterPrefix = nodeKey.substring(episodePrefix.length);
            const lastHyphenIndex = afterPrefix.lastIndexOf('-');

            if (lastHyphenIndex !== -1) {
                const stageId = afterPrefix.substring(0, lastHyphenIndex);
                const episodeNumber = afterPrefix.substring(lastHyphenIndex + 1);

                // Check if script exists for this episode
                const stageData = episodeState.stageEpisodeData[stageId];
                const episode = stageData?.episodes.find(ep => ep.episodeNumber.toString() === episodeNumber);
                const hasScript = episode?.hasScript || false;

                if (hasScript) {
                    navigate(`/projects/${id}/stages/${stageId}/episodes/${episodeNumber}/script`);
                } else {
                    navigate(`/projects/${id}/stages/${stageId}/episodes/${episodeNumber}`);
                }
            }
        } else if (nodeKey) {
            // Stage selected
            navigate(`/projects/${id}/stages/${nodeKey}`);
        }
    };

    // Handle accordion panel changes - independent expand/collapse
    const handleAccordionChange = (keys: string | string[]) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        setActiveAccordionKeys(keyArray);
        
        // Optional: Navigate when sections are opened (but sections can stay open independently)
        // No forced navigation - let users control navigation separately
    };

    // Build episode tree data from context
    const episodeTreeData: DataNode[] = useMemo(() => {
        return episodeState.stages.map(stage => ({
            key: stage.artifactId,
            title: `第${stage.stageNumber}阶段 (${stage.numberOfEpisodes}集)`,
            icon: <BookOutlined />,
            children: episodeState.stageEpisodeData[stage.artifactId]?.episodes.map(episode => ({
                key: `episode-${stage.artifactId}-${episode.episodeNumber}`,
                title: `第${episode.episodeNumber}集: ${episode.title}`,
                icon: episode.hasScript ? <PlayCircleOutlined style={{ color: '#52c41a' }} /> : <PlayCircleOutlined />,
                isLeaf: true,
                hasScript: episode.hasScript
            })) || []
        }));
    }, [episodeState.stages, episodeState.stageEpisodeData]);

    // Handle component updates from outline editing
    const handleOutlineComponentUpdate = (componentType: string, newValue: string, newArtifactId: string) => {
        setOutlineData(prev => {
            if (!prev) return prev;

            let updatedComponents = { ...prev.components };

            if (componentType === 'characters') {
                try {
                    updatedComponents.characters = JSON.parse(newValue);
                } catch {
                    // If parsing fails, keep the current value
                }
            } else {
                updatedComponents = {
                    ...updatedComponents,
                    [componentType]: newValue
                };
            }

            return {
                ...prev,
                components: updatedComponents
            };
        });
    };

    const handleStopStreaming = async () => {
        try {
            stopStreaming();
        } catch (error) {
            console.error('Error stopping streaming:', error);
        }
    };

    // Loading state
    if (loading && !outlineData) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '400px'
            }}>
                <Space>
                    <Spin size="large" />
                    <Text style={{ color: '#fff' }}>加载项目...</Text>
                </Space>
            </div>
        );
    }

    // Error state
    if (error && !outlineData) {
        return (
            <Alert
                message="加载失败"
                description={error}
                type="error"
                showIcon
                style={{ margin: '20px' }}
                action={
                    <Button onClick={() => id && loadProjectData(id)} size="small">
                        重试
                    </Button>
                }
            />
        );
    }

    // Not found state
    if (!outlineData) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Title level={3} style={{ color: '#fff' }}>项目未找到</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
                    请求的项目不存在或已被删除。
                </Text>
                <Button onClick={() => navigate('/ideations')}>
                    返回工作台
                </Button>
            </div>
        );
    }

    return (
        <Layout style={{ height: 'calc(100vh - 160px)', backgroundColor: '#0a0a0a' }}>
            {/* Left Sidebar - Accordion Navigation */}
            <Sider
                width={400}
                style={{
                    backgroundColor: '#1a1a1a',
                    borderRight: '1px solid #404040'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #404040',
                    backgroundColor: '#262626'
                }}>
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>
                        {outlineData.components.title || '项目详情'}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        点击左侧导航查看详情
                    </Text>
                </div>

                {/* Accordion Navigation */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                    <Collapse
                        activeKey={activeAccordionKeys}
                        onChange={handleAccordionChange}
                        ghost
                        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
                        style={{ backgroundColor: 'transparent' }}
                        items={[
                            {
                                key: 'outline',
                                label: '大纲',
                                style: { color: '#fff' },
                                children: (
                                    <Tree
                                        treeData={outlineTreeData}
                                        onSelect={handleOutlineTreeSelect}
                                        selectedKeys={selectedOutlineSection ? [selectedOutlineSection] : []}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#fff'
                                        }}
                                        className="outline-tree"
                                        showIcon
                                        blockNode
                                    />
                                )
                            },
                            {
                                key: 'episodes',
                                label: '剧集结构',
                                style: { color: '#fff' },
                                children: (
                                    <Tree
                                        treeData={episodeTreeData}
                                        onSelect={handleEpisodeTreeSelect}
                                        selectedKeys={selectedEpisodeNode ? [selectedEpisodeNode] : []}
                                        expandedKeys={episodeState.expandedKeys}
                                        onExpand={episodeActions.setExpandedKeys}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#fff'
                                        }}
                                        className="episode-tree"
                                        showIcon
                                        blockNode
                                    />
                                )
                            }
                        ]}
                    />
                </div>
            </Sider>

            {/* Right Content Area */}
            <Content style={{ flex: 1, overflow: 'auto' }}>
                <Routes>
                    {/* Default route - redirect to outline */}
                    <Route index element={
                        <div style={{ padding: '20px' }}>
                            {outlineData && (
                                <>
                                    <OutlineParameterSummary
                                        sourceArtifact={outlineData.sourceArtifact}
                                        ideationRunId={outlineData.ideationRunId}
                                        totalEpisodes={outlineData.totalEpisodes}
                                        episodeDuration={outlineData.episodeDuration}
                                        createdAt={outlineData.createdAt}
                                    />
                                    <div style={{ marginTop: '20px' }}>
                                        <OutlineResults
                                            sessionId={id || ''}
                                            components={outlineData.components}
                                            status={outlineData.status}
                                            isStreaming={isStreaming}
                                            isConnecting={isConnecting}
                                            onStopStreaming={handleStopStreaming}
                                            onComponentUpdate={handleOutlineComponentUpdate}
                                            sourceArtifact={outlineData.sourceArtifact}
                                            totalEpisodes={outlineData.totalEpisodes}
                                            episodeDuration={outlineData.episodeDuration}
                                            createdAt={outlineData.createdAt}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    } />
                    
                    {/* Outline routes */}
                    <Route path="outline" element={
                        <div style={{ padding: '20px' }}>
                            {outlineData && (
                                <>
                                    <OutlineParameterSummary
                                        sourceArtifact={outlineData.sourceArtifact}
                                        ideationRunId={outlineData.ideationRunId}
                                        totalEpisodes={outlineData.totalEpisodes}
                                        episodeDuration={outlineData.episodeDuration}
                                        createdAt={outlineData.createdAt}
                                    />
                                    <div style={{ marginTop: '20px' }}>
                                        <OutlineResults
                                            sessionId={id || ''}
                                            components={outlineData.components}
                                            status={outlineData.status}
                                            isStreaming={isStreaming}
                                            isConnecting={isConnecting}
                                            onStopStreaming={handleStopStreaming}
                                            onComponentUpdate={handleOutlineComponentUpdate}
                                            sourceArtifact={outlineData.sourceArtifact}
                                            totalEpisodes={outlineData.totalEpisodes}
                                            episodeDuration={outlineData.episodeDuration}
                                            createdAt={outlineData.createdAt}
                                            activeSection={selectedOutlineSection}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    } />
                    
                    <Route path="outline/:section" element={
                        <div style={{ padding: '20px' }}>
                            {outlineData && (
                                <>
                                    <OutlineParameterSummary
                                        sourceArtifact={outlineData.sourceArtifact}
                                        ideationRunId={outlineData.ideationRunId}
                                        totalEpisodes={outlineData.totalEpisodes}
                                        episodeDuration={outlineData.episodeDuration}
                                        createdAt={outlineData.createdAt}
                                    />
                                    <div style={{ marginTop: '20px' }}>
                                        <OutlineResults
                                            sessionId={id || ''}
                                            components={outlineData.components}
                                            status={outlineData.status}
                                            isStreaming={isStreaming}
                                            isConnecting={isConnecting}
                                            onStopStreaming={handleStopStreaming}
                                            onComponentUpdate={handleOutlineComponentUpdate}
                                            sourceArtifact={outlineData.sourceArtifact}
                                            totalEpisodes={outlineData.totalEpisodes}
                                            episodeDuration={outlineData.episodeDuration}
                                            createdAt={outlineData.createdAt}
                                            activeSection={selectedOutlineSection}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    } />
                    
                    {/* Episode routes */}
                    <Route path="episodes" element={
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            height: '100%',
                            padding: '40px'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <PlayCircleOutlined style={{ fontSize: '64px', color: '#666', marginBottom: '16px' }} />
                                <Title level={3} style={{ color: '#fff' }}>选择阶段开始生成剧集</Title>
                                <Text type="secondary">
                                    从左侧剧集结构中选择一个阶段来查看或生成剧集内容
                                </Text>
                            </div>
                        </div>
                    } />
                    
                    {/* Stage and episode detail routes */}
                    <Route path="stages/:stageId" element={
                        <StageDetailView 
                            stages={episodeState.stages}
                            stageEpisodeData={episodeState.stageEpisodeData}
                            selectedStageId={selectedEpisodeNode}
                        />
                    } />
                    <Route path="stages/:stageId/episodes/:episodeId" element={<EpisodeScriptGeneration />} />
                    <Route path="stages/:stageId/episodes/:episodeId/script" element={<ScriptDisplayPage />} />
                </Routes>
            </Content>
        </Layout>
    );
}; 