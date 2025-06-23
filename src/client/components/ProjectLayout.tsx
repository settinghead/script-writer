import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Layout, Breadcrumb, Typography, Spin, Alert, Space, Button, Card, List } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useProjectData } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import WorkflowVisualization from './WorkflowVisualization';
import { useLocalStorage } from '../hooks/useLocalStorage';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface ProjectData {
    id: string;
    name: string;
    description: string;
    currentPhase: string;
    status: string;
    platform?: string;
    genre?: string;
    createdAt: string;
    updatedAt: string;
}

const ProjectLayout: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [showWorkflow, setShowWorkflow] = useLocalStorage('workflow-visible', true);
    const [workflowHeight, setWorkflowHeight] = useLocalStorage('workflow-height', 200);
    const [isResizing, setIsResizing] = useState(false);

    // Cache the selector to avoid infinite loop warning
    const emptyProject = useMemo(() => ({}), []);
    const project = useProjectStore(useMemo(() => (state: any) => state.projects[projectId!] || emptyProject, [projectId, emptyProject]));
    const { name, description, loading, error } = project;

    // Fetch project data using our main hook
    useProjectData(projectId!);

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

    // Note: Removed useProjectStreaming - now using Electric SQL in individual pages

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
                <Content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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

                        {/* Note: Streaming UI removed - now handled by individual pages with Electric SQL */}
                    </div>
                </Content>
            </Layout>
        </ProjectDataProvider>
    );
};

export default ProjectLayout; 