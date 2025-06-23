import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Layout, Breadcrumb, Typography, Spin, Alert, Space, Button, Card, List } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useProjectData } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import { ChatSidebarWrapper } from './chat/ChatSidebarWrapper';
import WorkflowVisualization from './WorkflowVisualization';

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
    const [showWorkflow, setShowWorkflow] = useState(true);

    // Cache the selector to avoid infinite loop warning
    const emptyProject = useMemo(() => ({}), []);
    const project = useProjectStore(useMemo(() => (state: any) => state.projects[projectId!] || emptyProject, [projectId, emptyProject]));
    const { name, description, loading, error } = project;

    // Fetch project data using our main hook
    useProjectData(projectId!);

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
                <Content style={{ padding: '24px', overflowY: 'auto' }}>
                    {/* Workflow Visualization Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                        }}>
                            <Title level={4} style={{ margin: 0, color: '#fff' }}>
                                工作流程图
                            </Title>
                            <Button
                                type="text"
                                icon={showWorkflow ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                onClick={() => setShowWorkflow(!showWorkflow)}
                                style={{ color: '#1890ff' }}
                            >
                                {showWorkflow ? '隐藏' : '显示'}
                            </Button>
                        </div>

                        <div
                            style={{
                                height: showWorkflow ? '220px' : '0px',
                                overflow: 'hidden',
                                transition: 'height 0.3s ease-in-out',
                                opacity: showWorkflow ? 1 : 0,
                                transform: showWorkflow ? 'translateY(0)' : 'translateY(-10px)',
                                transitionProperty: 'height, opacity, transform',
                                transitionDuration: '0.3s',
                                transitionTimingFunction: 'ease-in-out',
                            }}
                        >
                            <WorkflowVisualization height={200} />
                        </div>
                    </div>

                    <Outlet />

                    {/* Note: Streaming UI removed - now handled by individual pages with Electric SQL */}
                </Content>
            </Layout>
        </ProjectDataProvider>
    );
};

export default ProjectLayout; 