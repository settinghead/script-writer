import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, Breadcrumb, Typography, Spin, Alert, Space, Button, Card, List, Drawer, Grid } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, EyeInvisibleOutlined, NodeIndexOutlined, MessageOutlined, FileTextOutlined, MenuOutlined } from '@ant-design/icons';
import { useProjectData } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import WorkflowVisualization from './WorkflowVisualization';
import RawGraphVisualization from './RawGraphVisualization';
import RawChatMessages from './RawChatMessages';
import RawAgentContext from './RawAgentContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useChosenBrainstormIdea } from '../hooks/useChosenBrainstormIdea';
import { SingleBrainstormIdeaEditor } from './brainstorm/SingleBrainstormIdeaEditor';
import ProjectBrainstormPage from '../components/brainstorm/ProjectBrainstormPage';
import { OutlineDisplay } from './OutlineDisplay';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;



const ProjectLayout: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [rightSidebarVisible, setRightSidebarVisible] = useLocalStorage('right-sidebar-visible', true);
    const [rightSidebarWidth, setRightSidebarWidth] = useLocalStorage('right-sidebar-width', 350);
    const [sidebarWidth, setSidebarWidth] = useLocalStorage('sidebar-width', 350);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isResizingRightSidebar, setIsResizingRightSidebar] = useState(false);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [mobileRightDrawerOpen, setMobileRightDrawerOpen] = useState(false);

    // Responsive breakpoints
    const screens = useBreakpoint();
    const isMobile = !screens.md; // Mobile when smaller than md breakpoint (768px)

    // Check for chosen brainstorm idea
    const { chosenIdea, isLoading: chosenIdeaLoading } = useChosenBrainstormIdea();

    // Debug logging
    console.log('[ProjectLayout] Chosen idea state:', { chosenIdea, chosenIdeaLoading });

    // Debug toggles
    const showRawGraph = searchParams.get('raw-graph') === '1';
    const showRawChat = searchParams.get('raw-chat') === '1';
    const showRawContext = searchParams.get('raw-context') === '1';

    // Cache the selector to avoid infinite loop warning
    const emptyProject = useMemo(() => ({}), []);
    const project = useProjectStore(useMemo(() => (state: any) => state.projects[projectId!] || emptyProject, [projectId, emptyProject]));
    const { name, description, loading, error } = project;

    // Fetch project data using our main hook
    useProjectData(projectId!);

    // Debug: Log when right sidebar is rendered
    useEffect(() => {
        if (!isMobile && rightSidebarVisible) {
            console.log('[ProjectLayout] Right sidebar is visible, WorkflowVisualization should render');
        } else {
            console.log('[ProjectLayout] Right sidebar hidden:', { isMobile, rightSidebarVisible });
        }
    }, [isMobile, rightSidebarVisible]);

    // Debug toggle handlers
    const toggleRawGraph = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showRawGraph) {
            newSearchParams.delete('raw-graph');
        } else {
            newSearchParams.set('raw-graph', '1');
            // Clear other debug views
            newSearchParams.delete('raw-chat');
            newSearchParams.delete('raw-context');
        }
        setSearchParams(newSearchParams);
    }, [showRawGraph, searchParams, setSearchParams]);

    const toggleRawChat = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showRawChat) {
            newSearchParams.delete('raw-chat');
        } else {
            newSearchParams.set('raw-chat', '1');
            // Clear other debug views
            newSearchParams.delete('raw-graph');
            newSearchParams.delete('raw-context');
        }
        setSearchParams(newSearchParams);
    }, [showRawChat, searchParams, setSearchParams]);

    const toggleRawContext = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showRawContext) {
            newSearchParams.delete('raw-context');
        } else {
            newSearchParams.set('raw-context', '1');
            // Clear other debug views
            newSearchParams.delete('raw-graph');
            newSearchParams.delete('raw-chat');
        }
        setSearchParams(newSearchParams);
    }, [showRawContext, searchParams, setSearchParams]);

    // Resize handlers for right sidebar
    const handleRightSidebarMouseDown = (e: React.MouseEvent) => {
        setIsResizingRightSidebar(true);
        e.preventDefault();
    };

    const handleRightSidebarMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingRightSidebar) return;

        const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
        setRightSidebarWidth(newWidth);
    }, [isResizingRightSidebar]);

    const handleRightSidebarMouseUp = useCallback(() => {
        setIsResizingRightSidebar(false);
    }, []);

    // Resize handlers for sidebar
    const handleSidebarMouseDown = (e: React.MouseEvent) => {
        setIsResizingSidebar(true);
        e.preventDefault();
    };

    const handleSidebarMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingSidebar) return;

        const newWidth = Math.max(250, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
    }, [isResizingSidebar]);

    const handleSidebarMouseUp = useCallback(() => {
        setIsResizingSidebar(false);
    }, []);

    useEffect(() => {
        if (isResizingRightSidebar) {
            document.addEventListener('mousemove', handleRightSidebarMouseMove);
            document.addEventListener('mouseup', handleRightSidebarMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleRightSidebarMouseMove);
            document.removeEventListener('mouseup', handleRightSidebarMouseUp);
            if (!isResizingSidebar) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        }

        return () => {
            document.removeEventListener('mousemove', handleRightSidebarMouseMove);
            document.removeEventListener('mouseup', handleRightSidebarMouseUp);
            if (!isResizingSidebar) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, [isResizingRightSidebar, handleRightSidebarMouseMove, handleRightSidebarMouseUp, isResizingSidebar]);

    useEffect(() => {
        if (isResizingSidebar) {
            document.addEventListener('mousemove', handleSidebarMouseMove);
            document.addEventListener('mouseup', handleSidebarMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleSidebarMouseMove);
            document.removeEventListener('mouseup', handleSidebarMouseUp);
            if (!isResizingRightSidebar) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        }

        return () => {
            document.removeEventListener('mousemove', handleSidebarMouseMove);
            document.removeEventListener('mouseup', handleSidebarMouseUp);
            if (!isResizingRightSidebar) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, [isResizingSidebar, handleSidebarMouseMove, handleSidebarMouseUp, isResizingRightSidebar]);

    const handleGoBack = () => {
        navigate('/');
    };

    // Mobile drawer handlers
    const showMobileDrawer = () => {
        setMobileDrawerOpen(true);
    };

    const hideMobileDrawer = () => {
        setMobileDrawerOpen(false);
    };

    const showMobileRightDrawer = () => {
        setMobileRightDrawerOpen(true);
    };

    const hideMobileRightDrawer = () => {
        setMobileRightDrawerOpen(false);
    };

    if (loading && !name) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
                <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Space direction="vertical" align="center">
                        <Spin size="large" />
                        <Text type="secondary">加载项目信息...</Text>
                    </Space>
                </Content>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
                <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', maxWidth: 400 }}>
                        <Alert
                            message="加载失败"
                            description={error}
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                        <Space>
                            <Button onClick={handleGoBack}>
                                返回首页
                            </Button>
                            <Button type="primary" onClick={() => window.location.reload()}>
                                重新加载
                            </Button>
                        </Space>
                    </div>
                </Content>
            </Layout>
        );
    }

    const breadcrumbItems = [
        {
            title: (
                <span onClick={handleGoBack} style={{ cursor: 'pointer', color: '#1890ff' }}>
                    <HomeOutlined /> 首页
                </span>
            ),
        },
        {
            title: (
                <Space>
                    <ProjectOutlined />
                    {name || '未命名项目'}
                </Space>
            ),
        }
    ];

    // Determine layout based on debug modes
    const isDebugMode = showRawGraph || showRawChat || showRawContext;

    // Chat sidebar content component for reuse
    const ChatSidebarContent = () => (
        <ChatSidebarWrapper projectId={projectId!} />
    );

    return (
        <ProjectDataProvider projectId={projectId!}>
            <Layout style={{ height: '100%', overflow: 'hidden' }}>
                {/* Mobile Drawer for Chat */}
                {isMobile && (
                    <Drawer
                        title="聊天"
                        placement="left"
                        onClose={hideMobileDrawer}
                        open={mobileDrawerOpen}
                        width={Math.min(320, window.innerWidth * 0.85)}
                        styles={{
                            body: { padding: 0, background: '#1a1a1a' },
                            header: { background: '#1a1a1a', borderBottom: '1px solid #333' }
                        }}
                        closeIcon={<span style={{ color: '#fff' }}>×</span>}
                    >
                        <ChatSidebarContent />
                    </Drawer>
                )}

                {/* Desktop Sidebar */}
                {!isMobile && (
                    <div style={{ position: 'relative', display: 'flex' }}>
                        <Sider
                            width={sidebarWidth}
                            style={{
                                background: '#1a1a1a',
                                height: '100%',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                            theme="dark"
                        >
                            <ChatSidebarContent />
                        </Sider>

                        {/* Sidebar Resize Handle - Desktop Only */}
                        <div
                            onMouseDown={handleSidebarMouseDown}
                            style={{
                                width: '6px',
                                background: isResizingSidebar ? '#1890ff' : 'transparent',
                                cursor: 'ew-resize',
                                position: 'relative',
                                borderRight: '1px solid #333',
                                transition: 'background 0.2s ease-in-out',
                                height: '100vh',
                                flexShrink: 0
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '4px',
                                    height: '40px',
                                    background: isResizingSidebar ? '#1890ff' : '#666',
                                    borderRadius: '2px',
                                    transition: 'background 0.2s ease-in-out',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Mobile Right Drawer for Workflow */}
                {isMobile && (
                    <Drawer
                        title="目录/地图"
                        placement="right"
                        onClose={hideMobileRightDrawer}
                        open={mobileRightDrawerOpen}
                        width={Math.min(320, window.innerWidth * 0.85)}
                        styles={{
                            body: { padding: '12px', background: '#1a1a1a' },
                            header: { background: '#1a1a1a', borderBottom: '1px solid #333' }
                        }}
                        closeIcon={<span style={{ color: '#fff' }}>×</span>}
                    >
                        <WorkflowVisualization width={280} />
                    </Drawer>
                )}

                <Layout style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row'
                }}>
                    {/* Breadcrumb and Toggle Buttons Row */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: isMobile ? 0 : sidebarWidth + 6,
                        right: !isMobile && rightSidebarVisible ? rightSidebarWidth + 6 : 0,
                        zIndex: 100,
                        padding: isMobile ? '8px 12px' : '12px 16px',
                        borderBottom: '1px solid #333',
                        background: '#1a1a1a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        height: '60px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Mobile Menu Button */}
                            {isMobile && (
                                <Button
                                    type="text"
                                    icon={<MenuOutlined />}
                                    onClick={showMobileDrawer}
                                    style={{ color: '#1890ff' }}
                                    size="large"
                                />
                            )}
                            <Breadcrumb items={breadcrumbItems} />
                        </div>

                        <Space size={isMobile ? 'small' : 'middle'}>
                            {isMobile && (
                                <Button
                                    type="text"
                                    icon={<NodeIndexOutlined />}
                                    onClick={showMobileRightDrawer}
                                    style={{ color: '#1890ff' }}
                                    size="small"
                                />
                            )}
                            <Button
                                type="text"
                                icon={<NodeIndexOutlined />}
                                onClick={toggleRawGraph}
                                style={{ color: showRawGraph ? '#52c41a' : '#1890ff' }}
                                size={isMobile ? 'small' : 'middle'}
                            >
                                {isMobile ? '' : (showRawGraph ? '关闭图谱' : '打开图谱')}
                            </Button>
                            <Button
                                type="text"
                                icon={<MessageOutlined />}
                                onClick={toggleRawChat}
                                style={{ color: showRawChat ? '#52c41a' : '#1890ff' }}
                                size={isMobile ? 'small' : 'middle'}
                            >
                                {isMobile ? '' : (showRawChat ? '关闭内部对话' : '打开内部对话')}
                            </Button>
                            <Button
                                type="text"
                                icon={<FileTextOutlined />}
                                onClick={toggleRawContext}
                                style={{ color: showRawContext ? '#52c41a' : '#1890ff' }}
                                size={isMobile ? 'small' : 'middle'}
                            >
                                {isMobile ? '' : (showRawContext ? '关闭上下文' : '打开上下文')}
                            </Button>
                        </Space>
                    </div>

                    {/* Main Content Layout */}
                    <Layout style={{
                        flex: 1,
                        overflow: 'hidden',
                        paddingTop: '60px' // Account for fixed header
                    }}>
                        {/* Main Content Area */}
                        <Content style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            overflow: 'hidden'
                        }}>
                            {/* Conditional Content */}
                            {showRawGraph ? (
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <RawGraphVisualization />
                                </div>
                            ) : showRawChat ? (
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <RawChatMessages projectId={projectId!} />
                                </div>
                            ) : showRawContext ? (
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <RawAgentContext projectId={projectId!} />
                                </div>
                            ) : (
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '12px'
                                }}>
                                    <ProjectBrainstormPage />
                                    {/* Conditionally render SingleBrainstormIdeaEditor if there's a chosen idea */}
                                    {chosenIdea && !chosenIdeaLoading && (
                                        <SingleBrainstormIdeaEditor
                                            originalArtifactId={chosenIdea.originalArtifactId}
                                            originalArtifactPath={chosenIdea.originalArtifactPath}
                                            editableArtifactId={chosenIdea.editableArtifactId}
                                            index={chosenIdea.index}
                                            isFromCollection={chosenIdea.isFromCollection}
                                            onViewOriginalIdeas={() => {
                                                // Scroll to the brainstorm ideas section
                                                const brainstormSection = document.getElementById('brainstorm-ideas');
                                                if (brainstormSection) {
                                                    brainstormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }
                                            }}
                                        />
                                    )}

                                    <OutlineDisplay
                                    />

                                    <Outlet />
                                </div>
                            )}
                        </Content>
                    </Layout>

                    {/* Right Sidebar - Desktop Only */}
                    {!isMobile && (
                        <div style={{ position: 'relative', display: 'flex' }}>
                            {/* Right Sidebar Resize Handle */}
                            <div
                                onMouseDown={handleRightSidebarMouseDown}
                                style={{
                                    width: '6px',
                                    background: isResizingRightSidebar ? '#1890ff' : 'transparent',
                                    cursor: 'ew-resize',
                                    position: 'relative',
                                    borderLeft: '1px solid #333',
                                    transition: 'background 0.2s ease-in-out',
                                    height: '100vh',
                                    flexShrink: 0
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: '4px',
                                        height: '40px',
                                        background: isResizingRightSidebar ? '#1890ff' : '#666',
                                        borderRadius: '2px',
                                        transition: 'background 0.2s ease-in-out',
                                    }}
                                />
                            </div>

                            {/* Right Sidebar Content */}
                            {rightSidebarVisible ? (
                                <Sider
                                    width={rightSidebarWidth}
                                    style={{
                                        background: '#1a1a1a',
                                        height: '100vh',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}
                                    theme="dark"
                                >
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '12px'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '12px',
                                            paddingBottom: '8px',
                                            borderBottom: '1px solid #333'
                                        }}>
                                            <Title level={5} style={{ margin: 0, color: '#fff' }}>
                                                目录/地图
                                            </Title>
                                            <Button
                                                type="text"
                                                icon={<EyeInvisibleOutlined />}
                                                onClick={() => setRightSidebarVisible(false)}
                                                style={{ color: '#1890ff' }}
                                                size="small"
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <WorkflowVisualization width={rightSidebarWidth - 24} />
                                        </div>
                                    </div>
                                </Sider>
                            ) : (
                                /* Collapsed Right Sidebar Button */
                                <div style={{
                                    width: '24px',
                                    height: '100vh',
                                    background: '#1a1a1a',
                                    borderLeft: '1px solid #333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease-in-out'
                                }} onClick={() => setRightSidebarVisible(true)}>
                                    <div style={{
                                        writingMode: 'vertical-rl',
                                        textOrientation: 'mixed',
                                        color: '#1890ff',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        userSelect: 'none'
                                    }}>
                                        ﹤ 目录
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Layout>
            </Layout>
        </ProjectDataProvider>
    );
};

export default ProjectLayout; 