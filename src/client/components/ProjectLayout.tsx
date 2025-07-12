import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Layout, Typography, Space, Button, Drawer, Grid, Tabs, Alert, Spin } from 'antd';
import { HomeOutlined, ProjectOutlined, EyeInvisibleOutlined, ApartmentOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useProjectStore } from '../stores/projectStore';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import WorkflowVisualization from './WorkflowVisualization';
import ProjectTreeView from './ProjectTreeView';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useScrollPosition } from '../hooks/useScrollPosition';
import { ActionItemsSection } from './ActionItemsSection';
import { DebugMenu, DebugPanels } from './debug';
import { ProjectCreationForm } from './ProjectCreationForm';
import { UnifiedDisplayRenderer } from './UnifiedDisplayRenderer';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Component to render project content conditionally
const ProjectContentRenderer: React.FC<{ projectId: string; scrollContainerRef: React.RefObject<HTMLDivElement | null> }> = ({ projectId, scrollContainerRef }) => {
    const projectData = useProjectData();

    // Scroll position preservation
    const { triggerRestore } = useScrollPosition(scrollContainerRef, {
        key: `project-${projectId}`,
        restoreDelay: 200,
        maxRetries: 15,
        retryInterval: 300,
        debug: false
    });

    // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
    // Check if project has brainstorm input artifacts or brainstorm ideas
    const hasBrainstormInput = useMemo(() => {
        if (!Array.isArray(projectData.artifacts) || projectData.artifacts.length === 0) {
            return false;
        }

        // Look for brainstorm_input_params artifacts OR brainstorm idea artifacts
        return projectData.artifacts.some((artifact) =>
            artifact.schema_type === 'brainstorm_input_params' ||
            artifact.schema_type === 'brainstorm_idea' ||
            artifact.schema_type === 'brainstorm_collection'
        );
    }, [projectData.artifacts]);

    // Check if project has brainstorm collections/results
    const hasBrainstormResults = useMemo(() => {
        if (!Array.isArray(projectData.artifacts) || projectData.artifacts.length === 0) {
            return false;
        }

        // Look for brainstorm collections or brainstorm ideas
        const collections = projectData.getBrainstormCollections();

        return collections.length > 0;
    }, [projectData.artifacts, projectData.getBrainstormCollections]);

    // Compute unified workflow state - ALWAYS call this hook
    const workflowState = useMemo(() => {
        if (projectData.isLoading || projectData.isError) {
            return null;
        }

        return computeUnifiedWorkflowState(projectData, projectId);
    }, [projectData, projectId]);

    // Trigger scroll restoration when async content is loaded
    useEffect(() => {
        if (!projectData.isLoading && workflowState && hasBrainstormInput) {
            // Content is ready, trigger scroll restoration
            const timer = setTimeout(() => {
                triggerRestore();
            }, 500); // Give content time to render

            return () => clearTimeout(timer);
        }
    }, [projectData.isLoading, workflowState, hasBrainstormInput, triggerRestore]);

    // NOW we can do conditional rendering after all hooks are called

    // Show creation form if no brainstorm input exists
    if (!hasBrainstormInput) {
        return (
            <div style={{ padding: '24px 0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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

    // Show loading state
    if (projectData.isLoading || !workflowState) {
        return (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">加载项目数据...</Text>
                </div>
            </div>
        );
    }

    // Show error state
    if (projectData.isError) {
        return (
            <div style={{ padding: '24px 0' }}>
                <Alert
                    message="加载失败"
                    description="无法加载项目数据，请刷新页面重试"
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    // Render using unified system
    return (
        <UnifiedDisplayRenderer displayComponents={workflowState.displayComponents} />
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

    // Ref for the main content scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Responsive breakpoints
    const screens = useBreakpoint();
    const isMobile = !screens.md; // Mobile when smaller than md breakpoint (768px)



    // Cache the selector to avoid infinite loop warning
    const emptyProject = useMemo(() => ({}), []);
    const project = useProjectStore(useMemo(() => (state: any) => state.projects[projectId!] || emptyProject, [projectId, emptyProject]));
    const { name, loading, error } = project;


    // We'll add the empty project detection inside the ProjectDataProvider

    // Debug: Log when right sidebar is rendered
    useEffect(() => {
        if (!isMobile && rightSidebarVisible) {

        } else {

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

    // Error handling is now done by ProjectAccessGuard
    // We can assume project access is valid if we reach this point

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
                            <div
                                ref={scrollContainerRef}
                                className="content-area-inset"
                                style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                }}
                            >
                                <ProjectContentRenderer projectId={projectId!} scrollContainerRef={scrollContainerRef} />
                                <Outlet />
                            </div>

                            {/* Sticky Action Items Section */}
                            <ActionItemsSection projectId={projectId!} />
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
    );
};

export default ProjectLayout; 