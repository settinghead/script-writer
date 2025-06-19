import React from 'react';
import { Card, Typography, Spin, Alert, Tag, Space, Empty, Row, Col } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useProjectStreaming } from '../hooks/useProjectStreaming';

const { Title, Paragraph, Text } = Typography;

interface ProjectStreamingDisplayProps {
    projectId: string;
}

const ProjectStreamingDisplay: React.FC<ProjectStreamingDisplayProps> = ({ projectId }) => {
    const { streamingState, isConnected, isConnecting, hasError, reconnect } = useProjectStreaming(projectId);

    const { status, operations, streamingData, error } = streamingState || {};

    const renderConnectionStatus = () => {
        if (hasError) {
            return (
                <Alert
                    message="连接错误"
                    description={error || '无法连接到项目流'}
                    type="error"
                    showIcon
                    action={
                        <button onClick={reconnect}>重新连接</button>
                    }
                />
            );
        }

        if (isConnecting) {
            return (
                <Alert
                    message="正在连接..."
                    description="正在建立项目实时连接"
                    type="info"
                    showIcon
                    icon={<LoadingOutlined />}
                />
            );
        }

        if (isConnected && operations && operations.length > 0) {
            return (
                <Alert
                    message="实时连接已建立"
                    description={`发现 ${operations.length} 个活跃操作`}
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                />
            );
        }

        if (isConnected) {
            return (
                <Alert
                    message="已连接"
                    description="项目暂无活跃操作"
                    type="info"
                    showIcon
                />
            );
        }

        return null;
    };

    const renderOperations = () => {
        if (!operations || operations.length === 0) {
            return null;
        }

        return (
            <Card title="活跃操作" size="small" style={{ marginBottom: '16px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    {operations.map((operation) => (
                        <div key={operation.transformId} style={{ 
                            padding: '8px', 
                            border: '1px solid #d9d9d9', 
                            borderRadius: '4px',
                            background: '#fafafa'
                        }}>
                            <Space>
                                <Tag color={operation.status === 'running' ? 'processing' : 'default'}>
                                    {operation.type}
                                </Tag>
                                <Text type="secondary">{operation.status}</Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {new Date(operation.created_at).toLocaleString()}
                                </Text>
                            </Space>
                        </div>
                    ))}
                </Space>
            </Card>
        );
    };

    const renderStreamingData = () => {
        if (!streamingData || streamingData.length === 0) {
            if (isConnected && operations && operations.length > 0) {
                return (
                    <Card title="生成结果" style={{ marginBottom: '16px' }}>
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Spin size="large" />
                            <div style={{ marginTop: '16px' }}>
                                <Text type="secondary">正在生成创意...</Text>
                            </div>
                        </div>
                    </Card>
                );
            }
            return (
                <Card title="生成结果" style={{ marginBottom: '16px' }}>
                    <Empty 
                        description="暂无生成结果"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </Card>
            );
        }

        return (
            <Card title={`生成结果 (${streamingData.length})`} style={{ marginBottom: '16px' }}>
                <Row gutter={[16, 16]}>
                    {streamingData.map((item, index) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={index}>
                            <Card 
                                size="small" 
                                hoverable
                                style={{ 
                                    height: '100%',
                                    border: '1px solid #d9d9d9'
                                }}
                            >
                                {item.title && (
                                    <Title level={5} style={{ 
                                        marginBottom: '8px',
                                        fontSize: '14px',
                                        lineHeight: '1.4'
                                    }}>
                                        {item.title}
                                    </Title>
                                )}
                                <Paragraph 
                                    style={{ 
                                        fontSize: '12px',
                                        lineHeight: '1.5',
                                        marginBottom: '8px',
                                        color: '#666'
                                    }}
                                    ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
                                >
                                    {item.body || item.text || String(item)}
                                </Paragraph>
                                {item.confidence_score && (
                                    <Tag size="small" color="blue">
                                        置信度: {Math.round(item.confidence_score * 100)}%
                                    </Tag>
                                )}
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Card>
        );
    };

    return (
        <div style={{ padding: '16px' }}>
            <Title level={3}>项目实时流</Title>
            
            {renderConnectionStatus()}
            
            <div style={{ marginTop: '16px' }}>
                {renderOperations()}
                {renderStreamingData()}
            </div>
        </div>
    );
};

export default ProjectStreamingDisplay; 