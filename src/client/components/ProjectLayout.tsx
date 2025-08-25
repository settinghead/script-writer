import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Outlet, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, Typography, Space, Button, Drawer, Grid, Tabs, Alert, Spin } from 'antd';
import { EyeInvisibleOutlined, ApartmentOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { ScrollSyncProvider } from '../contexts/ScrollSyncContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import RawGraphVisualization from './RawGraphVisualization'; // Replace WorkflowVisualization
import ProjectTreeView from './ProjectTreeView';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useScrollPosition } from '../hooks/useScrollPosition';
import { ActionItemsSection } from './ActionItemsSection';
import { DebugMenu, DebugPanels } from './debug';
import { ProjectCreationForm } from './ProjectCreationForm';
import { UnifiedDisplayRenderer } from './UnifiedDisplayRenderer';
import { ExportButton } from './ExportButton';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';
import { PatchReviewModal } from './PatchReviewModal';

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
    // Check if project has brainstorm input jsondocs or brainstorm ideas
    const hasBrainstormInput = useMemo(() => {
        if (!Array.isArray(projectData.jsondocs) || projectData.jsondocs.length === 0) {
            return false;
        }

        // Look for brainstorm_input_params jsondocs OR brainstorm idea jsondocs
        return projectData.jsondocs.some((jsondoc) =>
            jsondoc.schema_type === 'brainstorm_input_params' ||
            jsondoc.schema_type === '灵感创意' ||
            jsondoc.schema_type === 'brainstorm_collection'
        );
    }, [projectData.jsondocs]);


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
                        // Jsondoc created, component will re-render with new data
                        console.log('Brainstorm input jsondoc created');
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

// Mobile drawer for chat sidebar
const MobileChatDrawer: React.FC<{
    open: boolean;
    onClose: () => void;
    projectId: string;
}> = ({ open, onClose, projectId }) => {
    return (
        <Drawer
            title="聊天"
            placement="left"
            onClose={onClose}
            open={open}
            width={Math.min(320, window.innerWidth * 0.85)}
            styles={{
                body: { padding: 0, background: '#1a1a1a' },
                header: { background: '#1a1a1a', borderBottom: '1px solid #333' }
            }}
            closeIcon={<span style={{ color: '#fff' }}>×</span>}
        >
            <ChatSidebarWrapper projectId={projectId} />
        </Drawer>
    );
};

// Desktop sidebar with resize handle
const DesktopSidebar: React.FC<{
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
    isResizing: boolean;
    projectId: string;
}> = ({ width, onResizeStart, isResizing, projectId }) => {
    return (
        <div style={{ position: 'relative', display: 'flex' }}>
            <Sider
                width={width}
                style={{
                    background: '#1a1a1a',
                    height: '100%',
                    overflow: 'hidden',
                    position: 'relative'
                }}
                theme="dark"
            >
                <ChatSidebarWrapper projectId={projectId} />
            </Sider>

            {/* Sidebar Resize Handle */}
            <div
                onMouseDown={onResizeStart}
                style={{
                    width: '6px',
                    background: isResizing ? '#1890ff' : 'transparent',
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
                        background: isResizing ? '#1890ff' : '#666',
                        borderRadius: '2px',
                        transition: 'background 0.2s ease-in-out',
                    }}
                />
            </div>
        </div>
    );
};

// Mobile drawer for right sidebar with tabs
const MobileRightDrawer: React.FC<{
    open: boolean;
    onClose: () => void;
    activeTab: string;
    onTabChange: (key: string) => void;
}> = ({ open, onClose, activeTab, onTabChange }) => {
    return (
        <Drawer
            title="目录/地图"
            placement="right"
            onClose={onClose}
            open={open}
            width={Math.min(320, window.innerWidth * 0.85)}
            styles={{
                body: { padding: 0, background: '#1a1a1a' },
                header: { background: '#1a1a1a', borderBottom: '1px solid #333' }
            }}
            closeIcon={<span style={{ color: '#fff' }}>×</span>}
        >
            <Tabs
                activeKey={activeTab}
                onChange={onTabChange}
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
                            <div style={{
                                padding: '12px',
                                height: 'calc(100vh - 150px)', // Leave space for drawer header and other content
                                overflow: 'auto' // Let ProjectTreeView handle its own scrolling
                            }}>
                                <ProjectTreeView width={280} />
                            </div>
                        )
                    },

                ]}
            />
        </Drawer>
    );
};

// Desktop right sidebar with tabs and resize handle
const DesktopRightSidebar: React.FC<{
    visible: boolean;
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
    isResizing: boolean;
    onToggleVisibility: () => void;
    activeTab: string;
    onTabChange: (key: string) => void;
}> = ({ visible, width, onResizeStart, isResizing, onToggleVisibility, activeTab, onTabChange }) => {
    return (
        <div style={{ position: 'relative', display: 'flex' }}>
            {/* Right Sidebar Resize Handle */}
            <div
                onMouseDown={onResizeStart}
                style={{
                    width: '6px',
                    background: isResizing ? '#1890ff' : 'transparent',
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
                        background: isResizing ? '#1890ff' : '#666',
                        borderRadius: '2px',
                        transition: 'background 0.2s ease-in-out',
                    }}
                />
            </div>

            {/* Right Sidebar Content */}
            {visible ? (
                <Sider
                    width={width}
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
                                onClick={onToggleVisibility}
                                style={{ color: '#1890ff' }}
                                size="small"
                            />
                        </div>
                        <div style={{ flex: 1, paddingTop: '8px' }}>
                            <Tabs
                                activeKey={activeTab}
                                onChange={onTabChange}
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
                                            <div style={{
                                                padding: '12px',
                                                height: 'calc(100vh - 150px)', // Leave space for tabs and other content
                                                overflow: 'auto' // Let ProjectTreeView handle its own scrolling
                                            }}>
                                                <ProjectTreeView width={width - 48} />
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
                                                <RawGraphVisualization />
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
                }} onClick={onToggleVisibility}>
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
    );
};

// Header with breadcrumb and debug menu
const ProjectHeader: React.FC<{
    projectId: string;
    isMobile: boolean;
    sidebarWidth: number;
    rightSidebarVisible: boolean;
    rightSidebarWidth: number;
    onMobileRightDrawerOpen: () => void;
}> = ({ projectId, isMobile, sidebarWidth, rightSidebarVisible, rightSidebarWidth, onMobileRightDrawerOpen }) => {
    // On mobile, avoid rendering a fixed-height wrapper; just mount modals
    if (isMobile) {
        return (
            <>
                {/* Keep settings modal mounted for URL-triggered open */}
                <ProjectSettingsModal projectId={projectId} />
            </>
        );
    }

    // Desktop header with debug menu and export actions
    return (
        <div style={{
            top: 0,
            left: sidebarWidth + 6,
            right: rightSidebarVisible ? rightSidebarWidth + 6 : 0,
            zIndex: 100,
            padding: '12px 16px',
            borderBottom: '1px solid #333',
            background: '#1a1a1a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '60px'
        }}>
            <DebugMenu />
            <ExportButton projectId={projectId} />
            {/* Project settings modal is controlled via URL param (?projectSettings=1) */}
            <ProjectSettingsModal projectId={projectId} />
        </div>
    );
};

// Main content area with scrollable content and action items
const MainContentArea: React.FC<{
    projectId: string;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    isMobile: boolean;
}> = ({ projectId, scrollContainerRef, isMobile }) => {
    return (
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
                overflow: 'hidden',
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
                    <ProjectContentRenderer projectId={projectId} scrollContainerRef={scrollContainerRef} />
                    <Outlet />
                    <div
                        style={{
                            marginTop: isMobile ? "12px" : "10vh",
                            marginBottom: isMobile ? "8px" : "20px",
                            textAlign: "center",
                            color: "#888",
                            fontStyle: "italic",
                            userSelect: "none",
                            fontSize: "12px"
                        }}
                    >
                        - 到底了 -
                    </div>
                </div>

                {/* Sticky Action Items Section */}
                <ActionItemsSection projectId={projectId} />
            </div>

            {/* Debug Panels Overlay */}
            <DebugPanels projectId={projectId} />
        </Content>
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
    const [searchParams, setSearchParams] = useSearchParams();


    // Debug: Log when right sidebar is rendered
    useEffect(() => {
        if (!isMobile && rightSidebarVisible) {
            // Right sidebar is visible
        } else {
            // Right sidebar is hidden or mobile
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

    // Open right drawer on mobile via URL param (?rightDrawer=1) and then clear the param
    useEffect(() => {
        if (isMobile && searchParams.get('rightDrawer') === '1') {
            setMobileRightDrawerOpen(true);
            const next = new URLSearchParams(searchParams);
            next.delete('rightDrawer');
            setSearchParams(next, { replace: true });
        }
    }, [isMobile, searchParams, setSearchParams]);

    return (
        <ScrollSyncProvider>
            <Layout style={{ height: '100%', overflow: 'hidden' }}>
                {/* Mobile Drawer for Chat */}
                {isMobile && (
                    <MobileChatDrawer
                        open={mobileDrawerOpen}
                        onClose={hideMobileDrawer}
                        projectId={projectId!}
                    />
                )}

                {/* Desktop Sidebar */}
                {!isMobile && (
                    <DesktopSidebar
                        width={sidebarWidth}
                        onResizeStart={handleSidebarMouseDown}
                        isResizing={isResizingSidebar}
                        projectId={projectId!}
                    />
                )}

                {/* Mobile Right Drawer with Tabs */}
                {isMobile && (
                    <MobileRightDrawer
                        open={mobileRightDrawerOpen}
                        onClose={hideMobileRightDrawer}
                        activeTab={activeRightTab}
                        onTabChange={setActiveRightTab}
                    />
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
                        {projectId && (
                            <ProjectHeader
                                projectId={projectId}
                                isMobile={isMobile}
                                sidebarWidth={sidebarWidth}
                                rightSidebarVisible={rightSidebarVisible}
                                rightSidebarWidth={rightSidebarWidth}
                                onMobileRightDrawerOpen={showMobileRightDrawer}
                            />
                        )}

                        {/* Main Content Area */}
                        <MainContentArea
                            projectId={projectId!}
                            scrollContainerRef={scrollContainerRef}
                            isMobile={isMobile}
                        />
                    </Layout>

                    {/* Right Sidebar - Desktop Only */}
                    {!isMobile && (
                        <DesktopRightSidebar
                            visible={rightSidebarVisible}
                            width={rightSidebarWidth}
                            onResizeStart={handleRightSidebarMouseDown}
                            isResizing={isResizingRightSidebar}
                            onToggleVisibility={() => setRightSidebarVisible(!rightSidebarVisible)}
                            activeTab={activeRightTab}
                            onTabChange={setActiveRightTab}
                        />
                    )}
                </Layout>

                {/* Patch Review Modal - Shows when there are pending patches */}
                {projectId && <PatchReviewModal projectId={projectId} />}

                {/* Debug: Electric SQL real-time updates */}
                {/* {projectId && <ElectricSQLDebugger projectId={projectId} />} */}
            </Layout>
        </ScrollSyncProvider>
    );
};

export default ProjectLayout; 