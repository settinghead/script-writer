import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Tag, Row, Col, Typography, Alert, Space } from 'antd';
import { InfoCircleOutlined, EyeOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

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

    return (
        <Card
            title={
                <Title level={4} style={{ color: '#fff', margin: 0 }}>
                    大纲生成参数
                </Title>
            }
            style={{ marginBottom: '20px' }}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Source Artifact */}
                <div>
                    <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                        源故事灵感
                    </Text>
                    <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <Title level={5} style={{ margin: '0 0 8px 0', color: '#000' }}>
                                    {sourceArtifact.title || '无标题'}
                                </Title>
                                <Paragraph
                                    ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                                    style={{ margin: '0 0 8px 0', color: '#666' }}
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
                                    style={{ marginLeft: '12px' }}
                                >
                                    查看源头脑风暴
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
                            <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                    总集数
                                </Text>
                                <Text strong style={{ color: '#000' }}>
                                    {totalEpisodes ? `${totalEpisodes} 集` : '未设置'}
                                </Text>
                            </Card>
                        </Col>
                        <Col span={12}>
                            <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                    每集时长
                                </Text>
                                <Text strong style={{ color: '#000' }}>
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
                    <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                            创建时间
                        </Text>
                        <Text strong style={{ color: '#000' }}>
                            {formatDate(createdAt)}
                        </Text>
                    </Card>
                </div>

                {/* Additional Info */}
                <Alert
                    message="参数说明"
                    description="基于选定的故事灵感和集数配置，系统将生成包含标题、类型、角色设定等完整大纲内容。所有生成的内容都可以进行编辑和完善。"
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                />
            </Space>
        </Card>
    );
}; 