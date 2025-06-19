import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Layout, Breadcrumb, Typography, Spin, Alert, Space, Button, Card, List } from 'antd';
import { HomeOutlined, ProjectOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useProjectData } from '../hooks/useProjectData';
import { useProjectStore } from '../stores/projectStore';

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
    
    // Cache the selector to avoid infinite loop warning
    const project = useProjectStore(useMemo(() => (state: any) => state.projects[projectId!] || {}, [projectId]));
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
        <Layout style={{ height: '100%', overflow: 'hidden' }}>
            <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
                <div style={{ padding: '16px' }}>
                    <Title level={4}>{name || 'Project'}</Title>
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }}>
                        {description || 'No description available.'}
                    </Typography.Paragraph>
                </div>
                {/* Future navigation will go here */}
            </Sider>
            <Content style={{ padding: '24px', overflowY: 'auto' }}>
                <Outlet />
                
                {/* Note: Streaming UI removed - now handled by individual pages with Electric SQL */}
            </Content>
        </Layout>
    );
};

export default ProjectLayout; 