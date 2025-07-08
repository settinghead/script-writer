import React, { useState, useCallback, useMemo } from 'react';
import { Card, Typography, Space, Tag, List, Collapse, Button, message, Form, Input, Select } from 'antd';
import { HeartOutlined, TeamOutlined, BulbOutlined, ClockCircleOutlined, ThunderboltOutlined, EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ChroniclesStage } from '../../common/schemas/outlineSchemas';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { EditableText, EditableArray } from './shared/EditableText';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

interface EmotionArc {
    characters: string[];
    content: string;
}

interface RelationshipDevelopment {
    characters: string[];
    content: string;
}

interface EditableEmotionArcsProps {
    value: EmotionArc[];
    onChange: (value: EmotionArc[]) => void;
    availableCharacters: string[];
}

const EditableEmotionArcs: React.FC<EditableEmotionArcsProps> = ({ value, onChange, availableCharacters }) => {
    const addEmotionArc = () => {
        onChange([...value, { characters: [], content: '' }]);
    };

    const removeEmotionArc = (index: number) => {
        const newValue = value.filter((_, i) => i !== index);
        onChange(newValue);
    };

    const updateEmotionArc = (index: number, field: keyof EmotionArc, fieldValue: any) => {
        const newValue = [...value];
        newValue[index] = { ...newValue[index], [field]: fieldValue };
        onChange(newValue);
    };

    return (
        <div>
            {value.map((arc, index) => (
                <div key={index} style={{ marginBottom: '12px', padding: '12px', border: '1px solid #434343', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Text strong style={{ color: '#f759ab' }}>情感发展 {index + 1}</Text>
                        <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeEmotionArc(index)}
                            style={{ color: '#ff4d4f' }}
                        />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <Text style={{ color: '#fff', fontSize: '12px' }}>涉及角色:</Text>
                        <Select
                            mode="multiple"
                            placeholder="选择角色"
                            value={arc.characters}
                            onChange={(chars) => updateEmotionArc(index, 'characters', chars)}
                            style={{ width: '100%', marginTop: '4px' }}
                            options={availableCharacters.map(char => ({ label: char, value: char }))}
                        />
                    </div>
                    <div>
                        <Text style={{ color: '#fff', fontSize: '12px' }}>情感发展内容:</Text>
                        <TextArea
                            value={arc.content}
                            onChange={(e) => updateEmotionArc(index, 'content', e.target.value)}
                            placeholder="描述角色的情感发展变化"
                            rows={2}
                            style={{ marginTop: '4px' }}
                        />
                    </div>
                </div>
            ))}
            <Button
                type="dashed"
                onClick={addEmotionArc}
                icon={<PlusOutlined />}
                style={{ width: '100%', marginTop: '8px' }}
            >
                添加情感发展
            </Button>
        </div>
    );
};

interface EditableRelationshipDevelopmentsProps {
    value: RelationshipDevelopment[];
    onChange: (value: RelationshipDevelopment[]) => void;
    availableCharacters: string[];
}

const EditableRelationshipDevelopments: React.FC<EditableRelationshipDevelopmentsProps> = ({ value, onChange, availableCharacters }) => {
    const addRelationshipDevelopment = () => {
        onChange([...value, { characters: [], content: '' }]);
    };

    const removeRelationshipDevelopment = (index: number) => {
        const newValue = value.filter((_, i) => i !== index);
        onChange(newValue);
    };

    const updateRelationshipDevelopment = (index: number, field: keyof RelationshipDevelopment, fieldValue: any) => {
        const newValue = [...value];
        newValue[index] = { ...newValue[index], [field]: fieldValue };
        onChange(newValue);
    };

    return (
        <div>
            {value.map((rel, index) => (
                <div key={index} style={{ marginBottom: '12px', padding: '12px', border: '1px solid #434343', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Text strong style={{ color: '#52c41a' }}>关系发展 {index + 1}</Text>
                        <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeRelationshipDevelopment(index)}
                            style={{ color: '#ff4d4f' }}
                        />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <Text style={{ color: '#fff', fontSize: '12px' }}>涉及角色:</Text>
                        <Select
                            mode="multiple"
                            placeholder="选择角色"
                            value={rel.characters}
                            onChange={(chars) => updateRelationshipDevelopment(index, 'characters', chars)}
                            style={{ width: '100%', marginTop: '4px' }}
                            options={availableCharacters.map(char => ({ label: char, value: char }))}
                        />
                    </div>
                    <div>
                        <Text style={{ color: '#fff', fontSize: '12px' }}>关系发展内容:</Text>
                        <TextArea
                            value={rel.content}
                            onChange={(e) => updateRelationshipDevelopment(index, 'content', e.target.value)}
                            placeholder="描述角色之间的关系发展变化"
                            rows={2}
                            style={{ marginTop: '4px' }}
                        />
                    </div>
                </div>
            ))}
            <Button
                type="dashed"
                onClick={addRelationshipDevelopment}
                icon={<PlusOutlined />}
                style={{ width: '100%', marginTop: '8px' }}
            >
                添加关系发展
            </Button>
        </div>
    );
};

interface ChronicleStageCardProps {
    chroniclesArtifactId: string;
    stagePath: string; // JSONPath like "$.stages[0]"
    stageIndex: number; // For display purposes only
}

export const ChronicleStageCard: React.FC<ChronicleStageCardProps> = ({
    chroniclesArtifactId,
    stagePath,
    stageIndex
}) => {
    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Resolve lineage for this specific stage
    const resolutionResult = useLineageResolution({
        sourceArtifactId: chroniclesArtifactId,
        path: stagePath,
        options: { enabled: !!chroniclesArtifactId }
    });

    if (resolutionResult === "pending" || resolutionResult === "error") {
        return null;
    }

    const {
        latestArtifactId,
        hasLineage,
        isLoading,
        error
    } = resolutionResult;

    // Get the effective artifact (either original or edited version)
    const effectiveArtifact = useMemo(() => {
        if (!latestArtifactId) return null;
        if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
            return null;
        }
        const artifact = projectData.artifacts.find(a => a.id === latestArtifactId);

        return artifact;
    }, [latestArtifactId, projectData.artifacts, stageIndex]);

    // Parse stage data from the effective artifact
    const stageData = useMemo(() => {
        if (!effectiveArtifact) return null;

        try {
            const parsedData = JSON.parse(effectiveArtifact.data);

            // If this is a user_input artifact for a specific stage, the data is the stage itself
            if (effectiveArtifact.origin_type === 'user_input') {
                return parsedData as ChroniclesStage;
            }

            // If this is the original chronicles artifact, extract the stage by index
            if (parsedData.stages && parsedData.stages[stageIndex]) {
                const stageAtIndex = parsedData.stages[stageIndex];
                return stageAtIndex as ChroniclesStage;
            }

            return null;
        } catch (error) {
            return null;
        }
    }, [effectiveArtifact, stageIndex]);

    // Determine if the current stage is editable
    const isEditable = useMemo(() => {
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }
        if (!effectiveArtifact) return false;

        // Only editable if:
        // 1. The effective artifact is a user_input type (meaning it was created by human transform)
        // 2. The effective artifact is a chronicle_stage_schema (individual stage, not full chronicles)
        // 3. It has no descendants (it's a leaf node)
        const isUserInput = effectiveArtifact.origin_type === 'user_input';
        const isStageArtifact = effectiveArtifact.schema_type === 'chronicle_stage_schema';
        const hasDescendants = projectData.transformInputs.some(input =>
            input.artifact_id === effectiveArtifact.id
        );

        const result = isUserInput && isStageArtifact && !hasDescendants;

        return result;
    }, [effectiveArtifact, projectData.transformInputs, stageIndex]);

    // Check if the stage can be made editable
    const canBecomeEditable = useMemo(() => {
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }
        if (!effectiveArtifact) return false;

        // A stage can become editable if:
        // 1. It's not already editable, AND
        // 2. This specific stage path hasn't been edited yet (no path-specific lineage)

        // If we already resolved to a user_input artifact for this stage, it means this stage path
        // has already been edited and we can't create another edit
        if (effectiveArtifact.origin_type === 'user_input' && effectiveArtifact.schema_type === 'chronicle_stage_schema') {
            return false;
        }

        // If we resolved to the original chronicles artifact, this stage path hasn't been edited yet
        // and can become editable (regardless of whether other stage paths have been edited)
        if (effectiveArtifact.schema_type === 'chronicles_schema' && effectiveArtifact.origin_type === 'ai_generated') {
            return true;
        }

        return false;
    }, [effectiveArtifact]);

    // Handle creating an editable version of this stage
    const handleCreateEditableVersion = useCallback(() => {
        if (!chroniclesArtifactId || isCreatingTransform || isEditable) return;

        setIsCreatingTransform(true);
        projectData.createHumanTransform.mutate({
            transformName: 'edit_chronicles_stage',
            sourceArtifactId: chroniclesArtifactId,
            derivationPath: stagePath,
            fieldUpdates: {}
        }, {
            onSuccess: (response) => {
                setIsCreatingTransform(false);
                message.success(`阶段 ${stageIndex + 1} 开始编辑`);
            },
            onError: (error) => {
                setIsCreatingTransform(false);
                message.error(`创建编辑版本失败: ${error.message}`);
            }
        });
    }, [chroniclesArtifactId, stagePath, stageIndex, isCreatingTransform, isEditable, projectData.createHumanTransform]);

    // Extract available characters from project data
    const availableCharacters = useMemo(() => {
        if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
            return [];
        }

        // Look for outline artifacts to extract character names
        const outlineArtifacts = projectData.artifacts.filter(a =>
            a.schema_type === 'outline_schema' || a.schema_type === 'outline_input_schema'
        );

        const characters: string[] = [];

        outlineArtifacts.forEach(artifact => {
            try {
                const data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                if (data.characters && Array.isArray(data.characters)) {
                    data.characters.forEach((char: any) => {
                        if (char.name && !characters.includes(char.name)) {
                            characters.push(char.name);
                        }
                    });
                }
            } catch (error) {
                // Ignore parsing errors
            }
        });

        return characters;
    }, [projectData.artifacts]);

    // Handle saving individual fields
    const handleSave = useCallback(async (path: string, newValue: any) => {
        if (!effectiveArtifact?.data) {
            return;
        }

        try {
            // Parse current data fresh to avoid stale state
            let currentData: any = effectiveArtifact.data;
            if (typeof currentData === 'string') {
                currentData = JSON.parse(currentData);
            }

            const updatedStage = { ...currentData };

            // Update the specific field
            const pathParts = path.split('.');
            let current: any = updatedStage;

            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                if (!(part in current)) {
                    current[part] = {};
                }
                current = current[part];
            }

            const lastPart = pathParts[pathParts.length - 1];
            current[lastPart] = newValue;

            await projectData.updateArtifact.mutateAsync({
                artifactId: effectiveArtifact.id,
                data: updatedStage
            });

        } catch (error) {
        }
    }, [effectiveArtifact, projectData]);

    if (isLoading) {
        return (
            <Card
                style={{
                    backgroundColor: '#262626',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}
                loading
            />
        );
    }

    if (error || !stageData) {
        return (
            <Card
                style={{
                    backgroundColor: '#262626',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}
            >
                <Text type="danger">加载阶段数据时出错</Text>
            </Card>
        );
    }

    return (
        <Card
            style={{
                backgroundColor: '#262626',
                border: isEditable ? '2px solid #52c41a' : '1px solid #434343',
                borderRadius: '8px',
                marginBottom: '16px',
                cursor: (!isEditable && !isCreatingTransform && canBecomeEditable) ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
            }}
            styles={{ body: { padding: '20px' } }}
            onClick={(!isEditable && !isCreatingTransform && canBecomeEditable) ? handleCreateEditableVersion : undefined}
            onMouseEnter={(e) => {
                if (!isEditable && !isCreatingTransform && canBecomeEditable) {
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(24, 144, 255, 0.3)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isEditable && !isCreatingTransform && canBecomeEditable) {
                    e.currentTarget.style.borderColor = '#434343';
                    e.currentTarget.style.boxShadow = 'none';
                }
            }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag color="blue" icon={<ClockCircleOutlined />}>
                            第 {stageIndex + 1} 阶段
                        </Tag>
                        {hasLineage && (
                            <Tag color="green">已编辑</Tag>
                        )}
                        {(!isEditable && !isCreatingTransform && canBecomeEditable) && (
                            <Tag color="orange" style={{ fontSize: '12px' }}>
                                点击编辑
                            </Tag>
                        )}
                    </div>
                    {!isEditable && !isCreatingTransform && canBecomeEditable && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent card click when button is clicked
                                handleCreateEditableVersion();
                            }}
                            style={{
                                backgroundColor: '#1890ff',
                                border: 'none',
                                borderRadius: '4px'
                            }}
                        >
                            编辑阶段
                        </Button>
                    )}
                </div>
            }
        >
            {/* Stage Title */}
            <div style={{ marginBottom: '16px' }}>
                <EditableText
                    value={stageData?.title || ''}
                    path="title"
                    placeholder="阶段标题"
                    isEditable={isEditable}
                    onSave={handleSave}
                    style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#1890ff',
                        minHeight: '24px'
                    }}
                />
            </div>

            {/* Stage Synopsis */}
            <div style={{ marginBottom: '16px' }}>
                <EditableText
                    value={stageData?.stageSynopsis || ''}
                    path="stageSynopsis"
                    placeholder="阶段概述"
                    multiline={true}
                    rows={3}
                    isEditable={isEditable}
                    onSave={handleSave}
                    style={{
                        fontSize: '14px',
                        color: '#fff',
                        lineHeight: 1.6,
                        width: '100%'
                    }}
                />
            </div>

            {/* Core Event */}
            <div style={{ marginBottom: '16px' }}>
                <Space align="center" style={{ marginBottom: '8px' }}>
                    <ThunderboltOutlined style={{ color: '#faad14' }} />
                    <Text strong style={{ color: '#faad14' }}>核心事件</Text>
                </Space>

                <div style={{ paddingLeft: '20px' }}>
                    <EditableText
                        value={stageData?.event || ''}
                        path="event"
                        placeholder="核心事件描述"
                        multiline={true}
                        rows={2}
                        isEditable={isEditable}
                        onSave={handleSave}
                        style={{
                            fontSize: '14px',
                            color: '#fff',
                            lineHeight: 1.6,
                            width: '100%'
                        }}
                    />
                </div>
            </div>

            {/* Expandable Details (Read-only for now) */}
            <Collapse
                ghost
                size="small"
                style={{ backgroundColor: 'transparent' }}
                expandIconPosition="end"
            >
                <div style={{ width: '100%' }}>
                    {/* Emotion Arcs */}
                    <div style={{ marginBottom: '16px' }}>
                        <Space align="center" style={{ marginBottom: '8px' }}>
                            <HeartOutlined style={{ color: '#f759ab' }} />
                            <Text strong style={{ color: '#f759ab' }}>情感发展</Text>
                        </Space>

                        {isEditable ? (
                            <div style={{ paddingLeft: '20px' }}>
                                <EditableEmotionArcs
                                    value={stageData.emotionArcs || []}
                                    onChange={(newValue) => handleSave('emotionArcs', newValue)}
                                    availableCharacters={availableCharacters}
                                />
                            </div>
                        ) : (
                            stageData.emotionArcs && stageData.emotionArcs.length > 0 && (
                                <List
                                    size="small"
                                    dataSource={stageData.emotionArcs}
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
                            )
                        )}
                    </div>

                    {/* Relationship Developments */}
                    <div style={{ marginBottom: '16px' }}>
                        <Space align="center" style={{ marginBottom: '8px' }}>
                            <TeamOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ color: '#52c41a' }}>关系发展</Text>
                        </Space>

                        {isEditable ? (
                            <div style={{ paddingLeft: '20px' }}>
                                <EditableRelationshipDevelopments
                                    value={stageData.relationshipDevelopments || []}
                                    onChange={(newValue) => handleSave('relationshipDevelopments', newValue)}
                                    availableCharacters={availableCharacters}
                                />
                            </div>
                        ) : (
                            stageData.relationshipDevelopments && stageData.relationshipDevelopments.length > 0 && (
                                <List
                                    size="small"
                                    dataSource={stageData.relationshipDevelopments}
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
                            )
                        )}
                    </div>

                    {/* Key Insights */}
                    <div style={{ marginBottom: '16px' }}>
                        <Space align="center" style={{ marginBottom: '8px' }}>
                            <BulbOutlined style={{ color: '#fadb14' }} />
                            <Text strong style={{ color: '#fadb14' }}>关键洞察</Text>
                        </Space>

                        {isEditable ? (
                            <div style={{ paddingLeft: '20px' }}>
                                <EditableArray
                                    value={stageData.insights || []}
                                    path="insights"
                                    placeholder="关键洞察描述"
                                    isEditable={isEditable}
                                    mode="textarea"
                                    onSave={async (path, newValue) => {
                                        await handleSave(path, newValue);
                                    }}
                                />
                            </div>
                        ) : (
                            stageData.insights && stageData.insights.length > 0 && (
                                <List
                                    size="small"
                                    dataSource={stageData.insights}
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
                            )
                        )}
                    </div>
                </div>
            </Collapse>
        </Card>
    );
}; 