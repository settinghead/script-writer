import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, Breadcrumb, Typography, Spin, Alert, Space, Button, Card, List } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, EyeInvisibleOutlined, NodeIndexOutlined, MessageOutlined, FileTextOutlined } from '@ant-design/icons';
import { useProjectData } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import WorkflowVisualization from './WorkflowVisualization';
import RawGraphVisualization from './RawGraphVisualization';
import RawChatMessages from './RawChatMessages';
import RawAgentContext from './RawAgentContext';
import { useLocalStorage } from '../hooks/useLocalStorage';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;



const ProjectLayout: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showWorkflow, setShowWorkflow] = useLocalStorage('workflow-visible', true);
    const [workflowHeight, setWorkflowHeight] = useLocalStorage('workflow-height', 200);
    const [isResizing, setIsResizing] = useState(false);

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

    // Resize handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return;

        const container = document.querySelector('.workflow-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const newHeight = Math.max(150, Math.min(400, e.clientY - rect.top));
        setWorkflowHeight(newHeight);
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    const handleGoBack = () => {
        navigate('/');
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

    return (
        <ProjectDataProvider projectId={projectId!}>
            <Layout style={{ height: '100%', overflow: 'hidden' }}>
                <Sider
                    width={350}
                    style={{
                        background: '#1a1a1a',
                        borderRight: '1px solid #333',
                        height: '100%',
                        overflow: 'hidden'
                    }}
                    theme="dark"
                >
                    <ChatSidebarWrapper projectId={projectId!} />
                </Sider>

                <Layout style={{ flex: 1 }}>
                    {/* Breadcrumb and Toggle Buttons Row */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #333',
                        background: '#1a1a1a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Breadcrumb items={breadcrumbItems} />
                        <Space>
                            <Button
                                type="text"
                                icon={<NodeIndexOutlined />}
                                onClick={toggleRawGraph}
                                style={{ color: showRawGraph ? '#52c41a' : '#1890ff' }}
                            >
                                {showRawGraph ? '关闭图谱' : '打开图谱'}
                            </Button>
                            <Button
                                type="text"
                                icon={<MessageOutlined />}
                                onClick={toggleRawChat}
                                style={{ color: showRawChat ? '#52c41a' : '#1890ff' }}
                            >
                                {showRawChat ? '关闭内部对话' : '打开内部对话'}
                            </Button>
                            <Button
                                type="text"
                                icon={<FileTextOutlined />}
                                onClick={toggleRawContext}
                                style={{ color: showRawContext ? '#52c41a' : '#1890ff' }}
                            >
                                {showRawContext ? '关闭上下文' : '打开上下文'}
                            </Button>
                        </Space>
                    </div>

                    {/* Main Content Layout */}
                    <Layout style={{ flex: 1 }}>
                        {/* Main Content Area */}
                        <Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                                <>
                                    {/* Resizable Workflow Visualization Section at Top */}
                                    <div
                                        className="workflow-container"
                                        style={{
                                            flexShrink: 0,
                                            padding: '0px',
                                            borderBottom: showWorkflow ? '1px solid #333' : 'none',
                                            transition: showWorkflow ? 'none' : 'border-bottom 0.3s ease-in-out',
                                            position: 'relative'
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: showWorkflow ? `${workflowHeight}px` : '0px',
                                                overflow: 'hidden',
                                                transition: showWorkflow ? 'none' : 'height 0.3s ease-in-out, opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
                                                opacity: showWorkflow ? 1 : 0,
                                                transform: showWorkflow ? 'translateY(0)' : 'translateY(-10px)',
                                                marginBottom: showWorkflow ? '0px' : '0px',
                                            }}
                                        >
                                            <WorkflowVisualization height={workflowHeight} />
                                        </div>

                                        {/* Resize Handle */}
                                        {showWorkflow && (
                                            <div
                                                onMouseDown={handleMouseDown}
                                                style={{
                                                    height: '6px',
                                                    background: isResizing ? '#1890ff' : 'transparent',
                                                    cursor: 'ns-resize',
                                                    position: 'relative',
                                                    transition: 'background 0.2s ease-in-out',
                                                    borderTop: '1px solid #333',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: '40px',
                                                        height: '4px',
                                                        background: isResizing ? '#1890ff' : '#666',
                                                        borderRadius: '2px',
                                                        transition: 'background 0.2s ease-in-out',
                                                    }}
                                                />
                                            </div>
                                        )}

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            padding: '8px 0',
                                            background: '#1a1a1a'
                                        }}>
                                            <Button
                                                type="text"
                                                icon={showWorkflow ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                                onClick={() => setShowWorkflow(!showWorkflow)}
                                                style={{ color: '#1890ff' }}
                                                size="small"
                                            >
                                                {showWorkflow ? '隐藏工作流' : '显示工作流'}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Scrollable Content Area Below */}
                                    <div style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        padding: '12px'
                                    }}>
                                        <Outlet />
                                    </div>
                                </>
                            )}
                        </Content>
                    </Layout>
                </Layout>
            </Layout>
        </ProjectDataProvider>
    );
};

export default ProjectLayout; 