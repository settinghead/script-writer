import React, { useMemo } from 'react';
import { Card, Typography, Tag, Space, Collapse, Row, Col } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined } from '@ant-design/icons';
import { OutlineGenerationOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface OutlineDisplayProps {
}

export const OutlineDisplay: React.FC<OutlineDisplayProps> = ({
}) => {
    const projectData = useProjectData()

    // Get outline artifacts
    const outlineArtifacts = useMemo(() => {
        return projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'outline_schema' &&
            artifact.data
        );
    }, [projectData.artifacts]);

    // Parse outline data
    const outlines = useMemo(() => {
        return outlineArtifacts.map(artifact => {
            try {
                return JSON.parse(artifact.data) as OutlineGenerationOutput;
            } catch (error) {
                console.warn('Failed to parse outline data:', error);
                return null;
            }
        }).filter(outline => outline !== null) as OutlineGenerationOutput[];
    }, [outlineArtifacts]);

    const outline = useMemo(() => {
        if (outlines?.length > 1) {
            return "multiple-outline-error" as const;
        }
        return outlines?.[0] ?? null;
    }, [outlines]);

    if (outline === "multiple-outline-error") {
        return <div>Error: multiple outlines found</div>
    }

    if (!outline) {
        return null;
    }

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
                {/* Header Section - only show if title or genre is available */}
                {(outline.title || outline.genre) && (
                    <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                        {outline.title && (
                            <Title level={2} style={{ color: '#fff', marginBottom: '8px' }}>
                                {outline.title}
                            </Title>
                        )}
                        {outline.genre && (
                            <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
                                {outline.genre}
                            </Tag>
                        )}
                    </div>
                )}

                {/* Target Audience - only show if available */}
                {outline.target_audience && (
                    <Card
                        size="small"
                        title={<span><UserOutlined /> 目标受众</span>}
                        style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {outline.target_audience.demographic && (
                                <>
                                    <Text strong>主要群体：</Text>
                                    <Text>{outline.target_audience.demographic}</Text>
                                </>
                            )}
                            {outline.target_audience.core_themes && outline.target_audience.core_themes.length > 0 && (
                                <>
                                    <Text strong>核心主题：</Text>
                                    <div>
                                        {outline.target_audience.core_themes.map((theme, index) => (
                                            <Tag key={index} color="blue" style={{ marginBottom: '4px' }}>
                                                {theme}
                                            </Tag>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Space>
                    </Card>
                )}

                {/* Selling Points & Satisfaction Points - only show if available */}
                {(outline.selling_points || outline.satisfaction_points) && (
                    <Row gutter={16} style={{ marginBottom: '16px' }}>
                        {outline.selling_points && outline.selling_points.length > 0 && (
                            <Col span={outline.satisfaction_points && outline.satisfaction_points.length > 0 ? 12 : 24}>
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
                        )}
                        {outline.satisfaction_points && outline.satisfaction_points.length > 0 && (
                            <Col span={outline.selling_points && outline.selling_points.length > 0 ? 12 : 24}>
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
                        )}
                    </Row>
                )}

                {/* Story Setting - only show if available */}
                {outline.setting && (
                    <Card
                        size="small"
                        title={<span><EnvironmentOutlined /> 故事设定</span>}
                        style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {outline.setting.core_setting_summary && (
                                <div>
                                    <Text strong>核心设定：</Text>
                                    <Paragraph style={{ margin: '8px 0' }}>{outline.setting.core_setting_summary}</Paragraph>
                                </div>
                            )}
                            {outline.setting.key_scenes && outline.setting.key_scenes.length > 0 && (
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
                            )}
                        </Space>
                    </Card>
                )}

                {/* Characters - only show if available */}
                {outline.characters && outline.characters.length > 0 && (
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
                                                {character.name && (
                                                    <Text strong style={{ fontSize: '16px' }}>{character.name}</Text>
                                                )}
                                                {character.type && (
                                                    <Tag color={getCharacterTypeColor(character.type)}>{getCharacterTypeLabel(character.type)}</Tag>
                                                )}
                                            </div>
                                            {(character.age || character.gender || character.occupation) && (
                                                <Text type="secondary">
                                                    {[character.age, character.gender, character.occupation].filter(Boolean).join(' • ')}
                                                </Text>
                                            )}
                                            {character.description && (
                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: '12px' }}>
                                                    {character.description}
                                                </Paragraph>
                                            )}
                                            {character.personality_traits && character.personality_traits.length > 0 && (
                                                <div>
                                                    {character.personality_traits.slice(0, 3).map((trait, traitIndex) => (
                                                        <Tag key={traitIndex} style={{ fontSize: '10px' }}>
                                                            {trait}
                                                        </Tag>
                                                    ))}
                                                </div>
                                            )}
                                        </Space>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </Card>
                )}

                {/* Story Stages - only show if available */}
                {outline.stages && outline.stages.length > 0 && (
                    <Card
                        size="small"
                        title="故事发展阶段"
                        style={{ backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Collapse ghost activeKey={outline.stages.map((stage, index) => index.toString())}>
                            {outline.stages.map((stage, index) => (
                                <Panel
                                    header={stage.title || `第${index + 1}阶段`}
                                    key={index}
                                    style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343', marginBottom: '8px' }}
                                >
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>

                                        {stage.stageSynopsis && (
                                            <Paragraph style={{ margin: 0, lineHeight: 1.6 }}>
                                                {stage.stageSynopsis}
                                            </Paragraph>
                                        )}

                                        {stage.event && (
                                            <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#262626', borderRadius: '4px' }}>
                                                <Text strong>核心事件：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    <Text>{stage.event}</Text>
                                                </div>
                                            </div>
                                        )}

                                        {stage.emotionArcs && stage.emotionArcs.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text strong>情感变化：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    {stage.emotionArcs.map((arc, arcIndex) => (
                                                        <div key={arcIndex} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                                            <Text type="secondary">
                                                                {(arc.characters && Array.isArray(arc.characters) ? arc.characters.join(', ') : '未知角色')}:
                                                            </Text>
                                                            <Text style={{ marginLeft: '4px' }}>{arc.content || ''}</Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {stage.relationshipDevelopments && stage.relationshipDevelopments.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text strong>关系发展：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    {stage.relationshipDevelopments.map((dev, devIndex) => (
                                                        <div key={devIndex} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                                            <Text type="secondary">
                                                                {(dev.characters && Array.isArray(dev.characters) ? dev.characters.join(' & ') : '未知角色')}:
                                                            </Text>
                                                            <Text style={{ marginLeft: '4px' }}>{dev.content || ''}</Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {stage.insights && stage.insights.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text strong>观众洞察：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    {stage.insights.map((insight, insightIndex) => (
                                                        <div key={insightIndex} style={{ marginBottom: '4px' }}>
                                                            <Tag color="cyan" style={{ fontSize: '11px' }}>
                                                                {insight}
                                                            </Tag>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </Space>
                                </Panel>
                            ))}
                        </Collapse>
                    </Card>
                )}
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