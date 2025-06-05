import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Tag, Row, Col, Typography, Alert, Space, Collapse } from 'antd';
import { InfoCircleOutlined, EyeOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface OutlineParameterSummaryProps {
    sourceArtifact: {
        id: string;
        text: string;
        title?: string;
        type: string;
    };
    ideationRunId?: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    createdAt: string;
}

export const OutlineParameterSummary: React.FC<OutlineParameterSummaryProps> = ({
    sourceArtifact,
    ideationRunId,
    totalEpisodes,
    episodeDuration,
    createdAt
}) => {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(true);

    const handleViewSource = () => {
        if (ideationRunId) {
            navigate(`/ideation/${ideationRunId}`);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTypeDisplayName = (type: string) => {
        switch (type) {
            case 'brainstorm_idea':
                return '头脑风暴灵感';
            case 'user_input':
                return '用户输入';
            default:
                return type;
        }
    };

    const getSummaryText = () => {
        const episodes = totalEpisodes ? `${totalEpisodes}集` : '未设置';
        const duration = episodeDuration ? `${episodeDuration}分钟` : '未设置';
        const sourceTitle = sourceArtifact.title || '无标题';

        return `基于"${sourceTitle}" · ${episodes} · 每集${duration}`;
    };

    return (
        <Card
            style={{
                marginBottom: '20px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #404040'
            }}
            styles={{
                header: {
                    backgroundColor: '#1f1f1f',
                    borderBottom: '1px solid #404040'
                },
                body: { backgroundColor: '#2a2a2a', padding: isCollapsed ? '12px 24px' : '24px' }
            }}
        >
            <div style={{ cursor: 'pointer' }} onClick={() => setIsCollapsed(!isCollapsed)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isCollapsed ? (
                            <RightOutlined style={{ color: '#888', fontSize: '12px' }} />
                        ) : (
                            <DownOutlined style={{ color: '#888', fontSize: '12px' }} />
                        )}
                        <Title level={5} style={{ color: '#fff', margin: 0 }}>
                            大纲生成参数
                        </Title>
                    </div>

                    {isCollapsed && (
                        <Text style={{ color: '#b0b0b0', fontSize: '14px' }}>
                            {getSummaryText()}
                        </Text>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div style={{ marginTop: '16px' }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        {/* Source Artifact */}
                        <div>
                            <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                源故事灵感
                            </Text>
                            <Card
                                size="small"
                                style={{
                                    backgroundColor: '#1f1f1f',
                                    border: '1px solid #404040'
                                }}
                                styles={{ body: { backgroundColor: '#1f1f1f' } }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <Title level={5} style={{ margin: '0 0 8px 0', color: '#fff' }}>
                                            {sourceArtifact.title || '无标题'}
                                        </Title>
                                        <Paragraph
                                            ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                                            style={{ margin: '0 0 8px 0', color: '#b0b0b0' }}
                                        >
                                            {sourceArtifact.text}
                                        </Paragraph>
                                        <Tag color="blue" size="small">
                                            {getTypeDisplayName(sourceArtifact.type)}
                                        </Tag>
                                    </div>
                                    {ideationRunId && (
                                        <Button
                                            type="link"
                                            size="small"
                                            icon={<EyeOutlined />}
                                            onClick={handleViewSource}
                                            style={{ marginLeft: '12px', color: '#1890ff' }}
                                        >
                                            查看原灵感组
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Configuration Parameters */}
                        <div>
                            <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                配置参数
                            </Text>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card
                                        size="small"
                                        style={{
                                            backgroundColor: '#1f1f1f',
                                            border: '1px solid #404040',
                                            textAlign: 'center'
                                        }}
                                        styles={{ body: { backgroundColor: '#1f1f1f', padding: '12px' } }}
                                    >
                                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#888' }}>
                                            总集数
                                        </Text>
                                        <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                                            {totalEpisodes ? `${totalEpisodes} 集` : '未设置'}
                                        </Text>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        size="small"
                                        style={{
                                            backgroundColor: '#1f1f1f',
                                            border: '1px solid #404040',
                                            textAlign: 'center'
                                        }}
                                        styles={{ body: { backgroundColor: '#1f1f1f', padding: '12px' } }}
                                    >
                                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#888' }}>
                                            每集时长
                                        </Text>
                                        <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                                            {episodeDuration ? `${episodeDuration} 分钟` : '未设置'}
                                        </Text>
                                    </Card>
                                </Col>
                            </Row>
                        </div>

                        {/* Metadata */}
                        <div>
                            <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                创建信息
                            </Text>
                            <Card
                                size="small"
                                style={{
                                    backgroundColor: '#1f1f1f',
                                    border: '1px solid #404040'
                                }}
                                styles={{ body: { backgroundColor: '#1f1f1f', padding: '12px' } }}
                            >
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#888' }}>
                                    创建时间
                                </Text>
                                <Text strong style={{ color: '#fff' }}>
                                    {formatDate(createdAt)}
                                </Text>
                            </Card>
                        </div>

                    </Space>
                </div>
            )}
        </Card>
    );
}; 