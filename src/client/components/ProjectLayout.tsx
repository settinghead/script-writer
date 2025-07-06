import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Layout, Typography, Spin, Alert, Space, Button, Card, List, Drawer, Grid, Tabs } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, EyeInvisibleOutlined, MenuOutlined, ApartmentOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useProjectData as useProjectDataHook } from '../hooks/useProjectData';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useProjectStore } from '../stores/projectStore';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import WorkflowVisualization from './WorkflowVisualization';
import ProjectTreeView from './ProjectTreeView';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SingleBrainstormIdeaEditor } from './brainstorm/SingleBrainstormIdeaEditor';
import ProjectBrainstormPage from '../components/brainstorm/ProjectBrainstormPage';
import { OutlineSettingsDisplay } from './OutlineSettingsDisplay';
import { ChroniclesDisplay } from './ChroniclesDisplay';
import ActionItemsSection from './ActionItemsSection';
import { DebugMenu, DebugPanels } from './debug';
import { ProjectCreationForm } from './ProjectCreationForm';
import { BrainstormInputEditor } from './BrainstormInputEditor';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Component to render project content conditionally
const ProjectContentRenderer: React.FC<{ projectId: string }> = ({ projectId }) => {
    const projectData = useProjectData();

    // Check if project has brainstorm input artifacts
    const hasBrainstormInput = useMemo(() => {
        if (!projectData.artifacts || projectData.artifacts.length === 0) {
            return false;
        }

        // Look for brainstorm_tool_input_schema artifacts
        return projectData.artifacts.some(artifact =>
            artifact.type === 'brainstorm_tool_input_schema'
        );
    }, [projectData.artifacts]);

    // Show creation form if no brainstorm input exists
    if (!hasBrainstormInput) {
        return (
            <div style={{ padding: '24px 0' }}>
                <ProjectCreationForm
                    projectId={projectId}
                    onCreated={() => {
                        // Artifact created, component will re-render with new data
                        console.log('Brainstorm input artifact created');
                        // The component will automatically re-render when projectData updates
                    }}
                />
            </div>
        );
    }

    // Show normal project content
    return (
        <>
            {/* Brainstorm Input Editor - shows when artifact exists and is leaf node */}
            <BrainstormInputEditor projectId={projectId} />


            <ProjectBrainstormPage />
            <SingleBrainstormIdeaEditor
                onViewOriginalIdeas={() => {
                    // Scroll to the brainstorm ideas section
                    const brainstormSection = document.getElementById('brainstorm-ideas');
                    if (brainstormSection) {
                        brainstormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }}
            />
            <OutlineSettingsDisplay />

            <ChroniclesDisplay />

            {/* Legacy Support - Show old outline display for backward compatibility */}
            {/* Legacy outline display removed - replaced by outline settings + chronicles */}
        </>
    );
};



const ProjectLayout: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [rightSidebarVisible, setRightSidebarVisible] = useLocalStorage('right-sidebar-visible', true);
    const [rightSidebarWidth, setRightSidebarWidth] = useLocalStorage('right-sidebar-width', 350);
    const [sidebarWidth, setSidebarWidth] = useLocalStorage('sidebar-width', 350);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isResizingRightSidebar, setIsResizingRightSidebar] = useState(false);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [mobileRightDrawerOpen, setMobileRightDrawerOpen] = useState(false);
    const [activeRightTab, setActiveRightTab] = useLocalStorage('right-sidebar-tab', 'tree');

    // Responsive breakpoints
    const screens = useBreakpoint();
    const isMobile = !screens.md; // Mobile when smaller than md breakpoint (768px)



    // Cache the selector to avoid infinite loop warning
    const emptyProject = useMemo(() => ({}), []);
    const project = useProjectStore(useMemo(() => (state: any) => state.projects[projectId!] || emptyProject, [projectId, emptyProject]));
    const { name, loading, error } = project;

    // Fetch project data using our main hook
    useProjectDataHook(projectId!);

    // We'll add the empty project detection inside the ProjectDataProvider

    // Debug: Log when right sidebar is rendered
    useEffect(() => {
        if (!isMobile && rightSidebarVisible) {
            console.log('[ProjectLayout] Right sidebar is visible, WorkflowVisualization should render');
        } else {
            console.log('[ProjectLayout] Right sidebar hidden:', { isMobile, rightSidebarVisible });
        }
    }, [isMobile, rightSidebarVisible]);



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


    // Chat sidebar content component for reuse
    const ChatSidebarContent = () => (
        <ChatSidebarWrapper projectId={projectId!} />
    );

    return (
        <ProjectDataProvider projectId={projectId!}>
            <Layout style={{ height: '100%', overflow: 'hidden', }}>
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

                {/* Mobile Right Drawer with Tabs */}
                {isMobile && (
                    <Drawer
                        title="目录/地图"
                        placement="right"
                        onClose={hideMobileRightDrawer}
                        open={mobileRightDrawerOpen}
                        width={Math.min(320, window.innerWidth * 0.85)}
                        styles={{
                            body: { padding: 0, background: '#1a1a1a' },
                            header: { background: '#1a1a1a', borderBottom: '1px solid #333' }
                        }}
                        closeIcon={<span style={{ color: '#fff' }}>×</span>}
                    >
                        <Tabs
                            activeKey={activeRightTab}
                            onChange={setActiveRightTab}
                            size="small"
                            style={{ height: '100%' }}
                            tabBarStyle={{
                                background: '#1a1a1a',
                                margin: 0,
                                padding: '0 12px'
                            }}
                            items={[
                                {
                                    key: 'tree',
                                    label: (
                                        <Space>
                                            <UnorderedListOutlined />
                                            <span>目录树</span>
                                        </Space>
                                    ),
                                    children: (
                                        <div style={{ padding: '12px' }}>
                                            <ProjectTreeView width={280} />
                                        </div>
                                    )
                                },
                                {
                                    key: 'workflow',
                                    label: (
                                        <Space>
                                            <ApartmentOutlined />
                                            <span>流程图</span>
                                        </Space>
                                    ),
                                    children: (
                                        <div style={{ padding: '12px' }}>
                                            <WorkflowVisualization width={280} />
                                        </div>
                                    )
                                },

                            ]}
                        />
                    </Drawer>
                )}

                <Layout style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    padding: "0"
                }}>

                    {/* Main Content Layout */}
                    <Layout style={{
                        flex: 1,
                        overflow: 'hidden',
                    }}>
                        {/* Breadcrumb and Toggle Buttons Row */}
                        <div style={{
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


                            <DebugMenu
                                isMobile={isMobile}
                                onMobileRightDrawerOpen={showMobileRightDrawer}
                            />
                        </div>

                        {/* Main Content Area */}
                        <Content style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            overflow: 'hidden'
                        }}>
                            {/* Main Content - Always Rendered */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                overflow: 'hidden'
                            }}>
                                {/* Scrollable Content Container */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '12px',
                                    paddingBottom: '24px'
                                }}>
                                    <ProjectContentRenderer projectId={projectId!} />
                                    <Outlet />
                                </div>

                                {/* Sticky Action Items Section */}
                                <ActionItemsSection />
                            </div>

                            {/* Debug Panels Overlay */}
                            <DebugPanels projectId={projectId!} />
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
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 12px 0 12px'
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
                                        <div style={{ flex: 1, paddingTop: '8px' }}>
                                            <Tabs
                                                activeKey={activeRightTab}
                                                onChange={setActiveRightTab}
                                                size="small"
                                                style={{ height: '100%' }}
                                                tabBarStyle={{
                                                    background: '#1a1a1a',
                                                    margin: 0,
                                                    padding: '0 12px'
                                                }}
                                                items={[
                                                    {
                                                        key: 'tree',
                                                        label: (
                                                            <Space>
                                                                <UnorderedListOutlined />
                                                                <span>目录树</span>
                                                            </Space>
                                                        ),
                                                        children: (
                                                            <div style={{ padding: '12px' }}>
                                                                <ProjectTreeView width={rightSidebarWidth - 48} />
                                                            </div>
                                                        )
                                                    },
                                                    {
                                                        key: 'workflow',
                                                        label: (
                                                            <Space>
                                                                <ApartmentOutlined />
                                                                <span>流程图</span>
                                                            </Space>
                                                        ),
                                                        children: (
                                                            <div style={{ padding: '12px' }}>
                                                                <WorkflowVisualization width={rightSidebarWidth - 48} />
                                                            </div>
                                                        )
                                                    },

                                                ]}
                                            />
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