import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, Typography, Tag, Space, Row, Col, Button, message, Spin } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, EditOutlined, LoadingOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { OutlineSettingsOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';
import { EditableText, EditableArray } from './shared/EditableText';

const { Title, Text, Paragraph } = Typography;

interface OutlineSettingsDisplayProps {
}

export const OutlineSettingsDisplay: React.FC<OutlineSettingsDisplayProps> = ({
}) => {
    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Get outline settings artifacts
    const outlineSettingsArtifacts = useMemo(() => {
        return projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'outline_settings_schema' &&
            artifact.data
        );
    }, [projectData.artifacts]);

    // Find the latest outline settings artifact
    const latestOutlineArtifact = useMemo(() => {
        if (outlineSettingsArtifacts.length === 0) return null;

        // Sort by creation time and get the latest
        const sorted = [...outlineSettingsArtifacts].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return sorted[0];
    }, [outlineSettingsArtifacts]);

    // Use lineage resolution to determine if we have an editable version
    const { latestArtifactId, isLoading: lineageLoading } = useLineageResolution({
        sourceArtifactId: latestOutlineArtifact?.id || null,
        path: '$',
        options: { enabled: !!latestOutlineArtifact?.id }
    });



    // Helper function to extract title from artifact data
    const getArtifactTitle = (artifact: any) => {
        try {
            if (!artifact?.data) return 'No data';
            let data = artifact.data;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return data?.title || 'No title';
        } catch {
            return 'Parse error';
        }
    };

    // Get the effective artifact (original or edited version)
    const effectiveArtifact = useMemo(() => {
        if (latestArtifactId) {
            const resolved = projectData.getArtifactById(latestArtifactId);
            return resolved;
        }
        return latestOutlineArtifact;
    }, [latestArtifactId, latestOutlineArtifact, projectData.getArtifactById]);

    // Determine if the current artifact is editable
    const isEditable = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Check if it's a user_input type (editable) and is a leaf node (no descendants)
        const isUserInput = effectiveArtifact.origin_type === 'user_input';
        const hasDescendants = projectData.transformInputs.some(input =>
            input.artifact_id === effectiveArtifact.id
        );

        return isUserInput && !hasDescendants;
    }, [effectiveArtifact, projectData.transformInputs]);

    // Parse outline settings data from the effective artifact
    const outlineSettings = useMemo(() => {
        if (!effectiveArtifact?.data) {
            return null;
        }

        try {
            let data: any = effectiveArtifact.data;

            // Handle string data (parse as JSON)
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            // Now both original LLM artifacts and human-created artifacts store outline settings directly
            return data as OutlineSettingsOutput;
        } catch (error) {
            console.error('❌ [OutlineSettingsDisplay] Failed to parse outline settings data:', error);
            return null;
        }
    }, [effectiveArtifact]);

    // Use ref for outlineSettings to prevent stale closures
    const outlineSettingsRef = useRef(outlineSettings);
    outlineSettingsRef.current = outlineSettings;



    // Handle click to create human transform (only once)
    const handleCreateEditableVersion = useCallback(() => {
        if (!latestOutlineArtifact || isCreatingTransform || isEditable) return;

        setIsCreatingTransform(true);
        projectData.createHumanTransform.mutate({
            transformName: 'edit_outline_settings',
            sourceArtifactId: latestOutlineArtifact.id,
            derivationPath: '$',
            fieldUpdates: {}
        }, {
            onSuccess: (response) => {
                setIsCreatingTransform(false);
                message.success('开始编辑剧本框架');
            },
            onError: (error) => {
                console.error('[OutlineSettingsDisplay] Human transform creation failed:', error);
                setIsCreatingTransform(false);
                message.error(`创建编辑版本失败: ${error.message}`);
            }
        });
    }, [latestOutlineArtifact, isCreatingTransform, isEditable, projectData.createHumanTransform]);

    // Handle saving individual fields
    const handleSave = useCallback(async (path: string, value: any) => {
        if (!effectiveArtifact || !isEditable) {
            return;
        }

        // Get current outline settings data using ref to avoid stale closure
        if (!outlineSettingsRef.current) {
            return;
        }

        const updatedOutlineSettings = { ...outlineSettingsRef.current };

        // Handle different path types
        if (path === 'title') {
            updatedOutlineSettings.title = value;
        } else if (path === 'genre') {
            updatedOutlineSettings.genre = value;
        } else if (path === 'target_audience.demographic') {
            if (!updatedOutlineSettings.target_audience) updatedOutlineSettings.target_audience = { demographic: '', core_themes: [] };
            updatedOutlineSettings.target_audience.demographic = value;
        } else if (path === 'target_audience.core_themes') {
            if (!updatedOutlineSettings.target_audience) updatedOutlineSettings.target_audience = { demographic: '', core_themes: [] };
            updatedOutlineSettings.target_audience.core_themes = value;
        } else if (path.startsWith('target_audience.core_themes[')) {
            // Handle individual core themes array item updates (e.g., target_audience.core_themes[1])
            const match = path.match(/^target_audience\.core_themes\[(\d+)\]$/);
            if (match) {
                const index = parseInt(match[1], 10);
                if (!updatedOutlineSettings.target_audience) updatedOutlineSettings.target_audience = { demographic: '', core_themes: [] };
                if (!updatedOutlineSettings.target_audience.core_themes) updatedOutlineSettings.target_audience.core_themes = [];
                updatedOutlineSettings.target_audience.core_themes[index] = value;

            }
        } else if (path === 'selling_points') {
            updatedOutlineSettings.selling_points = value;
        } else if (path.startsWith('selling_points[')) {
            // Handle individual selling points array item updates
            const match = path.match(/^selling_points\[(\d+)\]$/);
            if (match) {
                const index = parseInt(match[1], 10);
                if (!updatedOutlineSettings.selling_points) updatedOutlineSettings.selling_points = [];
                updatedOutlineSettings.selling_points[index] = value;

            }
        } else if (path === 'satisfaction_points') {
            updatedOutlineSettings.satisfaction_points = value;
        } else if (path.startsWith('satisfaction_points[')) {
            // Handle individual satisfaction points array item updates
            const match = path.match(/^satisfaction_points\[(\d+)\]$/);
            if (match) {
                const index = parseInt(match[1], 10);
                if (!updatedOutlineSettings.satisfaction_points) updatedOutlineSettings.satisfaction_points = [];
                updatedOutlineSettings.satisfaction_points[index] = value;

            }
        } else if (path === 'setting.core_setting_summary') {
            if (!updatedOutlineSettings.setting) updatedOutlineSettings.setting = { core_setting_summary: '', key_scenes: [] };
            updatedOutlineSettings.setting.core_setting_summary = value;
        } else if (path === 'setting.key_scenes') {
            if (!updatedOutlineSettings.setting) updatedOutlineSettings.setting = { core_setting_summary: '', key_scenes: [] };
            updatedOutlineSettings.setting.key_scenes = value;
        } else if (path.startsWith('setting.key_scenes[')) {
            // Handle individual key scenes array item updates
            const match = path.match(/^setting\.key_scenes\[(\d+)\]$/);
            if (match) {
                const index = parseInt(match[1], 10);
                if (!updatedOutlineSettings.setting) updatedOutlineSettings.setting = { core_setting_summary: '', key_scenes: [] };
                if (!updatedOutlineSettings.setting.key_scenes) updatedOutlineSettings.setting.key_scenes = [];
                updatedOutlineSettings.setting.key_scenes[index] = value;

            }
        } else if (path.startsWith('characters[')) {
            // Handle character field updates
            const match = path.match(/^characters\[(\d+)\]\.(.+)$/);
            if (match) {
                const [, indexStr, field] = match;
                const index = parseInt(indexStr, 10);
                if (!updatedOutlineSettings.characters) updatedOutlineSettings.characters = [];
                if (!updatedOutlineSettings.characters[index]) {
                    updatedOutlineSettings.characters[index] = {
                        name: '', type: 'other', description: '', age: '', gender: '',
                        occupation: '', personality_traits: [], character_arc: '',
                        relationships: {}, key_scenes: []
                    };
                }
                if (field === 'personality_traits' || field === 'key_scenes') {
                    (updatedOutlineSettings.characters[index] as any)[field] = value;
                } else {
                    (updatedOutlineSettings.characters[index] as any)[field] = value;
                }
            }
        }

        // Update the artifact - send outline settings data directly
        try {
            await projectData.updateArtifact.mutateAsync({
                artifactId: effectiveArtifact.id,
                data: updatedOutlineSettings
            });
        } catch (error) {
            console.error('[OutlineSettingsDisplay] Update failed:', error);
            throw error;
        }
    }, [effectiveArtifact, isEditable, projectData.updateArtifact, getArtifactTitle]); // Removed outlineSettings to prevent stale closures

    // Handle click on container to create editable version - MUST be defined before early returns
    const handleContainerClick = useCallback(() => {
        if (!isEditable && !isCreatingTransform) {
            handleCreateEditableVersion();
        }
    }, [isEditable, isCreatingTransform, handleCreateEditableVersion]);

    // Determine container styling based on editable state
    const containerStyle = useMemo(() => ({
        backgroundColor: '#1f1f1f',
        border: isEditable ? '2px solid #52c41a' : '1px solid #434343',
        borderRadius: '8px',
        cursor: !isEditable && !isCreatingTransform ? 'pointer' : 'default',
        position: 'relative' as const
    }), [isEditable, isCreatingTransform]);

    // Loading state
    if (lineageLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '24px' }}>
                <Spin size="large" />
            </div>
        );
    }

    // No outline settings found
    if (!outlineSettings) {
        return null;
    }

    return (
        <div id="outline-settings" style={{ marginTop: '24px' }}>
            {/* Loading overlay */}
            {isCreatingTransform && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <Spin
                        indicator={<LoadingOutlined style={{ fontSize: 32, color: '#52c41a' }} spin />}
                        tip="创建编辑版本中..."
                        style={{ color: '#fff' }}
                    />
                </div>
            )}

            <Card
                style={containerStyle}
                styles={{ body: { padding: '24px' } }}
                onClick={handleContainerClick}
                title={
                    isEditable ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#52c41a' }}>
                            <EditOutlined />
                            <span>剧本框架 (可编辑)</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                            <span>剧本框架</span>
                            {!isCreatingTransform && (
                                <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                    点击编辑
                                </span>
                            )}
                        </div>
                    )
                }
            >
                {/* Header Section */}
                <div style={{ marginBottom: '24px', textAlign: 'center', borderBottom: '1px solid #434343', paddingBottom: '16px' }}>
                    <div style={{ marginBottom: '8px' }}>
                        <EditableText
                            value={outlineSettings.title || ''}
                            path="title"
                            placeholder="剧本标题"
                            isEditable={isEditable}
                            onSave={handleSave}
                            style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: '#fff',
                                display: 'block',
                                minHeight: '28px',
                                textAlign: 'center'
                            }}
                        />
                    </div>
                    <div style={{ marginTop: '8px' }}>
                        <EditableText
                            value={outlineSettings.genre || ''}
                            path="genre"
                            placeholder="剧本类型"
                            isEditable={isEditable}
                            onSave={handleSave}
                            style={{
                                fontSize: '14px',
                                padding: '4px 12px',
                                borderRadius: '16px',
                                backgroundColor: isEditable ? 'rgba(138, 43, 226, 0.1)' : '#722ed1',
                                border: isEditable ? '1px solid #722ed1' : 'none',
                                color: isEditable ? '#722ed1' : '#fff',
                                display: 'inline-block',
                                minWidth: '80px',
                                textAlign: 'center'
                            }}
                        />
                    </div>
                </div>

                {/* Target Audience */}
                <Card
                    size="small"
                    title={<span><UserOutlined /> 目标受众</span>}
                    style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                            <Text strong>主要群体：</Text>
                            <EditableText
                                value={outlineSettings.target_audience?.demographic || ''}
                                path="target_audience.demographic"
                                placeholder="目标受众群体"
                                isEditable={isEditable}
                                onSave={handleSave}
                                style={{ marginLeft: '8px' }}
                            />
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            <Text strong>核心主题：</Text>
                            <div style={{ marginTop: '4px' }}>
                                <EditableArray
                                    value={outlineSettings.target_audience?.core_themes || []}
                                    path="target_audience.core_themes"
                                    placeholder="添加核心主题"
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    addButtonText="添加主题"
                                />
                            </div>
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
                            <EditableArray
                                value={outlineSettings.selling_points || []}
                                path="selling_points"
                                placeholder="添加卖点"
                                isEditable={isEditable}
                                onSave={handleSave}
                                addButtonText="添加卖点"
                            />
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card
                            size="small"
                            title={<span><HeartOutlined /> 情感爽点</span>}
                            style={{ backgroundColor: '#262626', border: '1px solid #434343', height: '100%' }}
                        >
                            <EditableArray
                                value={outlineSettings.satisfaction_points || []}
                                path="satisfaction_points"
                                placeholder="添加爽点"
                                isEditable={isEditable}
                                onSave={handleSave}
                                addButtonText="添加爽点"
                            />
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
                            <EditableText
                                value={outlineSettings.setting?.core_setting_summary || ''}
                                path="setting.core_setting_summary"
                                placeholder="描述故事的核心设定"
                                multiline={true}
                                rows={3}
                                isEditable={isEditable}
                                onSave={handleSave}
                                style={{ marginTop: '8px', width: '100%' }}
                            />
                        </div>
                        <div>
                            <Text strong>关键场景：</Text>
                            <div style={{ marginTop: '4px' }}>
                                <EditableArray
                                    value={outlineSettings.setting?.key_scenes || []}
                                    path="setting.key_scenes"
                                    placeholder="添加关键场景"
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    addButtonText="添加场景"
                                />
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
                        {outlineSettings.characters && outlineSettings.characters.map((character: any, index: number) => (
                            <Col span={12} key={index}>
                                <Card
                                    size="small"
                                    style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343', position: 'relative' }}
                                >
                                    {isEditable && (
                                        <Button
                                            type="text"
                                            icon={<CloseOutlined />}
                                            size="small"
                                            onClick={() => {
                                                const updatedCharacters = [...outlineSettings.characters];
                                                updatedCharacters.splice(index, 1);
                                                handleSave('characters', updatedCharacters);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                color: '#ff4d4f',
                                                opacity: 0.7,
                                                zIndex: 1
                                            }}
                                        />
                                    )}
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <EditableText
                                                value={character.name || ''}
                                                path={`characters[${index}].name`}
                                                placeholder="角色姓名"
                                                isEditable={isEditable}
                                                onSave={handleSave}
                                                style={{ fontSize: '16px', fontWeight: 'bold', flex: 1 }}
                                            />
                                            <EditableText
                                                value={getCharacterTypeLabel(character.type) || ''}
                                                path={`characters[${index}].type`}
                                                placeholder="类型"
                                                isEditable={isEditable}
                                                onSave={handleSave}
                                                style={{
                                                    fontSize: '12px',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: isEditable ? 'rgba(24, 144, 255, 0.1)' : getCharacterTypeColor(character.type),
                                                    border: isEditable ? '1px solid #1890ff' : 'none',
                                                    color: isEditable ? '#1890ff' : '#fff'
                                                }}
                                            />
                                        </div>
                                        <EditableText
                                            value={[character.age, character.gender, character.occupation].filter(Boolean).join(' • ') || ''}
                                            path={`characters[${index}].description_summary`}
                                            placeholder="年龄 • 性别 • 职业"
                                            isEditable={isEditable}
                                            onSave={async (path, value) => {
                                                // Parse the combined string back to individual fields
                                                const parts = value.split(' • ').map(p => p.trim());
                                                const updatedCharacter = { ...character };
                                                updatedCharacter.age = parts[0] || '';
                                                updatedCharacter.gender = parts[1] || '';
                                                updatedCharacter.occupation = parts[2] || '';
                                                const updatedCharacters = [...outlineSettings.characters];
                                                updatedCharacters[index] = updatedCharacter;
                                                return handleSave('characters', updatedCharacters);
                                            }}
                                            style={{ fontSize: '12px', color: '#8c8c8c' }}
                                        />
                                        <EditableText
                                            value={character.description || ''}
                                            path={`characters[${index}].description`}
                                            placeholder="角色描述"
                                            multiline={true}
                                            rows={2}
                                            isEditable={isEditable}
                                            onSave={handleSave}
                                            style={{ fontSize: '12px', width: '100%' }}
                                        />
                                        <div>
                                            <Text strong style={{ fontSize: '11px' }}>性格特点：</Text>
                                            <EditableArray
                                                value={character.personality_traits || []}
                                                path={`characters[${index}].personality_traits`}
                                                placeholder="添加性格特点"
                                                isEditable={isEditable}
                                                onSave={handleSave}
                                                addButtonText="添加"
                                            />
                                        </div>
                                        <EditableText
                                            value={character.character_arc || ''}
                                            path={`characters[${index}].character_arc`}
                                            placeholder="成长轨迹"
                                            multiline={true}
                                            rows={2}
                                            isEditable={isEditable}
                                            onSave={handleSave}
                                            style={{ fontSize: '12px', width: '100%' }}
                                        />
                                    </Space>
                                </Card>
                            </Col>
                        ))}
                        {isEditable && (
                            <Col span={12}>
                                <Card
                                    size="small"
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: '2px dashed #434343',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: '200px',
                                        cursor: 'pointer'
                                    }}
                                    bodyStyle={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        padding: '24px'
                                    }}
                                    onClick={() => {
                                        const newCharacter = {
                                            name: '新角色',
                                            type: 'other',
                                            description: '',
                                            age: '',
                                            gender: '',
                                            occupation: '',
                                            personality_traits: [],
                                            character_arc: '',
                                            relationships: {},
                                            key_scenes: []
                                        };
                                        const currentCharacters = outlineSettings.characters || [];
                                        handleSave('characters', [...currentCharacters, newCharacter]);
                                    }}
                                >
                                    <PlusOutlined style={{ fontSize: '24px', color: '#8c8c8c', marginBottom: '8px' }} />
                                    <Text style={{ color: '#8c8c8c' }}>添加新角色</Text>
                                </Card>
                            </Col>
                        )}
                    </Row>
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