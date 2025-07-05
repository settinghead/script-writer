import React, { useMemo } from 'react';
import { Card, Typography, Space, Tag, Divider, Collapse, List } from 'antd';
import { HeartOutlined, TeamOutlined, BulbOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ChroniclesOutput, ChroniclesStage } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Text, Paragraph, Title } = Typography;
const { Panel } = Collapse;

interface ChroniclesDisplayProps {
}

export const ChroniclesDisplay: React.FC<ChroniclesDisplayProps> = ({
}) => {
    const projectData = useProjectData()

    // Get chronicles artifacts
    const chroniclesArtifacts = useMemo(() => {
        return projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'chronicles_schema' &&
            artifact.data
        );
    }, [projectData.artifacts]);

    // Parse chronicles data
    const chroniclesData = useMemo(() => {
        return chroniclesArtifacts.map(artifact => {
            try {
                return JSON.parse(artifact.data) as ChroniclesOutput;
            } catch (error) {
                console.warn('Failed to parse chronicles data:', error);
                return null;
            }
        }).filter(chronicles => chronicles !== null) as ChroniclesOutput[];
    }, [chroniclesArtifacts]);

    const chronicles = useMemo(() => {
        if (chroniclesData?.length > 1) {
            return "multiple-chronicles-error" as const;
        }
        return chroniclesData?.[0] ?? null;
    }, [chroniclesData]);

    if (chronicles === "multiple-chronicles-error") {
        return (
            <Card style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343' }}>
                <Text type="danger">错误：发现多个时间顺序大纲</Text>
            </Card>
        );
    }

    if (!chronicles || !chronicles.stages || chronicles.stages.length === 0) {
        return null;
    }

    const renderStageCard = (stage: ChroniclesStage, index: number) => {
        return (
            <Card
                key={index}
                style={{
                    backgroundColor: '#262626',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}
                styles={{ body: { padding: '20px' } }}
            >
                {/* Stage Header */}
                <div style={{ marginBottom: '16px' }}>
                    <Space align="center" style={{ marginBottom: '8px' }}>
                        <Tag color="blue" icon={<ClockCircleOutlined />}>
                            第 {index + 1} 阶段
                        </Tag>
                    </Space>
                    <Title level={4} style={{ color: '#1890ff', margin: 0 }}>
                        {stage.title}
                    </Title>
                </div>

                {/* Stage Synopsis */}
                <div style={{ marginBottom: '16px' }}>
                    <Paragraph style={{ color: '#fff', lineHeight: 1.6, margin: 0 }}>
                        {stage.stageSynopsis}
                    </Paragraph>
                </div>

                {/* Core Event */}
                <div style={{ marginBottom: '16px' }}>
                    <Space align="center" style={{ marginBottom: '8px' }}>
                        <ThunderboltOutlined style={{ color: '#faad14' }} />
                        <Text strong style={{ color: '#faad14' }}>核心事件</Text>
                    </Space>
                    <Paragraph style={{ color: '#fff', lineHeight: 1.6, margin: 0, paddingLeft: '20px' }}>
                        {stage.event}
                    </Paragraph>
                </div>

                {/* Expandable Details */}
                <Collapse
                    ghost
                    size="small"
                    style={{ backgroundColor: 'transparent' }}
                    expandIconPosition="end"
                >
                    <Panel
                        header={
                            <Space>
                                <Text style={{ color: '#8c8c8c' }}>详细信息</Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    ({(stage.emotionArcs?.length || 0) + (stage.relationshipDevelopments?.length || 0) + (stage.insights?.length || 0)} 项)
                                </Text>
                            </Space>
                        }
                        key="details"
                        style={{ backgroundColor: 'transparent' }}
                    >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            {/* Emotion Arcs */}
                            {stage.emotionArcs && stage.emotionArcs.length > 0 && (
                                <div>
                                    <Space align="center" style={{ marginBottom: '8px' }}>
                                        <HeartOutlined style={{ color: '#f759ab' }} />
                                        <Text strong style={{ color: '#f759ab' }}>情感发展</Text>
                                    </Space>
                                    <List
                                        size="small"
                                        dataSource={stage.emotionArcs}
                                        renderItem={(arc, arcIndex) => (
                                            <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                                <div style={{ width: '100%', paddingLeft: '20px' }}>
                                                    <Space wrap style={{ marginBottom: '4px' }}>
                                                        {arc.characters?.map((character, charIndex) => (
                                                            <Tag key={charIndex} color="magenta">
                                                                {character}
                                                            </Tag>
                                                        ))}
                                                    </Space>
                                                    <Text style={{ color: '#fff', fontSize: '14px' }}>
                                                        {arc.content}
                                                    </Text>
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Relationship Developments */}
                            {stage.relationshipDevelopments && stage.relationshipDevelopments.length > 0 && (
                                <div>
                                    <Space align="center" style={{ marginBottom: '8px' }}>
                                        <TeamOutlined style={{ color: '#52c41a' }} />
                                        <Text strong style={{ color: '#52c41a' }}>关系发展</Text>
                                    </Space>
                                    <List
                                        size="small"
                                        dataSource={stage.relationshipDevelopments}
                                        renderItem={(rel, relIndex) => (
                                            <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                                <div style={{ width: '100%', paddingLeft: '20px' }}>
                                                    <Space wrap style={{ marginBottom: '4px' }}>
                                                        {rel.characters?.map((character, charIndex) => (
                                                            <Tag key={charIndex} color="green">
                                                                {character}
                                                            </Tag>
                                                        ))}
                                                    </Space>
                                                    <Text style={{ color: '#fff', fontSize: '14px' }}>
                                                        {rel.content}
                                                    </Text>
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Key Insights */}
                            {stage.insights && stage.insights.length > 0 && (
                                <div>
                                    <Space align="center" style={{ marginBottom: '8px' }}>
                                        <BulbOutlined style={{ color: '#fadb14' }} />
                                        <Text strong style={{ color: '#fadb14' }}>关键洞察</Text>
                                    </Space>
                                    <List
                                        size="small"
                                        dataSource={stage.insights}
                                        renderItem={(insight, insightIndex) => (
                                            <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                                <div style={{ paddingLeft: '20px' }}>
                                                    <Text style={{ color: '#fff', fontSize: '14px' }}>
                                                        • {insight}
                                                    </Text>
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            )}
                        </Space>
                    </Panel>
                </Collapse>
            </Card>
        );
    };

    return (
        <div id="chronicles" style={{ marginTop: '24px' }}>
            <Card
                style={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                }}
                styles={{ body: { padding: '24px' } }}
            >
                {/* Header */}
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                    <Space direction="vertical" size="small">
                        <Title level={3} style={{ color: '#1890ff', margin: 0 }}>
                            时间顺序大纲
                        </Title>
                        <Text type="secondary">
                            按时间顺序梳理的完整故事发展阶段（共 {chronicles.stages.length} 个阶段）
                        </Text>
                    </Space>
                </div>

                {/* Stages Timeline */}
                <div>
                    {chronicles.stages.map((stage, index) => renderStageCard(stage, index))}
                </div>
            </Card>
        </div>
    );
}; 