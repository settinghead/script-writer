import React, { useMemo, useCallback } from 'react';
import { Card, Typography, Tag, Space, Button } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { OutlineSettingsOutput } from '../../../common/schemas/outlineSchemas';
import { useYJSArtifactContext } from '../../contexts/YJSArtifactContext';
import { YJSTextField, YJSTextAreaField, YJSArrayField } from './YJSField';

const { Text } = Typography;

/**
 * YJS-enabled editable form component for outline settings
 * This component is designed to be used within a YJSArtifactProvider
 */
export const EditableOutlineForm: React.FC = () => {
    const { getField, setField, artifact } = useYJSArtifactContext();

    // Get current values from YJS context
    const outlineSettings = useMemo(() => {
        try {
            const data = artifact?.data;
            if (typeof data === 'string') {
                return JSON.parse(data) as OutlineSettingsOutput;
            }
            if (data && typeof data === 'object') {
                return data as OutlineSettingsOutput;
            }
            return {} as OutlineSettingsOutput;
        } catch (error) {
            console.warn('Failed to parse outline settings data:', error);
            return {} as OutlineSettingsOutput;
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>姓名：</Text>
                                    <YJSTextField
                                        path={`characters.${index}.name`}
                                        placeholder="角色姓名"
                                    />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>类型：</Text>
                                    <YJSTextField
                                        path={`characters.${index}.type`}
                                        placeholder="角色类型"
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>基本信息：</Text>
                                    <div>
                                        <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>年龄：</Text>
                                        <YJSTextField
                                            path={`characters.${index}.age`}
                                            placeholder="年龄"
                                        />
                                    </div>
                                    <div>
                                        <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>性别：</Text>
                                        <YJSTextField
                                            path={`characters.${index}.gender`}
                                            placeholder="性别"
                                        />
                                    </div>
                                    <div>
                                        <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>职业：</Text>
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