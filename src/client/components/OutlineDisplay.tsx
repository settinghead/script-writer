import React from 'react';
import { Card, Typography, Tag, Space, Collapse, Row, Col } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined } from '@ant-design/icons';
import { OutlineGenerationOutput } from '../../common/schemas/outlineSchemas';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface OutlineDisplayProps {
    outline: OutlineGenerationOutput;
    isGenerating?: boolean;
}

export const OutlineDisplay: React.FC<OutlineDisplayProps> = ({
    outline,
    isGenerating = false
}) => {
    return (
        <div id="story-outline" style={{ marginTop: '24px' }}>
            <Card
                style={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                }}
                styles={{ body: { padding: '24px' } }}
            >
                {/* Header Section */}
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                    <Title level={2} style={{ color: '#fff', marginBottom: '8px' }}>
                        {outline.title}
                    </Title>
                    <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
                        {outline.genre}
                    </Tag>
                </div>

                {/* Target Audience */}
                <Card
                    size="small"
                    title={<span><UserOutlined /> 目标受众</span>}
                    style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text strong>主要群体：</Text>
                        <Text>{outline.target_audience.demographic}</Text>
                        <Text strong>核心主题：</Text>
                        <div>
                            {outline.target_audience.core_themes.map((theme, index) => (
                                <Tag key={index} color="blue" style={{ marginBottom: '4px' }}>
                                    {theme}
                                </Tag>
                            ))}
                        </div>
                    </Space>
                </Card>

                {/* Selling Points & Satisfaction Points */}
                <Row gutter={16} style={{ marginBottom: '16px' }}>
                    <Col span={12}>
                        <Card
                            size="small"
                            title={<span><StarOutlined /> 产品卖点</span>}
                            style={{ backgroundColor: '#262626', border: '1px solid #434343', height: '100%' }}
                        >
                            <Space direction="vertical" size="small">
                                {outline.selling_points.map((point, index) => (
                                    <Text key={index}>• {point}</Text>
                                ))}
                            </Space>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card
                            size="small"
                            title={<span><HeartOutlined /> 情感爽点</span>}
                            style={{ backgroundColor: '#262626', border: '1px solid #434343', height: '100%' }}
                        >
                            <Space direction="vertical" size="small">
                                {outline.satisfaction_points.map((point, index) => (
                                    <Text key={index}>• {point}</Text>
                                ))}
                            </Space>
                        </Card>
                    </Col>
                </Row>

                {/* Story Setting */}
                <Card
                    size="small"
                    title={<span><EnvironmentOutlined /> 故事设定</span>}
                    style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                            <Text strong>核心设定：</Text>
                            <Paragraph style={{ margin: '8px 0' }}>{outline.setting.core_setting_summary}</Paragraph>
                        </div>
                        <div>
                            <Text strong>关键场景：</Text>
                            <div style={{ marginTop: '8px' }}>
                                {outline.setting.key_scenes.map((scene, index) => (
                                    <Tag key={index} color="green" style={{ marginBottom: '4px', display: 'block', marginRight: 0 }}>
                                        {scene}
                                    </Tag>
                                ))}
                            </div>
                        </div>
                    </Space>
                </Card>

                {/* Characters */}
                <Card
                    size="small"
                    title={<span><TeamOutlined /> 人物角色</span>}
                    style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <Row gutter={[16, 16]}>
                        {outline.characters.map((character, index) => (
                            <Col span={12} key={index}>
                                <Card
                                    size="small"
                                    style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343' }}
                                >
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text strong style={{ fontSize: '16px' }}>{character.name}</Text>
                                            <Tag color={getCharacterTypeColor(character.type)}>{getCharacterTypeLabel(character.type)}</Tag>
                                        </div>
                                        <Text type="secondary">{character.age} • {character.gender} • {character.occupation}</Text>
                                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: '12px' }}>
                                            {character.description}
                                        </Paragraph>
                                        <div>
                                            {character.personality_traits.slice(0, 3).map((trait, traitIndex) => (
                                                <Tag key={traitIndex} style={{ fontSize: '10px' }}>
                                                    {trait}
                                                </Tag>
                                            ))}
                                        </div>
                                    </Space>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Card>

                {/* Story Stages */}
                <Card
                    size="small"
                    title="分段故事发展"
                    style={{ backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <Collapse ghost>
                        {outline.synopsis_stages.map((stage, index) => (
                            <Panel
                                header={`第${index + 1}阶段`}
                                key={index}
                                style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343', marginBottom: '8px' }}
                            >
                                <Paragraph style={{ margin: 0, lineHeight: 1.6 }}>
                                    {stage}
                                </Paragraph>
                            </Panel>
                        ))}
                    </Collapse>
                </Card>
            </Card>
        </div>
    );
};

// Helper functions
const getCharacterTypeColor = (type: string): string => {
    switch (type) {
        case 'male_lead': return 'blue';
        case 'female_lead': return 'pink';
        case 'male_second': return 'cyan';
        case 'female_second': return 'magenta';
        case 'antagonist': return 'red';
        default: return 'default';
    }
};

const getCharacterTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        'male_lead': '男主',
        'female_lead': '女主',
        'male_second': '男二',
        'female_second': '女二',
        'male_supporting': '男配',
        'female_supporting': '女配',
        'antagonist': '反派',
        'other': '其他'
    };
    return labels[type] || type;
}; 