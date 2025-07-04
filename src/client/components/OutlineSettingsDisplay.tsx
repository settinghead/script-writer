import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, Typography, Tag, Space, Button, message, Spin, Divider } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, EditOutlined, LoadingOutlined, PlusOutlined, CloseOutlined, HistoryOutlined, BookOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { OutlineSettingsOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';
import { useChroniclesDescendants } from '../hooks/useChroniclesDescendants';
import { EditableText, EditableArray } from './shared/EditableText';

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
        return projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'outline_settings_schema' &&
            artifact.data
        );
    }, [projectData.artifacts]);

    // Find the ROOT outline settings artifact (AI-generated) for lineage resolution
    const rootOutlineArtifact = useMemo(() => {
        if (outlineSettingsArtifacts.length === 0) return null;

        // Find the AI-generated artifact (should be the root of the lineage chain)
        const aiGenerated = outlineSettingsArtifacts.find(artifact =>
            artifact.origin_type === 'ai_generated'
        );

        if (aiGenerated) {
            return aiGenerated;
        }

        // Fallback: if no AI-generated found, sort by creation time and get the earliest
        const sorted = [...outlineSettingsArtifacts].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return sorted[0];
    }, [outlineSettingsArtifacts]);

    // Use lineage resolution starting from the ROOT artifact to find the latest version
    const { latestArtifactId, isLoading: lineageLoading } = useLineageResolution({
        sourceArtifactId: rootOutlineArtifact?.id || null,
        path: '$',
        options: { enabled: !!rootOutlineArtifact?.id }
    });



    // Get the effective artifact (original or edited version)
    const effectiveArtifact = useMemo(() => {
        if (latestArtifactId) {
            const resolved = projectData.getArtifactById(latestArtifactId);
            return resolved;
        }
        return rootOutlineArtifact;
    }, [latestArtifactId, rootOutlineArtifact, projectData.getArtifactById]);

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

    // Check if the artifact comes from a failed transform
    const isFromFailedTransform = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Find the transform that created this artifact
        const outputRecord = projectData.transformOutputs.find(output =>
            output.artifact_id === effectiveArtifact.id
        );

        if (outputRecord) {
            const transform = projectData.transforms.find(t => t.id === outputRecord.transform_id);
            return transform?.status === 'failed';
        }

        return false;
    }, [effectiveArtifact, projectData.transformOutputs, projectData.transforms]);

    // Parse outline settings data from the effective artifact
    const outlineSettings = useMemo(() => {
        console.log('🔍 [OutlineSettingsDisplay] Parsing outline settings:', {
            hasEffectiveArtifact: !!effectiveArtifact,
            artifactId: effectiveArtifact?.id,
            originType: effectiveArtifact?.origin_type,
            hasData: !!effectiveArtifact?.data,
            dataType: typeof effectiveArtifact?.data,
            timestamp: new Date().toISOString()
        });

        if (!effectiveArtifact?.data) {
            console.log('🔍 [OutlineSettingsDisplay] No effective artifact data, returning null');
            return null;
        }

        try {
            let data: any = effectiveArtifact.data;

            // Handle string data (parse as JSON)
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            console.log('🔍 [OutlineSettingsDisplay] Parsed outline settings data:', {
                artifactId: effectiveArtifact.id,
                dataKeys: Object.keys(data),
                sellingPointsLength: data.selling_points?.length || 0,
                satisfactionPointsLength: data.satisfaction_points?.length || 0,
                coreThemesLength: data.target_audience?.core_themes?.length || 0,
                keyScenesLength: data.setting?.key_scenes?.length || 0
            });

            // Now both original LLM artifacts and human-created artifacts store outline settings directly
            return data as OutlineSettingsOutput;
        } catch (error) {
            console.error('❌ [OutlineSettingsDisplay] Failed to parse outline settings data:', error);
            return null;
        }
    }, [effectiveArtifact]);

    // Use ref for outlineSettings to prevent stale closures
    const outlineSettingsRef = useRef(outlineSettings);

    // Update the ref when settings change
    useEffect(() => {
        outlineSettingsRef.current = outlineSettings;
    }, [outlineSettings]);

    // Debug: Track component lifecycle and key state changes
    useEffect(() => {
        console.log('🔍 [OutlineSettingsDisplay] Component mounted or key dependencies changed:', {
            hasOutlineSettings: !!outlineSettings,
            isEditable,
            latestArtifactId,
            effectiveArtifactId: effectiveArtifact?.id,
            timestamp: new Date().toISOString()
        });
    }, [outlineSettings, isEditable, latestArtifactId, effectiveArtifact?.id]);

    // Check for chronicles descendants (use effectiveArtifact ID for the check)
    const { hasChroniclesDescendants, latestChronicles, isLoading: chroniclesLoading } = useChroniclesDescendants(
        effectiveArtifact?.id || ''
    );

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
                console.error('[OutlineSettingsDisplay] Human transform creation failed:', error);
                setIsCreatingTransform(false);
                message.error(`创建编辑版本失败: ${error.message}`);
            }
        });
    }, [rootOutlineArtifact, isCreatingTransform, isEditable, projectData.createHumanTransform]);

    // Chronicles generation mutation
    const chroniclesGenerationMutation = useMutation({
        mutationFn: async (params: {
            sourceArtifactId: string;
            requirements?: string;
        }) => {
            const agentRequest = {
                userRequest: `基于outline settings artifact ID ${params.sourceArtifactId} 生成详细的时间顺序大纲。${params.requirements ? `特殊要求：${params.requirements}` : ''}`,
                projectId: projectId!
            };

            const response = await fetch(`/api/projects/${projectId}/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                body: JSON.stringify(agentRequest)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate chronicles');
            }

            return response.json();
        },
        onSuccess: () => {
            message.success('时间顺序大纲生成已开始！请稍后查看进度。');
        },
        onError: (error) => {
            message.error(`生成时间顺序大纲失败：${error.message}`);
        }
    });

    // Handle chronicles generation
    const handleGenerateChronicles = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent event bubbling to card container
        if (!effectiveArtifact?.id || chroniclesGenerationMutation.isPending) return;

        console.log(`[OutlineSettingsDisplay] Generating chronicles for artifact: ${effectiveArtifact.id} (origin: ${effectiveArtifact.origin_type})`);

        chroniclesGenerationMutation.mutate({
            sourceArtifactId: effectiveArtifact.id
        });
    }, [effectiveArtifact?.id, chroniclesGenerationMutation]);

    // Handle view chronicles
    const handleViewChronicles = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent any potential event bubbling
        if (latestChronicles) {
            // Scroll to the chronicles section
            const chroniclesSection = document.getElementById('story-chronicles');
            if (chroniclesSection) {
                chroniclesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [latestChronicles]);

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
        console.log('🔍 [OutlineSettingsDisplay] handleSave called:', {
            path,
            newValue,
            newValueType: typeof newValue,
            isArray: Array.isArray(newValue),
            arrayLength: Array.isArray(newValue) ? newValue.length : 'N/A',
            latestArtifactId,
            timestamp: new Date().toISOString()
        });

        // Always get the current effective artifact to avoid stale closures
        const currentArtifact = latestArtifactId ?
            projectData.getArtifactById(latestArtifactId) :
            rootOutlineArtifact;

        if (!currentArtifact?.data) {
            console.error('[OutlineSettingsDisplay] No current artifact data available for save');
            return;
        }

        console.log('🔍 [OutlineSettingsDisplay] Current artifact data before save:', {
            artifactId: currentArtifact.id,
            originType: currentArtifact.origin_type,
            dataKeys: Object.keys(currentArtifact.data),
            relevantField: path.includes('.') ?
                path.split('.').reduce((obj: any, key: string) => obj?.[key], currentArtifact.data) :
                (currentArtifact.data as any)[path]
        });

        try {
            // Parse current data fresh to avoid stale state
            let currentData: any = currentArtifact.data;
            if (typeof currentData === 'string') {
                currentData = JSON.parse(currentData);
            }

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

            console.log('🔍 [OutlineSettingsDisplay] About to save updated settings:', {
                artifactId: currentArtifact.id,
                path,
                updatedSettingsKeys: Object.keys(updatedSettings),
                updatedFieldValue: path.includes('.') ?
                    path.split('.').reduce((obj: any, key: string) => obj?.[key], updatedSettings) :
                    (updatedSettings as any)[path]
            });

            await projectData.updateArtifact.mutateAsync({
                artifactId: currentArtifact.id,
                data: updatedSettings
            });

            console.log('✅ [OutlineSettingsDisplay] Save completed successfully for path:', path);
        } catch (error) {
            console.error('❌ [OutlineSettingsDisplay] Save failed:', { error, path, newValue, artifactId: currentArtifact?.id });
        }
    }, [latestArtifactId, rootOutlineArtifact, projectData]);



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
                style={{
                    backgroundColor: '#1f1f1f',
                    border: isEditable ? '2px solid #52c41a' : '2px solid transparent',
                    borderRadius: '8px',
                    position: 'relative' as const
                }}
                styles={{ body: { padding: '24px' } }}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isEditable ? '#52c41a' : isFromFailedTransform ? '#ff4d4f' : '#fff' }}>
                            {isEditable && <EditOutlined />}
                            {isFromFailedTransform && <span style={{ fontSize: '14px' }}>⚠️</span>}
                            <span>剧本框架{isEditable ? ' (可编辑)' : isFromFailedTransform ? ' (生成失败)' : ''}</span>
                        </div>
                        {isFromFailedTransform ? (
                            <div style={{ color: '#ff4d4f', fontSize: '12px', fontStyle: 'italic' }}>
                                生成过程中出现错误，请重新生成
                            </div>
                        ) : !isEditable && !isCreatingTransform && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={handleCreateEditableVersion}
                                style={{
                                    backgroundColor: '#1890ff',
                                    border: 'none',
                                    borderRadius: '4px'
                                }}
                            >
                                编辑
                            </Button>
                        )}
                    </div>
                }
            >
                {/* Header Section */}
                <div style={{ marginBottom: '24px', textAlign: 'center', borderBottom: '1px solid #434343', paddingBottom: '16px' }}>
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Text strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>剧本标题：</Text>
                        <EditableText
                            value={outlineSettings.title || ''}
                            path="title"
                            placeholder="剧本标题"
                            isEditable={isEditable && !isFromFailedTransform}
                            onSave={handleSave}
                            style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: isFromFailedTransform ? '#ff4d4f' : '#fff',
                                minHeight: '28px',
                                textAlign: 'center',
                                flex: 1,
                                opacity: isFromFailedTransform ? 0.7 : 1
                            }}
                        />
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Text strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>剧本类型：</Text>
                        <EditableText
                            value={outlineSettings.genre || ''}
                            path="genre"
                            placeholder="剧本类型"
                            isEditable={isEditable && !isFromFailedTransform}
                            onSave={handleSave}
                            style={{
                                fontSize: '14px',
                                padding: '4px 12px',
                                borderRadius: '16px',
                                backgroundColor: isFromFailedTransform ? 'rgba(255, 77, 79, 0.1)' : isEditable ? 'rgba(138, 43, 226, 0.1)' : '#722ed1',
                                border: isFromFailedTransform ? '1px solid #ff4d4f' : isEditable ? '1px solid #722ed1' : 'none',
                                color: isFromFailedTransform ? '#ff4d4f' : '#fff',
                                display: 'inline-block',
                                minWidth: '80px',
                                textAlign: 'center',
                                opacity: isFromFailedTransform ? 0.7 : 1
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
                                {...getEditableProps()}
                                onSave={handleSave}
                                style={{ marginLeft: '8px', ...getEditableProps().style }}
                            />
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            <Text strong>核心主题：</Text>
                            <div style={{ marginTop: '4px' }}>
                                <EditableArray
                                    value={outlineSettings.target_audience?.core_themes || []}
                                    path="target_audience.core_themes"
                                    placeholder="每行一个核心主题..."
                                    {...getEditableProps()}
                                    onSave={handleSave}
                                    mode="textarea"
                                />
                            </div>
                        </div>
                    </Space>
                </Card>

                {/* Selling Points */}
                <Card
                    size="small"
                    title={<span><StarOutlined /> 产品卖点</span>}
                    style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <EditableArray
                        value={outlineSettings.selling_points || []}
                        path="selling_points"
                        placeholder="每行一个卖点..."
                        {...getEditableProps()}
                        onSave={handleSave}
                        mode="textarea"
                    />
                </Card>

                {/* Satisfaction Points */}
                <Card
                    size="small"
                    title={<span><HeartOutlined /> 情感爽点</span>}
                    style={{ marginBottom: '16px', backgroundColor: '#262626', border: '1px solid #434343' }}
                >
                    <EditableArray
                        value={outlineSettings.satisfaction_points || []}
                        path="satisfaction_points"
                        placeholder="每行一个爽点..."
                        {...getEditableProps()}
                        onSave={handleSave}
                        mode="textarea"
                    />
                </Card>

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
                                    placeholder="每行一个关键场景..."
                                    isEditable={isEditable}
                                    onSave={handleSave}
                                    mode="textarea"
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
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        {outlineSettings.characters && outlineSettings.characters.map((character: any, index: number) => (
                            <Card
                                key={index}
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
                                        <Text strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>角色姓名：</Text>
                                        <EditableText
                                            value={character.name || ''}
                                            path={`characters[${index}].name`}
                                            placeholder="角色姓名"
                                            isEditable={isEditable}
                                            onSave={handleSave}
                                            style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', flex: 1 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Text strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>角色类型：</Text>
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
                </Card>

                {/* Chronicles Generation Section */}
                <Divider style={{ borderColor: '#434343', margin: '24px 0' }} />

                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    {hasChroniclesDescendants && latestChronicles ? (
                        <Space direction="vertical" size="large">
                            <div>
                                <Tag color="purple" icon={<HistoryOutlined />} style={{ marginBottom: '12px' }}>
                                    {latestChronicles.title || '时间顺序大纲'}
                                </Tag>
                            </div>
                            <Button
                                type="primary"
                                size="large"
                                icon={<BookOutlined />}
                                onClick={handleViewChronicles}
                                style={{
                                    background: 'linear-gradient(100deg, #722ed1, #9254de)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '16px 32px',
                                    fontSize: '16px',
                                    height: 'auto'
                                }}
                            >
                                查看时间顺序大纲 &gt;&gt;
                            </Button>
                        </Space>
                    ) : (
                        <Button
                            type="primary"
                            size="large"
                            icon={<HistoryOutlined />}
                            onClick={handleGenerateChronicles}
                            loading={chroniclesGenerationMutation.isPending}
                            disabled={!effectiveArtifact?.id || chroniclesGenerationMutation.isPending || isFromFailedTransform}
                            style={{
                                background: isFromFailedTransform ? '#666' : 'linear-gradient(100deg, #ff7a45, #f5222d)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '16px 32px',
                                fontSize: '16px',
                                height: 'auto',
                                opacity: isFromFailedTransform ? 0.5 : 1
                            }}
                        >
                            {isFromFailedTransform ? '剧本框架生成失败，无法继续' : chroniclesGenerationMutation.isPending ? '生成中...' : '生成时间顺序大纲 &gt;&gt;'}
                        </Button>
                    )}
                </div>
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