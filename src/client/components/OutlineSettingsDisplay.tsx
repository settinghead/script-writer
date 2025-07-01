import React, { useMemo } from 'react';
import { Card, Typography, Tag, Space, Row, Col } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined } from '@ant-design/icons';
import { OutlineSettingsOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Title, Text, Paragraph } = Typography;

interface OutlineSettingsDisplayProps {
}

export const OutlineSettingsDisplay: React.FC<OutlineSettingsDisplayProps> = ({
}) => {
    const projectData = useProjectData()

    // Get outline settings artifacts
    const outlineSettingsArtifacts = useMemo(() => {
        return projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'outline_settings_schema' &&
            artifact.data
        );
    }, [projectData.artifacts]);

    // Parse outline settings data
    const outlineSettingsData = useMemo(() => {
        return outlineSettingsArtifacts.map(artifact => {
            try {
                return JSON.parse(artifact.data) as OutlineSettingsOutput;
            } catch (error) {
                console.warn('Failed to parse outline settings data:', error);
                return null;
            }
        }).filter(settings => settings !== null) as OutlineSettingsOutput[];
    }, [outlineSettingsArtifacts]);

    const outlineSettings = useMemo(() => {
        if (outlineSettingsData?.length > 1) {
            return "multiple-settings-error" as const;
        }
        return outlineSettingsData?.[0] ?? null;
    }, [outlineSettingsData]);

    if (outlineSettings === "multiple-settings-error") {
        return <div>Error: multiple outline settings found</div>
    }

    if (!outlineSettings) {
        return null;
    }

    return (
        <div id="outline-settings" style={{ marginTop: '24px' }}>
            <Card
                style={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                }}
                styles={{ body: { padding: '24px' } }}
            >
                {/* Header Section - only show if title or genre is available */}
                {(outlineSettings.title || outlineSettings.genre) && (
                    <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                        {outlineSettings.title && (
                            <Title level={2} style={{ color: '#fff', marginBottom: '8px' }}>
                                {outlineSettings.title}
                            </Title>
                        )}
                        {outlineSettings.genre && (
                            <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
                                {outlineSettings.genre}
                            </Tag>
                        )}
                    </div>
                )}

                {/* Target Audience - only show if available */}
                {outlineSettings.target_audience && (
                    <Card
                        size="small"
                        title={<span><UserOutlined /> 目标受众</span>}
                        style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Text strong>主要群体：</Text>
                            <Text>
                                {typeof outlineSettings.target_audience === 'string'
                                    ? outlineSettings.target_audience
                                    : typeof outlineSettings.target_audience === 'object' && outlineSettings.target_audience !== null && 'demographic' in outlineSettings.target_audience
                                        ? (outlineSettings.target_audience as any).demographic
                                        : '未指定'}
                            </Text>
                            {typeof outlineSettings.target_audience === 'object' && outlineSettings.target_audience !== null && 'core_themes' in outlineSettings.target_audience && (
                                <div style={{ marginTop: '8px' }}>
                                    <Text strong>核心主题：</Text>
                                    <div style={{ marginTop: '4px' }}>
                                        {((outlineSettings.target_audience as any).core_themes as string[]).map((theme: string, index: number) => (
                                            <Tag key={index} style={{ marginBottom: '4px' }}>{theme}</Tag>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Space>
                    </Card>
                )}

                {/* Selling Points & Satisfaction Points - only show if available */}
                {(outlineSettings.selling_points || outlineSettings.satisfaction_points) && (
                    <Row gutter={16} style={{ marginBottom: '16px' }}>
                        {outlineSettings.selling_points && outlineSettings.selling_points.length > 0 && (
                            <Col span={outlineSettings.satisfaction_points && outlineSettings.satisfaction_points.length > 0 ? 12 : 24}>
                                <Card
                                    size="small"
                                    title={<span><StarOutlined /> 产品卖点</span>}
                                    style={{ backgroundColor: '#262626', border: '1px solid #434343', height: '100%' }}
                                >
                                    <Space direction="vertical" size="small">
                                        {outlineSettings.selling_points.map((point: string, index: number) => (
                                            <Text key={index}>• {point}</Text>
                                        ))}
                                    </Space>
                                </Card>
                            </Col>
                        )}
                        {outlineSettings.satisfaction_points && outlineSettings.satisfaction_points.length > 0 && (
                            <Col span={outlineSettings.selling_points && outlineSettings.selling_points.length > 0 ? 12 : 24}>
                                <Card
                                    size="small"
                                    title={<span><HeartOutlined /> 情感爽点</span>}
                                    style={{ backgroundColor: '#262626', border: '1px solid #434343', height: '100%' }}
                                >
                                    <Space direction="vertical" size="small">
                                        {outlineSettings.satisfaction_points.map((point: string, index: number) => (
                                            <Text key={index}>• {point}</Text>
                                        ))}
                                    </Space>
                                </Card>
                            </Col>
                        )}
                    </Row>
                )}

                {/* Story Setting - only show if available */}
                {outlineSettings.setting && (
                    <Card
                        size="small"
                        title={<span><EnvironmentOutlined /> 故事设定</span>}
                        style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {outlineSettings.setting.time_period && (
                                <div>
                                    <Text strong>时间背景：</Text>
                                    <Paragraph style={{ margin: '8px 0' }}>{outlineSettings.setting.time_period}</Paragraph>
                                </div>
                            )}
                            {outlineSettings.setting.location && (
                                <div>
                                    <Text strong>地点设定：</Text>
                                    <Paragraph style={{ margin: '8px 0' }}>{outlineSettings.setting.location}</Paragraph>
                                </div>
                            )}
                            {outlineSettings.setting.social_context && (
                                <div>
                                    <Text strong>社会背景：</Text>
                                    <Paragraph style={{ margin: '8px 0' }}>{outlineSettings.setting.social_context}</Paragraph>
                                </div>
                            )}
                        </Space>
                    </Card>
                )}

                {/* Characters - only show if available */}
                {outlineSettings.characters && outlineSettings.characters.length > 0 && (
                    <Card
                        size="small"
                        title={<span><TeamOutlined /> 人物角色</span>}
                        style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Row gutter={[16, 16]}>
                            {outlineSettings.characters.map((character: any, index: number) => (
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
                                            {(character.age || character.occupation) && (
                                                <Text type="secondary">
                                                    {[character.age, character.occupation].filter(Boolean).join(' • ')}
                                                </Text>
                                            )}
                                            {character.personality && (
                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: '12px' }}>
                                                    {character.personality}
                                                </Paragraph>
                                            )}
                                            {character.appearance && (
                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: '12px' }}>
                                                    外貌：{character.appearance}
                                                </Paragraph>
                                            )}
                                            {character.background && (
                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: '12px' }}>
                                                    背景：{character.background}
                                                </Paragraph>
                                            )}
                                        </Space>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
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