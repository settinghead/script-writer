import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Layout, Breadcrumb, Typography, Spin, Alert, Space, Button } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Content } = Layout;
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
    const [projectData, setProjectData] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) return;

        const fetchProjectData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/projects/${projectId}`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        setError('项目不存在');
                    } else {
                        throw new Error(`Failed to fetch project: ${response.status}`);
                    }
                    return;
                }

                const data = await response.json();
                setProjectData(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching project data:', err);
                setError(err instanceof Error ? err.message : '获取项目信息失败');
            } finally {
                setLoading(false);
            }
        };

        fetchProjectData();
    }, [projectId]);

    const handleGoBack = () => {
        navigate('/');
    };

    if (loading) {
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
                    {projectData?.name || '未命名项目'}
                </Space>
            ),
        }
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
            <Content style={{ padding: '16px 24px' }}>
                {/* Header with breadcrumb and project info */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                        <Button 
                            icon={<ArrowLeftOutlined />} 
                            onClick={handleGoBack}
                            type="text"
                            style={{ color: '#666' }}
                        />
                        <Breadcrumb items={breadcrumbItems} />
                    </div>
                    
                    {projectData && (
                        <div style={{ marginLeft: '44px' }}>
                            <Title level={3} style={{ margin: 0, color: '#fff' }}>
                                {projectData.name}
                            </Title>
                            {projectData.description && (
                                <Text type="secondary" style={{ display: 'block', marginTop: '4px' }}>
                                    {projectData.description}
                                </Text>
                            )}
                            {(projectData.platform || projectData.genre) && (
                                <Space style={{ marginTop: '8px' }}>
                                    {projectData.platform && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            平台: {projectData.platform}
                                        </Text>
                                    )}
                                    {projectData.genre && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            类型: {projectData.genre}
                                        </Text>
                                    )}
                                </Space>
                            )}
                        </div>
                    )}
                </div>

                {/* Project content */}
                <div style={{ marginLeft: '44px' }}>
                    <Outlet />
                </div>
            </Content>
        </Layout>
    );
};

export default ProjectLayout; 