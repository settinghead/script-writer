import React, { useMemo, useState, useCallback } from 'react';
import { Card, Typography, Tag, Space, Button, Spin } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, LoadingOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { OutlineSettingsOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { YJSArtifactProvider, useYJSArtifactContext } from '../contexts/YJSArtifactContext';
import { YJSTextField, YJSTextAreaField, YJSArrayField } from './shared/YJSField';
import { SectionWrapper, ArtifactSchemaType } from './shared';

const { Text, Title } = Typography;

interface OutlineSettingsDisplayProps {
    outlineSettings?: any; // The artifact to display
    isEditable?: boolean; // Whether the artifact is editable
    mode?: 'editable' | 'readonly'; // Display mode
}

// YJS-enabled editable form component
const EditableOutlineForm: React.FC = () => {
    const { getField, setField, artifact } = useYJSArtifactContext();

    // Get current values from YJS context
    const outlineSettings = useMemo(() => {
        try {
            const data = artifact?.data;
            if (typeof data === 'string') {
                return JSON.parse(data) as OutlineSettingsOutput;
            }
            return data as OutlineSettingsOutput || {};
        } catch (error) {
            console.warn('Failed to parse outline settings data:', error);
            return {};
        }
    }, [artifact?.data]);

    // Ensure characters is always an array
    const characters = useMemo(() => {
        // Try to get characters from YJS first, then fallback to parsed data
        const yjsChars = getField('characters');
        if (Array.isArray(yjsChars)) {
            return yjsChars;
        }

        // Fallback to parsed outline settings
        const chars = (outlineSettings as any)?.characters;
        if (Array.isArray(chars)) {
            return chars;
        }
        return [];
    }, [getField, (outlineSettings as any)?.characters]);

    // Handle adding a new character
    const handleAddCharacter = useCallback(() => {
        const currentCharacters = getField('characters') || [];
        const newCharacter = {
            name: '',
            type: 'supporting',
            age: '',
            gender: '',
            occupation: '',
            description: '',
            personality_traits: [],
            character_arc: '',
            key_scenes: []
        };
        setField('characters', [...currentCharacters, newCharacter]);
    }, [getField, setField]);

    // Handle removing a character
    const handleRemoveCharacter = useCallback((index: number) => {
        const currentCharacters = getField('characters') || [];
        const updatedCharacters = currentCharacters.filter((_: any, i: number) => i !== index);
        setField('characters', updatedCharacters);
    }, [getField, setField]);

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Basic Information */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    📊 基本信息
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本标题：</Text>
                        <YJSTextField
                            path="title"
                            placeholder="剧本标题"
                        />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本类型：</Text>
                        <YJSTextField
                            path="genre"
                            placeholder="剧本类型"
                        />
                    </div>
                </div>
            </div>

            {/* Target Audience */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <UserOutlined style={{ marginRight: '8px' }} />
                    目标观众
                </Text>
                <div>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>目标群体：</Text>
                    <YJSTextField
                        path="target_audience.demographic"
                        placeholder="目标群体"
                    />
                </div>
                <div style={{ marginTop: '12px' }}>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心主题：</Text>
                    <YJSArrayField
                        path="target_audience.core_themes"
                        placeholder="每行一个主题..."
                    />
                </div>
            </div>

            {/* Selling Points */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <HeartOutlined style={{ marginRight: '8px' }} />
                    卖点
                </Text>
                <YJSArrayField
                    path="selling_points"
                    placeholder="每行一个卖点..."
                />
            </div>

            {/* Satisfaction Points */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <StarOutlined style={{ marginRight: '8px' }} />
                    爽点
                </Text>
                <YJSArrayField
                    path="satisfaction_points"
                    placeholder="每行一个爽点..."
                />
            </div>

            {/* Setting */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <EnvironmentOutlined style={{ marginRight: '8px' }} />
                    故事设定
                </Text>
                <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心设定：</Text>
                    <YJSTextAreaField
                        path="setting.core_setting_summary"
                        placeholder="核心设定"
                        rows={3}
                    />
                </div>
                <div>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>关键场景：</Text>
                    <YJSArrayField
                        path="setting.key_scenes"
                        placeholder="每行一个关键场景..."
                    />
                </div>
            </div>

            {/* Characters */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <Text strong style={{ fontSize: '16px', color: '#fff' }}>
                        <TeamOutlined style={{ marginRight: '8px' }} />
                        角色设定
                    </Text>
                    <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAddCharacter}
                        size="small"
                        style={{
                            borderColor: '#52c41a',
                            color: '#52c41a'
                        }}
                    >
                        添加角色
                    </Button>
                </div>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {characters.map((character: any, index: number) => (
                        <Card
                            key={index}
                            size="small"
                            style={{
                                backgroundColor: '#262626',
                                border: '1px solid #434343'
                            }}
                            styles={{ body: { padding: '16px' } }}
                            extra={
                                <Button
                                    type="text"
                                    icon={<CloseOutlined />}
                                    size="small"
                                    onClick={() => handleRemoveCharacter(index)}
                                    style={{ color: '#ff4d4f' }}
                                />
                            }
                        >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>姓名：</Text>
                                    <YJSTextField
                                        path={`characters.${index}.name`}
                                        placeholder="角色姓名"
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>类型：</Text>
                                    <YJSTextField
                                        path={`characters.${index}.type`}
                                        placeholder="角色类型"
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>基本信息：</Text>
                                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                        <YJSTextField
                                            path={`characters.${index}.age`}
                                            placeholder="年龄"
                                        />
                                        <YJSTextField
                                            path={`characters.${index}.gender`}
                                            placeholder="性别"
                                        />
                                        <YJSTextField
                                            path={`characters.${index}.occupation`}
                                            placeholder="职业"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>角色描述：</Text>
                                    <YJSTextAreaField
                                        path={`characters.${index}.description`}
                                        placeholder="角色描述"
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>性格特点：</Text>
                                    <YJSArrayField
                                        path={`characters.${index}.personality_traits`}
                                        placeholder="每行一个性格特点..."
                                    />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>成长轨迹：</Text>
                                    <YJSTextAreaField
                                        path={`characters.${index}.character_arc`}
                                        placeholder="成长轨迹"
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>关键场景：</Text>
                                    <YJSArrayField
                                        path={`characters.${index}.key_scenes`}
                                        placeholder="每行一个关键场景..."
                                    />
                                </div>
                            </Space>
                        </Card>
                    ))}

                    {characters.length === 0 && (
                        <Card
                            size="small"
                            style={{
                                backgroundColor: '#1a1a1a',
                                border: '1px dashed #434343',
                                textAlign: 'center'
                            }}
                            styles={{ body: { padding: '24px' } }}
                        >
                            <Text style={{ color: '#666', fontSize: '14px' }}>
                                暂无角色，点击上方"添加角色"按钮开始创建
                            </Text>
                        </Card>
                    )}
                </Space>
            </div>
        </Space>
    );
};

// Read-only display component
const ReadOnlyOutlineDisplay: React.FC<{ artifactId: string }> = ({ artifactId }) => {
    const projectData = useProjectData();

    const artifact = projectData.getArtifactById(artifactId);
    const outlineSettings = useMemo(() => {
        if (!artifact?.data) {
            return null;
        }
        try {
            const data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
            return data as OutlineSettingsOutput;
        } catch (error) {
            console.warn('Failed to parse outline settings data:', error);
            return null;
        }
    }, [artifact?.data]);

    if (!outlineSettings) {
        return (
            <div style={{ padding: '16px', textAlign: 'center' }}>
                <Text style={{ color: '#666' }}>加载中...</Text>
            </div>
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Basic Information */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    📊 基本信息
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本标题：</Text>
                        <Text style={{ fontSize: '14px', color: '#d9d9d9' }}>
                            {outlineSettings.title || '未设置'}
                        </Text>
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本类型：</Text>
                        <Text style={{ fontSize: '14px', color: '#d9d9d9' }}>
                            {outlineSettings.genre || '未设置'}
                        </Text>
                    </div>
                </div>
            </div>

            {/* Target Audience */}
            {(outlineSettings.target_audience?.demographic || outlineSettings.target_audience?.core_themes?.length) && (
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <UserOutlined style={{ marginRight: '8px' }} />
                        目标观众
                    </Text>
                    {outlineSettings.target_audience?.demographic && (
                        <div style={{ marginBottom: '8px' }}>
                            <Text strong style={{ fontSize: '14px', color: '#fff' }}>目标群体：</Text>
                            <Text style={{ fontSize: '14px', color: '#d9d9d9', marginLeft: '8px' }}>
                                {outlineSettings.target_audience.demographic}
                            </Text>
                        </div>
                    )}
                    {Array.isArray(outlineSettings.target_audience?.core_themes) && outlineSettings.target_audience.core_themes.length > 0 && (
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心主题：</Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {outlineSettings.target_audience.core_themes.map((theme: string, index: number) => (
                                    <Tag key={index} color="blue">{theme}</Tag>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Selling Points */}
            {Array.isArray(outlineSettings.selling_points) && outlineSettings.selling_points.length > 0 && (
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <HeartOutlined style={{ marginRight: '8px' }} />
                        卖点
                    </Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {outlineSettings.selling_points.map((point: string, index: number) => (
                            <Tag key={index} color="red">{point}</Tag>
                        ))}
                    </div>
                </div>
            )}

            {/* Satisfaction Points */}
            {Array.isArray(outlineSettings.satisfaction_points) && outlineSettings.satisfaction_points.length > 0 && (
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <StarOutlined style={{ marginRight: '8px' }} />
                        爽点
                    </Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {outlineSettings.satisfaction_points.map((point: string, index: number) => (
                            <Tag key={index} color="gold">{point}</Tag>
                        ))}
                    </div>
                </div>
            )}

            {/* Setting */}
            {(outlineSettings.setting?.core_setting_summary || (Array.isArray(outlineSettings.setting?.key_scenes) && outlineSettings.setting.key_scenes.length > 0)) && (
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <EnvironmentOutlined style={{ marginRight: '8px' }} />
                        故事设定
                    </Text>
                    {outlineSettings.setting?.core_setting_summary && (
                        <div style={{ marginBottom: '8px' }}>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心设定：</Text>
                            <Text style={{ fontSize: '14px', color: '#d9d9d9', lineHeight: '1.5' }}>
                                {outlineSettings.setting.core_setting_summary}
                            </Text>
                        </div>
                    )}
                    {Array.isArray(outlineSettings.setting?.key_scenes) && outlineSettings.setting.key_scenes.length > 0 && (
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>关键场景：</Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {outlineSettings.setting.key_scenes.map((scene: string, index: number) => (
                                    <Tag key={index} color="green">{scene}</Tag>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Characters */}
            {Array.isArray(outlineSettings.characters) && outlineSettings.characters.length > 0 && (
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <TeamOutlined style={{ marginRight: '8px' }} />
                        角色设定
                    </Text>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {outlineSettings.characters.map((character: any, index: number) => (
                            <Card
                                key={index}
                                size="small"
                                style={{
                                    backgroundColor: '#262626',
                                    border: '1px solid #434343'
                                }}
                                styles={{ body: { padding: '16px' } }}
                            >
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                                            {character.name || `角色 ${index + 1}`}
                                        </Text>
                                        {character.type && (
                                            <Tag color="blue">{character.type}</Tag>
                                        )}
                                    </div>
                                    {(character.age || character.gender || character.occupation) && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {character.age && <Tag>{character.age}</Tag>}
                                            {character.gender && <Tag>{character.gender}</Tag>}
                                            {character.occupation && <Tag>{character.occupation}</Tag>}
                                        </div>
                                    )}
                                    {character.description && (
                                        <Text style={{ fontSize: '13px', color: '#d9d9d9', lineHeight: '1.5' }}>
                                            {character.description}
                                        </Text>
                                    )}
                                    {Array.isArray(character.personality_traits) && character.personality_traits.length > 0 && (
                                        <div>
                                            <Text strong style={{ fontSize: '12px', color: '#999' }}>性格特点：</Text>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                {character.personality_traits.map((trait: string, traitIndex: number) => (
                                                    <Tag key={traitIndex} color="purple">{trait}</Tag>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {character.character_arc && (
                                        <div>
                                            <Text strong style={{ fontSize: '12px', color: '#999' }}>成长轨迹：</Text>
                                            <Text style={{ fontSize: '12px', color: '#ccc', display: 'block', marginTop: '2px' }}>
                                                {character.character_arc}
                                            </Text>
                                        </div>
                                    )}
                                    {Array.isArray(character.key_scenes) && character.key_scenes.length > 0 && (
                                        <div>
                                            <Text strong style={{ fontSize: '12px', color: '#999' }}>关键场景：</Text>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                {character.key_scenes.map((scene: string, sceneIndex: number) => (
                                                    <Tag key={sceneIndex} color="orange">{scene}</Tag>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Space>
                            </Card>
                        ))}
                    </Space>
                </div>
            )}
        </Space>
    );
};

export const OutlineSettingsDisplay: React.FC<OutlineSettingsDisplayProps> = ({
    outlineSettings: propsOutlineSettings,
    isEditable: propsIsEditable,
    mode: propsMode
}) => {
    const projectData = useProjectData();

    // If we have props from actionComputation, use them directly
    if (propsOutlineSettings) {
        const isEditable = propsIsEditable ?? false;
        const effectiveArtifact = propsOutlineSettings;

        let mainContent: React.ReactNode = null;

        if (isEditable) {
            // Editable mode - green border, user can edit with YJS
            mainContent = (
                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '2px solid #52c41a',
                        borderRadius: '8px'
                    }}
                    styles={{ body: { padding: '24px' } }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '6px',
                                height: '32px',
                                backgroundColor: '#52c41a',
                                borderRadius: '3px'
                            }} />
                            <div>
                                <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                                    ✏️ 编辑剧本框架
                                </Title>
                            </div>
                        </div>
                    </div>

                    {/* YJS-enabled form */}
                    <YJSArtifactProvider artifactId={effectiveArtifact.id} enableCollaboration={true}>
                        <EditableOutlineForm />
                    </YJSArtifactProvider>
                </Card>
            );
        } else {
            // Read-only mode
            mainContent = (
                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        opacity: 0.7
                    }}
                    styles={{ body: { padding: '24px' } }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '6px',
                                height: '32px',
                                backgroundColor: '#555',
                                borderRadius: '3px'
                            }} />
                            <div>
                                <Title level={4} style={{ margin: 0, color: '#888' }}>
                                    📖 剧本框架
                                </Title>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    只读模式
                                </Text>
                            </div>
                        </div>
                    </div>

                    {/* Content sections - read-only */}
                    <ReadOnlyOutlineDisplay artifactId={effectiveArtifact.id} />
                </Card>
            );
        }

        return (
            <SectionWrapper
                schemaType={ArtifactSchemaType.OUTLINE_SETTINGS}
                title="剧本框架"
                sectionId="outline-settings"
                artifactId={effectiveArtifact?.id}
            >
                <div style={{ marginTop: '24px', position: 'relative' }}>
                    {mainContent}
                </div>
            </SectionWrapper>
        );
    }

    // Fallback: No props provided - show loading or empty state
    return (
        <SectionWrapper
            schemaType={ArtifactSchemaType.OUTLINE_SETTINGS}
            title="剧本框架"
            sectionId="outline-settings"
            artifactId={undefined}
        >
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#666' }}>加载剧本框架中...</Text>
                </div>
            </div>
        </SectionWrapper>
    );
}; 