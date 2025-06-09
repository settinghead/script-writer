import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// Import new data fetching and state management
import { useProjectData, useEpisodeScriptChecks } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';
import { OutlineStreamingService } from '../services/implementations/OutlineStreamingService';
import { useLLMStreamingWithStore } from '../hooks/useLLMStreamingWithStore';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { apiService } from '../services/apiService';
import type { OutlineSessionData } from '../../server/services/OutlineService';
import type { OutlineSection } from '../services/implementations/OutlineStreamingService';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

// Simple dotted circle component for ungenerated episodes
const DottedCircle: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <span
        style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            border: '1.5px dotted #666',
            borderRadius: '50%',
            ...style
        }}
    />
);

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
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    
    // UI state - both sections expanded by default
    const [activeAccordionKeys, setActiveAccordionKeys] = useState<string[]>(['outline', 'episodes']);
    const [selectedOutlineSection, setSelectedOutlineSection] = useState<string>('');
    const [selectedEpisodeNode, setSelectedEpisodeNode] = useState<string>('');
    
    // Resizable sidebar state
    const [sidebarWidth, setSidebarWidth] = useLocalStorage('projectLayout.sidebarWidth', 400);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartX = useRef(0);
    const startWidth = useRef(0);
    
    // Data fetching using TanStack Query + Zustand
    const { isLoading, error } = useProjectData(projectId!);
    
    // Select data from Zustand store
    const outline = useProjectStore(state => state.projects[projectId!]?.outline);
    const stages = useProjectStore(state => state.projects[projectId!]?.stages || []);
    const episodes = useProjectStore(state => state.projects[projectId!]?.episodes || {});
    const expandedKeys = useProjectStore(state => state.projects[projectId!]?.expandedKeys || []);
    const setExpandedKeys = useProjectStore(state => state.setExpandedKeys);
    const setStageEpisodes = useProjectStore(state => state.setStageEpisodes);
    
    // Outline streaming setup
    const searchParams = new URLSearchParams(location.search);
    const transformId = searchParams.get('transform');
    const streamingService = useMemo(() => new OutlineStreamingService(), []);
    const { 
        status: streamingStatus, 
        isThinking, 
        stop: stopStreaming, 
        error: streamingError 
    } = useLLMStreamingWithStore(streamingService, { 
        transformId: transformId || undefined,
        projectId,
        dataType: 'outline'
    });
    
    // Derived streaming state
    const isStreaming = streamingStatus === 'streaming';
    const isConnecting = !!(streamingStatus === 'idle' && transformId);

    // Handle streaming completion - refetch data when streaming completes
    useEffect(() => {
        if (streamingStatus === 'completed' && projectId) {
            // TanStack Query will automatically refetch the data
            // No manual loading needed thanks to the new architecture
        }
    }, [streamingStatus, projectId]);

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

    // Check for active streaming job on mount
    useEffect(() => {
        if (!transformId && projectId) {
            const checkActiveJob = async () => {
                try {
                    const activeJob = await apiService.checkActiveStreamingJob(projectId);
                    if (activeJob) {
                        navigate(`/projects/${projectId}/outline?transform=${activeJob.transformId}`, { replace: true });
                    }
                } catch (error) {
                    console.log('No active streaming job found');
                }
            };
            checkActiveJob();
        }
    }, [transformId, projectId, navigate]);

    // Handle outline section selection
    const handleOutlineTreeSelect = (selectedKeys: React.Key[]) => {
        const sectionKey = selectedKeys[0] as string;
        if (sectionKey) {
            setSelectedOutlineSection(sectionKey);
                            navigate(`/projects/${projectId}/outline/${sectionKey}`);
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
                const stageData = episodes[stageId];
                const episode = stageData?.episodes.find(ep => ep.episodeNumber.toString() === episodeNumber);
                const hasScript = episode?.hasScript || false;

                if (hasScript) {
                    navigate(`/projects/${projectId}/stages/${stageId}/episodes/${episodeNumber}/script`);
                } else {
                    navigate(`/projects/${projectId}/stages/${stageId}/episodes/${episodeNumber}`);
                }
            }
        } else if (nodeKey) {
            // Stage selected
            navigate(`/projects/${projectId}/stages/${nodeKey}`);
        }
    };

    // Handle accordion panel changes - independent expand/collapse
    const handleAccordionChange = (keys: string | string[]) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        setActiveAccordionKeys(keyArray);
        
        // Optional: Navigate when sections are opened (but sections can stay open independently)
        // No forced navigation - let users control navigation separately
    };

    // Build episode tree data from Zustand store
    const episodeTreeData: DataNode[] = useMemo(() => {
        return stages.map(stage => ({
            key: stage.artifactId,
            title: `第${stage.stageNumber}阶段 (${stage.numberOfEpisodes}集)`,
            icon: <BookOutlined />,
            children: episodes[stage.artifactId]?.episodes.map(episode => ({
                key: `episode-${stage.artifactId}-${episode.episodeNumber}`,
                title: `第${episode.episodeNumber}集: ${episode.title}`,
                icon: episode.hasScript ? <PlayCircleOutlined style={{ color: '#52c41a' }} /> : <DottedCircle />,
                isLeaf: true,
                hasScript: episode.hasScript
            })) || []
        }));
    }, [stages, episodes]);

    // Handle episode tree expansion - load episodes for expanded stages
    const handleEpisodeTreeExpand = (expandedKeys: React.Key[]) => {
        const keyStrings = expandedKeys as string[];
        if (projectId) {
            setExpandedKeys(projectId, keyStrings);
        }
    };

    // Load episodes for expanded stages
    const [expandedStageIds, setExpandedStageIds] = useState<string[]>([]);
    
    useEffect(() => {
        const newExpandedStageIds = expandedKeys.filter(key => 
            !key.includes('episode-') && stages.some(stage => stage.artifactId === key)
        );
        setExpandedStageIds(newExpandedStageIds);
    }, [expandedKeys, stages]);

    // Load episodes for expanded stages using a single effect
    // instead of calling hooks in a loop (which violates Rules of Hooks)
    useEffect(() => {
        if (!projectId || expandedStageIds.length === 0) return;

        const loadEpisodesForStages = async () => {
            for (const stageId of expandedStageIds) {
                try {
                    // Fetch episodes for this stage
                    const result = await fetch(`/api/episodes/stages/${stageId}/latest-generation`, {
                        credentials: 'include'
                    });
                    
                    if (result.ok) {
                        const episodesData = await result.json();
                        const episodes = episodesData.episodes.map((episode: any) => ({
                            ...episode,
                            hasScript: false, // TODO: Check script existence
                        }));

                        const episodeState = {
                            episodes,
                            loading: false,
                            isStreaming: episodesData.status === 'active',
                            sessionData: episodesData,
                        };
                        
                        // Update store with episodes data
                        setStageEpisodes(projectId, stageId, episodeState);
                    } else if (result.status === 404) {
                        // No episodes generated yet
                        const episodeState = {
                            episodes: [],
                            loading: false,
                            isStreaming: false,
                        };
                        setStageEpisodes(projectId, stageId, episodeState);
                    }
                } catch (error) {
                    console.error(`Error loading episodes for stage ${stageId}:`, error);
                }
            }
        };

        loadEpisodesForStages();
    }, [expandedStageIds, projectId, setStageEpisodes]);

    // Handle component updates from outline editing
    const handleOutlineComponentUpdate = (componentType: string, newValue: string, newArtifactId: string) => {
        // This will be handled automatically by the store when outline data changes
        // No manual state updates needed
        console.log('Outline component updated:', { componentType, newValue, newArtifactId });
    };



    // Resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartX.current = e.clientX;
        startWidth.current = sidebarWidth;
        
        // Add global event listeners
        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartX.current;
            const newWidth = Math.max(250, Math.min(800, startWidth.current + deltaX));
            setSidebarWidth(newWidth);
        };
        
        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [sidebarWidth, setSidebarWidth]);

    // Loading state
    if (isLoading && !outline) {
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
    if (error && !outline) {
        return (
            <Alert
                message="加载失败"
                description={error.message}
                type="error"
                showIcon
                style={{ margin: '20px' }}
                action={
                    <Button onClick={() => window.location.reload()} size="small">
                        重试
                    </Button>
                }
            />
        );
    }

    // Not found state
    if (!outline) {
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
        <Layout style={{ 
            height: 'calc(100vh - 160px)', 
            backgroundColor: '#0a0a0a',
            userSelect: isResizing ? 'none' : 'auto'
        }}>
            {/* Left Sidebar - Accordion Navigation */}
            <Sider
                width={sidebarWidth}
                style={{
                    backgroundColor: '#1a1a1a',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'auto',
                    borderRight: 'none' // Remove default border since we have custom resize handle
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #404040',
                    backgroundColor: '#262626',
                    flexShrink: 0
                }}>
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>
                        {outline?.components?.title || '项目详情'}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        点击左侧导航查看详情
                    </Text>
                </div>

                {/* Accordion Navigation */}
                <div style={{ 
                    flex: 1, 
                    overflow: 'auto', 
                    padding: '16px',
                    minHeight: 0
                }}>
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
                                            color: '#fff',
                                            maxHeight: '300px',
                                            overflow: 'auto'
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
                                        expandedKeys={expandedKeys}
                                        onExpand={handleEpisodeTreeExpand}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#fff',
                                            overflow: 'auto'
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

            {/* Resize Handle - positioned between Sider and Content */}
            <div
                onMouseDown={handleResizeStart}
                style={{
                    width: '5px',
                    cursor: 'col-resize',
                    backgroundColor: isResizing ? '#1890ff' : '#404040',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    transition: isResizing ? 'none' : 'background-color 0.2s',
                    flexShrink: 0
                }}
                onMouseEnter={(e) => {
                    if (!isResizing) {
                        e.currentTarget.style.backgroundColor = '#1890ff';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isResizing) {
                        e.currentTarget.style.backgroundColor = '#404040';
                    }
                }}
            >
                <div style={{
                    width: '1px',
                    height: '20px',
                    backgroundColor: '#fff',
                    opacity: isResizing ? 1 : 0.6,
                    transition: isResizing ? 'none' : 'opacity 0.2s'
                }} />
            </div>

            {/* Right Content Area */}
            <Content style={{ flex: 1, overflow: 'auto' }}>
                <Routes>
                    {/* Default route - redirect to outline */}
                    <Route index element={
                        <div style={{ padding: '20px' }}>
                            {outline && (
                                <>
                                    <OutlineParameterSummary
                                        sourceArtifact={outline.sourceArtifact}
                                        ideationRunId={outline.ideationRunId}
                                        totalEpisodes={outline.totalEpisodes}
                                        episodeDuration={outline.episodeDuration}
                                        createdAt={outline.createdAt}
                                    />
                                    <div style={{ marginTop: '20px' }}>
                                        <OutlineResults
                                            sessionId={projectId || ''}
                                            components={outline.components}
                                            status={outline.status}
                                            isStreaming={isStreaming}
                                            isConnecting={isConnecting}
                                            onStopStreaming={stopStreaming}
                                            onComponentUpdate={handleOutlineComponentUpdate}
                                            sourceArtifact={outline.sourceArtifact}
                                            totalEpisodes={outline.totalEpisodes}
                                            episodeDuration={outline.episodeDuration}
                                            createdAt={outline.createdAt}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    } />
                    
                    {/* Outline routes */}
                    <Route path="outline" element={
                        <div style={{ padding: '20px' }}>
                            {outline && (
                                <>
                                    <OutlineParameterSummary
                                        sourceArtifact={outline.sourceArtifact}
                                        ideationRunId={outline.ideationRunId}
                                        totalEpisodes={outline.totalEpisodes}
                                        episodeDuration={outline.episodeDuration}
                                        createdAt={outline.createdAt}
                                    />
                                    <div style={{ marginTop: '20px' }}>
                                        <OutlineResults
                                            sessionId={projectId || ''}
                                            components={outline.components}
                                            status={outline.status}
                                            isStreaming={isStreaming}
                                            isConnecting={isConnecting}
                                            onStopStreaming={stopStreaming}
                                            onComponentUpdate={handleOutlineComponentUpdate}
                                            sourceArtifact={outline.sourceArtifact}
                                            totalEpisodes={outline.totalEpisodes}
                                            episodeDuration={outline.episodeDuration}
                                            createdAt={outline.createdAt}
                                            activeSection={selectedOutlineSection}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    } />
                    
                    <Route path="outline/:section" element={
                        <div style={{ padding: '20px' }}>
                            {outline && (
                                <>
                                    <OutlineParameterSummary
                                        sourceArtifact={outline.sourceArtifact}
                                        ideationRunId={outline.ideationRunId}
                                        totalEpisodes={outline.totalEpisodes}
                                        episodeDuration={outline.episodeDuration}
                                        createdAt={outline.createdAt}
                                    />
                                    <div style={{ marginTop: '20px' }}>
                                        <OutlineResults
                                            sessionId={projectId || ''}
                                            components={outline.components}
                                            status={outline.status}
                                            isStreaming={isStreaming}
                                            isConnecting={isConnecting}
                                            onStopStreaming={stopStreaming}
                                            onComponentUpdate={handleOutlineComponentUpdate}
                                            sourceArtifact={outline.sourceArtifact}
                                            totalEpisodes={outline.totalEpisodes}
                                            episodeDuration={outline.episodeDuration}
                                            createdAt={outline.createdAt}
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
                                <Title level={3} style={{ color: '#fff' }}>选择阶段开始生成每集大纲</Title>
                                <Text type="secondary">
                                    从左侧剧集结构中选择一个阶段来查看或生成剧集内容
                                </Text>
                            </div>
                        </div>
                    } />
                    
                    {/* Stage and episode detail routes */}
                    <Route path="stages/:stageId" element={
                        <StageDetailView />
                    } />
                    <Route path="stages/:stageId/episodes/:episodeId" element={<EpisodeScriptGeneration />} />
                    <Route path="stages/:stageId/episodes/:episodeId/script" element={<ScriptDisplayPage />} />
                </Routes>
            </Content>
        </Layout>
    );
}; 