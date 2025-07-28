import React from 'react';
import { Layout, Button, Space, Typography, Result } from 'antd';
import { HomeOutlined} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

interface ProjectNotFoundPageProps {
    projectId: string;
    error?: Error;
}

const ProjectNotFoundPage: React.FC<ProjectNotFoundPageProps> = ({ projectId, error }) => {
    const navigate = useNavigate();

    const handleGoHome = () => {
        navigate('/projects');
    };

    const isAccessDenied = (error as any)?.status === 403 || (error as any)?.code === 'ACCESS_DENIED';
    const isNotFound = (error as any)?.status === 404 || (error as any)?.code === 'PROJECT_NOT_FOUND';

    return (
        <Layout style={{ minHeight: '100vh', background: '#0a0a0a' }}>
            <Content style={{
                padding: '24px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#0a0a0a'
            }}>
                <div style={{ textAlign: 'center', maxWidth: 500 }}>
                    <Result
                        status={isAccessDenied ? "403" : "404"}
                        title={
                            <span style={{ color: '#ffffff' }}>
                                {isAccessDenied ? "访问被拒绝" : "项目不存在"}
                            </span>
                        }
                        subTitle={
                            <span style={{ color: '#8c8c8c' }}>
                                {isAccessDenied
                                    ? "您没有权限访问此项目，请联系项目所有者获取访问权限。"
                                    : "项目不存在或已被删除，请检查项目ID是否正确。"
                                }
                            </span>
                        }
                        extra={
                            <Space direction="vertical" size="middle">
                                <div style={{ color: '#666', fontSize: '14px' }}>
                                    项目ID: <code style={{
                                        background: '#1a1a1a',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        color: '#1890ff'
                                    }}>{projectId}</code>
                                </div>
                                {error && (
                                    <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '8px' }}>
                                        错误详情: {error.message}
                                    </div>
                                )}
                                <Button
                                    type="primary"
                                    icon={<HomeOutlined />}
                                    onClick={handleGoHome}
                                    size="large"
                                >
                                    返回项目列表
                                </Button>
                            </Space>
                        }
                        style={{
                            background: 'transparent'
                        }}
                    />
                </div>
            </Content>
        </Layout>
    );
};

export default ProjectNotFoundPage; 