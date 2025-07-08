import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, Typography, Tag, Space, Button, message, Spin, Divider } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, EditOutlined, LoadingOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { OutlineSettingsOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { EditableText, EditableArray } from './shared/EditableText';
import { SectionWrapper, ArtifactSchemaType } from './shared';

const { Text } = Typography;

interface OutlineSettingsDisplayProps {
}

export const OutlineSettingsDisplay: React.FC<OutlineSettingsDisplayProps> = ({
}) => {
    const projectData = useProjectData();
    const { projectId } = useParams<{ projectId: string }>();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Get outline settings artifacts
    const outlineSettingsArtifacts = useMemo(() => {
        if (!Array.isArray(projectData.artifacts)) return [];
        const filtered = projectData.artifacts.filter((artifact: any) =>
            artifact.schema_type === 'outline_settings_schema' || artifact.type === 'outline_settings'
        );

        if (filtered.length === 0) {
            return [];
        }

        return filtered;
    }, [projectData.artifacts]);

    // Find the ROOT outline settings artifact (AI-generated) for lineage resolution
    const rootOutlineArtifact = useMemo(() => {
        const aiGenerated = outlineSettingsArtifacts.find((artifact: any) =>
            artifact.origin_type === 'ai_generated'
        );
        return aiGenerated || outlineSettingsArtifacts[0];
    }, [outlineSettingsArtifacts]);

    // Find the latest version of the outline settings artifact (not its descendants)
    const latestOutlineSettingsArtifact = useMemo(() => {
        if (!rootOutlineArtifact) return null;

        // Look for human transforms that edit this outline settings artifact
        if (!Array.isArray(projectData.humanTransforms)) return rootOutlineArtifact;
        if (!Array.isArray(projectData.transformInputs)) return rootOutlineArtifact;

        const humanEditTransforms = projectData.humanTransforms.filter((ht: any) => {
            // Find transform inputs for this human transform
            if (!Array.isArray(projectData.transformInputs)) return false;
            const inputs = projectData.transformInputs.filter((ti: any) => ti.transform_id === ht.transform_id);
            // Check if any input references our root outline artifact
            return inputs.some((input: any) => input.artifact_id === rootOutlineArtifact.id);
        });

        if (humanEditTransforms.length === 0) {
            // No edits, use the original artifact
            return rootOutlineArtifact;
        }

        // Find the latest human edit transform
        const latestEditTransform = humanEditTransforms.sort((a: any, b: any) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
        })[0];

        // Find the output artifact of this transform
        if (!Array.isArray(projectData.transformOutputs)) return null;
        const outputRecord = projectData.transformOutputs.find((to: any) =>
            to.transform_id === latestEditTransform.transform_id
        );

        if (outputRecord) {
            const editedArtifact = projectData.getArtifactById(outputRecord.artifact_id);
            // Verify it's still an outline settings artifact
            if (editedArtifact?.schema_type === 'outline_settings_schema') {
                return editedArtifact;
            }
        }

        // Fallback to original
        return rootOutlineArtifact;
    }, [rootOutlineArtifact, projectData.humanTransforms, projectData.transformInputs, projectData.transformOutputs, projectData.getArtifactById]);

    const isLoading = projectData.isLoading;

    // Use the latest outline settings artifact as the effective artifact
    const effectiveArtifact = latestOutlineSettingsArtifact;

    // Determine if the current artifact is editable
    const isEditable = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Check if it's a user_input type (editable) and is a leaf node (no descendants)
        const isUserInput = effectiveArtifact.origin_type === 'user_input';
        if (!Array.isArray(projectData.transformInputs)) return isUserInput;

        const hasDescendants = projectData.transformInputs.some((input: any) =>
            input.artifact_id === effectiveArtifact.id
        );

        return isUserInput && !hasDescendants;
    }, [effectiveArtifact, projectData.transformInputs]);

    // Check if the current artifact can be made editable (i.e., it's a leaf node)
    const canBecomeEditable = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Check if the effective artifact has descendants
        if (!Array.isArray(projectData.transformInputs)) return true;

        const hasDescendants = projectData.transformInputs.some((input: any) =>
            input.artifact_id === effectiveArtifact.id
        );

        return !hasDescendants;
    }, [effectiveArtifact, projectData.transformInputs]);

    // Check if the artifact comes from a failed transform
    const isFromFailedTransform = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Find the transform that created this artifact
        if (!Array.isArray(projectData.transformOutputs)) return false;
        const outputRecord = projectData.transformOutputs.find((output: any) =>
            output.artifact_id === effectiveArtifact.id
        );

        if (outputRecord) {
            if (!Array.isArray(projectData.transforms)) return false;
            const transform = projectData.transforms.find((t: any) => t.id === outputRecord.transform_id);
            return transform?.status === 'failed';
        }

        return false;
    }, [effectiveArtifact, projectData.transformOutputs, projectData.transforms]);

    // Parse outline settings data from the effective artifact
    const outlineSettings = useMemo(() => {
        if (!effectiveArtifact?.data) {
            return null;
        }

        if (effectiveArtifact.schema_type !== 'outline_settings_schema') {
            return null;
        }

        try {
            let data: any = effectiveArtifact.data;

            // Handle string data (parse as JSON)
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            return data as OutlineSettingsOutput;
        } catch (error) {
            return null;
        }
    }, [effectiveArtifact]);

    // Use ref for outlineSettings to prevent stale closures
    const outlineSettingsRef = useRef(outlineSettings);

    // Update the ref when settings change
    useEffect(() => {
        outlineSettingsRef.current = outlineSettings;
    }, [outlineSettings]);

    // Handle click to create human transform (only once)
    const handleCreateEditableVersion = useCallback(() => {
        if (!rootOutlineArtifact || isCreatingTransform || isEditable) return;

        setIsCreatingTransform(true);
        projectData.createHumanTransform.mutate({
            transformName: 'edit_outline_settings',
            sourceArtifactId: rootOutlineArtifact.id,
            derivationPath: '$',
            fieldUpdates: {}
        }, {
            onSuccess: (response) => {
                setIsCreatingTransform(false);
                message.success('开始编辑剧本框架');
            },
            onError: (error) => {
                setIsCreatingTransform(false);
                message.error(`创建编辑版本失败: ${error.message}`);
            }
        });
    }, [rootOutlineArtifact, isCreatingTransform, isEditable, projectData.createHumanTransform]);

    // Utility function to get editable props with failed transform handling
    const getEditableProps = useCallback((isLocalEditable: boolean = true) => ({
        isEditable: isEditable && !isFromFailedTransform && isLocalEditable,
        style: {
            opacity: isFromFailedTransform ? 0.7 : 1,
            color: isFromFailedTransform ? '#ff4d4f' : '#fff'
        }
    }), [isEditable, isFromFailedTransform]);

    // Handle saving individual fields
    const handleSave = useCallback(async (path: string, newValue: any) => {
        console.log(`[OutlineSettingsDisplay] handleSave called with path: ${path}, newValue:`, newValue);

        // Always get the current effective artifact ID to avoid stale closures
        const currentArtifactId = effectiveArtifact?.id;
        console.log(`[OutlineSettingsDisplay] currentArtifactId:`, currentArtifactId);

        if (!currentArtifactId) {
            console.log(`[OutlineSettingsDisplay] No artifact ID, returning early`);
            return;
        }

        try {
            // Get the FRESH artifact data from project context to avoid stale closures
            const freshArtifact = projectData.getArtifactById(currentArtifactId);
            console.log(`[OutlineSettingsDisplay] freshArtifact:`, freshArtifact);

            if (!freshArtifact?.data) {
                console.log(`[OutlineSettingsDisplay] No fresh artifact data, returning early`);
                return;
            }

            // Parse current data fresh to avoid stale state
            let currentData: any = freshArtifact.data;
            if (typeof currentData === 'string') {
                currentData = JSON.parse(currentData);
            }
            console.log(`[OutlineSettingsDisplay] currentData before update:`, currentData);

            const updatedSettings = { ...currentData };

            // Handle array index paths like "target_audience.core_themes[0]"
            if (path.includes('[') && path.includes(']')) {
                const [basePath, indexStr] = path.split('[');
                const index = parseInt(indexStr.replace(']', ''));

                // Handle different array paths
                if (basePath === 'target_audience.core_themes') {
                    if (!updatedSettings.target_audience?.core_themes) {
                        updatedSettings.target_audience = { ...updatedSettings.target_audience, core_themes: [] };
                    }
                    const newThemes = [...(updatedSettings.target_audience.core_themes || [])];
                    newThemes[index] = newValue;
                    updatedSettings.target_audience.core_themes = newThemes;
                } else if (basePath === 'selling_points') {
                    const newPoints = [...(updatedSettings.selling_points || [])];
                    newPoints[index] = newValue;
                    updatedSettings.selling_points = newPoints;
                } else if (basePath === 'satisfaction_points') {
                    const newPoints = [...(updatedSettings.satisfaction_points || [])];
                    newPoints[index] = newValue;
                    updatedSettings.satisfaction_points = newPoints;
                } else if (basePath === 'setting.key_scenes') {
                    if (!updatedSettings.setting?.key_scenes) {
                        updatedSettings.setting = { ...updatedSettings.setting, key_scenes: [] };
                    }
                    const newScenes = [...(updatedSettings.setting.key_scenes || [])];
                    newScenes[index] = newValue;
                    updatedSettings.setting.key_scenes = newScenes;
                }
            } else {
                // Handle direct array paths like "target_audience.core_themes"
                if (path === 'target_audience.core_themes') {
                    updatedSettings.target_audience = {
                        ...updatedSettings.target_audience,
                        core_themes: Array.isArray(newValue) ? newValue : []
                    };
                } else if (path === 'selling_points') {
                    updatedSettings.selling_points = Array.isArray(newValue) ? newValue : [];
                } else if (path === 'satisfaction_points') {
                    updatedSettings.satisfaction_points = Array.isArray(newValue) ? newValue : [];
                } else if (path === 'setting.key_scenes') {
                    updatedSettings.setting = {
                        ...updatedSettings.setting,
                        key_scenes: Array.isArray(newValue) ? newValue : []
                    };
                } else {
                    // Handle other paths using the existing logic
                    const pathParts = path.split('.');
                    let current: any = updatedSettings;

                    for (let i = 0; i < pathParts.length - 1; i++) {
                        const part = pathParts[i];
                        if (!(part in current)) {
                            current[part] = {};
                        }
                        current = current[part];
                    }

                    const lastPart = pathParts[pathParts.length - 1];
                    current[lastPart] = newValue;
                }
            }

            console.log(`[OutlineSettingsDisplay] updatedSettings after path update:`, updatedSettings);
            console.log(`[OutlineSettingsDisplay] About to call updateArtifact with artifactId: ${currentArtifactId}`);

            await projectData.updateArtifact.mutateAsync({
                artifactId: currentArtifactId,
                data: updatedSettings
            });

            console.log(`[OutlineSettingsDisplay] updateArtifact completed successfully`);

        } catch (error) {
            console.error(`[OutlineSettingsDisplay] Error in handleSave:`, error);
        }
    }, [effectiveArtifact, projectData]);

    // Remove standalone loading state - let the unified workflow system handle this

    // Show placeholder when no outline settings are available
    if (!outlineSettings) {
        return (
            <SectionWrapper
                schemaType={ArtifactSchemaType.OUTLINE_SETTINGS}
                title="剧本框架"
                sectionId="outline-settings"
                artifactId={effectiveArtifact?.id}
            >
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#8c8c8c',
                    border: '1px dashed #434343',
                    borderRadius: '8px',
                    backgroundColor: '#1a1a1a'
                }}>
                    <Text style={{ color: '#8c8c8c' }}>
                        剧本框架将在生成完成后显示
                    </Text>
                </div>
            </SectionWrapper>
        );
    }

    return (
        <SectionWrapper
            schemaType={ArtifactSchemaType.OUTLINE_SETTINGS}
            title="剧本框架"
            sectionId="outline-settings"
            artifactId={effectiveArtifact?.id}
        >
            <div style={{ marginTop: '24px' }}>
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
                        >
                            <div style={{ padding: '40px' }} />
                        </Spin>
                    </div>
                )}

                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: isEditable ? '1px solid #52c41a' : '1px solid #434343',
                        borderRadius: '8px',
                        opacity: isFromFailedTransform ? 0.7 : 1
                    }}
                    styles={{ body: { padding: '24px' } }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '6px',
                                height: '32px',
                                backgroundColor: isEditable ? '#52c41a' : '#434343',
                                borderRadius: '3px'
                            }} />
                            <div>
                                <Text strong style={{
                                    fontSize: '18px',
                                    color: isEditable ? '#52c41a' : '#fff',
                                    display: 'block'
                                }}>
                                    {isEditable ? '📝 编辑剧本框架' : '📖 剧本框架'}
                                </Text>

                            </div>
                        </div>

                        {!isEditable && canBecomeEditable && !isFromFailedTransform && (
                            <Button
                                type="primary"
                                icon={<EditOutlined />}
                                onClick={handleCreateEditableVersion}
                                loading={isCreatingTransform}
                                size="small"
                                style={{
                                    backgroundColor: '#1890ff',
                                    borderColor: '#1890ff'
                                }}
                            >
                                开始编辑
                            </Button>
                        )}
                    </div>

                    {/* Basic Information */}
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                            <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                                📊 基本信息
                            </Text>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本标题：</Text>
                                    <EditableText
                                        value={outlineSettings.title || ''}
                                        path="title"
                                        placeholder="剧本标题"
                                        isEditable={isEditable}
                                        onSave={handleSave}
                                        style={{ fontSize: '14px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本类型：</Text>
                                    <EditableText
                                        value={outlineSettings.genre || ''}
                                        path="genre"
                                        placeholder="剧本类型"
                                        isEditable={isEditable}
                                        onSave={handleSave}
                                        style={{ fontSize: '14px', color: '#fff' }}
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
                                <EditableText
                                    value={outlineSettings.target_audience?.demographic || ''}
                                    path="target_audience.demographic"
                                    placeholder="目标群体"
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    style={{ fontSize: '14px', color: '#fff' }}
                                />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心主题：</Text>
                                <EditableArray
                                    value={outlineSettings.target_audience?.core_themes || []}
                                    path="target_audience.core_themes"
                                    placeholder="每行一个主题..."
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    mode="textarea"
                                />
                            </div>
                        </div>

                        {/* Selling Points */}
                        <div>
                            <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                                <HeartOutlined style={{ marginRight: '8px' }} />
                                卖点
                            </Text>
                            <EditableArray
                                value={outlineSettings.selling_points || []}
                                path="selling_points"
                                placeholder="每行一个卖点..."
                                isEditable={isEditable}
                                onSave={handleSave}
                                mode="textarea"
                            />
                        </div>

                        {/* Satisfaction Points */}
                        <div>
                            <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                                <StarOutlined style={{ marginRight: '8px' }} />
                                爽点
                            </Text>
                            <EditableArray
                                value={outlineSettings.satisfaction_points || []}
                                path="satisfaction_points"
                                placeholder="每行一个爽点..."
                                isEditable={isEditable}
                                onSave={handleSave}
                                mode="textarea"
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
                                <EditableText
                                    value={outlineSettings.setting?.core_setting_summary || ''}
                                    path="setting.core_setting_summary"
                                    placeholder="核心设定"
                                    multiline={true}
                                    rows={3}
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    style={{ fontSize: '14px', color: '#fff', width: '100%' }}
                                />
                            </div>
                            <div>
                                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>关键场景：</Text>
                                <EditableArray
                                    value={outlineSettings.setting?.key_scenes || []}
                                    path="setting.key_scenes"
                                    placeholder="每行一个关键场景..."
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    mode="textarea"
                                />
                            </div>
                        </div>

                        {/* Characters */}
                        <div>
                            <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                                <TeamOutlined style={{ marginRight: '8px' }} />
                                角色设定
                            </Text>
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                {(outlineSettings.characters || []).map((character: any, index: number) => (
                                    <Card
                                        key={index}
                                        size="small"
                                        style={{
                                            backgroundColor: '#262626',
                                            border: '1px solid #434343'
                                        }}
                                        styles={{ body: { padding: '16px' } }}
                                        extra={
                                            isEditable && (
                                                <Button
                                                    type="text"
                                                    icon={<CloseOutlined />}
                                                    size="small"
                                                    onClick={() => {
                                                        const updatedCharacters = outlineSettings.characters.filter((_: any, i: number) => i !== index);
                                                        handleSave('characters', updatedCharacters);
                                                    }}
                                                    style={{ color: '#ff4d4f' }}
                                                />
                                            )
                                        }
                                    >
                                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Text strong style={{ fontSize: '14px', color: '#fff' }}>姓名：</Text>
                                                <EditableText
                                                    value={character.name || ''}
                                                    path={`characters[${index}].name`}
                                                    placeholder="角色姓名"
                                                    isEditable={isEditable}
                                                    onSave={handleSave}
                                                    style={{ fontSize: '14px', color: '#fff' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Text strong style={{ fontSize: '14px', color: '#fff' }}>类型：</Text>
                                                <EditableText
                                                    value={getCharacterTypeLabel(character.type) || ''}
                                                    path={`characters[${index}].type`}
                                                    placeholder="类型"
                                                    isEditable={isEditable}
                                                    onSave={handleSave}
                                                    style={{
                                                        fontSize: '14px',
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        backgroundColor: isEditable ? 'rgba(24, 144, 255, 0.1)' : getCharacterTypeColor(character.type),
                                                        border: isEditable ? '1px solid #1890ff' : 'none',
                                                        color: '#fff'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Text strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>基本信息：</Text>
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
                                                    style={{ fontSize: '14px', color: '#fff', flex: 1 }}
                                                />
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>角色描述：</Text>
                                                <EditableText
                                                    value={character.description || ''}
                                                    path={`characters[${index}].description`}
                                                    placeholder="角色描述"
                                                    multiline={true}
                                                    rows={2}
                                                    isEditable={isEditable}
                                                    onSave={handleSave}
                                                    style={{ fontSize: '14px', color: '#fff', width: '100%' }}
                                                />
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>性格特点：</Text>
                                                <EditableArray
                                                    value={character.personality_traits || []}
                                                    path={`characters[${index}].personality_traits`}
                                                    placeholder="每行一个性格特点..."
                                                    isEditable={isEditable}
                                                    onSave={handleSave}
                                                    mode="textarea"
                                                />
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>成长轨迹：</Text>
                                                <EditableText
                                                    value={character.character_arc || ''}
                                                    path={`characters[${index}].character_arc`}
                                                    placeholder="成长轨迹"
                                                    multiline={true}
                                                    rows={2}
                                                    isEditable={isEditable}
                                                    onSave={handleSave}
                                                    style={{ fontSize: '14px', color: '#fff', width: '100%' }}
                                                />
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>关键场景：</Text>
                                                <EditableArray
                                                    value={character.key_scenes || []}
                                                    path={`characters[${index}].key_scenes`}
                                                    placeholder="每行一个关键场景..."
                                                    isEditable={isEditable}
                                                    onSave={handleSave}
                                                    mode="textarea"
                                                />
                                            </div>
                                        </Space>
                                    </Card>
                                ))}
                                {isEditable && (
                                    <Card
                                        size="small"
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: '2px dashed #434343',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: '120px',
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
                                )}
                            </Space>
                        </div>


                    </Space>
                </Card>
            </div>
        </SectionWrapper>
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