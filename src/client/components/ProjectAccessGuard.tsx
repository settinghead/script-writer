import React from 'react';
import { Layout, Spin, Typography, Space } from 'antd';
import { useProjectData } from '../hooks/useProjectData';
import ProjectNotFoundPage from './ProjectNotFoundPage';

const { Content } = Layout;
const { Text } = Typography;

interface ProjectAccessGuardProps {
    projectId: string;
    children: React.ReactNode;
}

/**
 * ProjectAccessGuard validates project access before rendering children.
 * It prevents the full UI from loading when there are access issues.
 */
const ProjectAccessGuard: React.FC<ProjectAccessGuardProps> = ({ projectId, children }) => {
    const { isLoading, error } = useProjectData(projectId);

    // Show loading state while checking access
    if (isLoading) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
                <Content style={{
                    padding: '24px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Space direction="vertical" align="center">
                        <Spin size="large" />
                        <Text type="secondary">验证项目访问权限...</Text>
                    </Space>
                </Content>
            </Layout>
        );
    }

    // Show error page for access issues
    if (error) {
        const errorObj = error as any;

        // Check if this is a project access error (404 or 403)
        if (errorObj.status === 404 || errorObj.status === 403 ||
            errorObj.code === 'PROJECT_NOT_FOUND' || errorObj.code === 'ACCESS_DENIED') {
            return <ProjectNotFoundPage projectId={projectId} error={error} />;
        }

        // For other errors, show a generic error message
        return (
            <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
                <Content style={{
                    padding: '24px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <div style={{ textAlign: 'center', maxWidth: 400 }}>
                        <Space direction="vertical" size="large">
                            <div style={{ color: '#ff4d4f', fontSize: '16px' }}>
                                加载项目时出错
                            </div>
                            <div style={{ color: '#8c8c8c', fontSize: '14px' }}>
                                {error.message}
                            </div>
                            <div style={{ color: '#666', fontSize: '12px' }}>
                                项目ID: <code style={{
                                    background: '#1a1a1a',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    color: '#1890ff'
                                }}>{projectId}</code>
                            </div>
                        </Space>
                    </div>
                </Content>
            </Layout>
        );
    }

    // Access validated, render children
    return <>{children}</>;
};

export default ProjectAccessGuard; 