import React, { useMemo, useState, useCallback } from 'react';
import { Card, Typography, Space, Tag, List, Collapse, Button, message } from 'antd';
import { HeartOutlined, TeamOutlined, BulbOutlined, ClockCircleOutlined, ThunderboltOutlined, EditOutlined } from '@ant-design/icons';
import { ChroniclesStage } from '../../common/schemas/outlineSchemas';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { EditableText } from './shared/EditableText';

const { Text, Paragraph, Title } = Typography;

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
    const {
        latestArtifactId,
        hasLineage,
        isLoading,
        error
    } = useLineageResolution({
        sourceArtifactId: chroniclesArtifactId,
        path: stagePath,
        options: { enabled: !!chroniclesArtifactId }
    });

    // Get the effective artifact (either original or edited version)
    const effectiveArtifact = useMemo(() => {
        if (!latestArtifactId) return null;
        return projectData.artifacts.find(a => a.id === latestArtifactId);
    }, [latestArtifactId, projectData.artifacts]);

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
                return parsedData.stages[stageIndex] as ChroniclesStage;
            }

            return null;
        } catch (error) {
            console.warn('Failed to parse stage data:', error);
            return null;
        }
    }, [effectiveArtifact, stageIndex]);

    // Determine if the current stage is editable
    const isEditable = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Check if it's a user_input type (editable) and is a leaf node (no descendants)
        const isUserInput = effectiveArtifact.origin_type === 'user_input';
        const hasDescendants = projectData.transformInputs.some(input =>
            input.artifact_id === effectiveArtifact.id
        );

        return isUserInput && !hasDescendants;
    }, [effectiveArtifact, projectData.transformInputs]);

    // Check if the stage can be made editable
    const canBecomeEditable = useMemo(() => {
        if (!effectiveArtifact) return false;

        // Check if the effective artifact has descendants
        const hasDescendants = projectData.transformInputs.some(input =>
            input.artifact_id === effectiveArtifact.id
        );

        return !hasDescendants;
    }, [effectiveArtifact, projectData.transformInputs]);

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

    // Handle saving individual fields
    const handleSave = useCallback(async (path: string, newValue: any) => {
        if (!effectiveArtifact?.data) {
            console.error('[ChronicleStageCard] No effective artifact data available for save');
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

            console.log('✅ [ChronicleStageCard] Save completed successfully for path:', path);
        } catch (error) {
            console.error('❌ [ChronicleStageCard] Save failed:', { error, path, newValue, artifactId: effectiveArtifact?.id });
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
                marginBottom: '16px'
            }}
            styles={{ body: { padding: '20px' } }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag color="blue" icon={<ClockCircleOutlined />}>
                            第 {stageIndex + 1} 阶段
                        </Tag>
                        {hasLineage && (
                            <Tag color="green">已编辑</Tag>
                        )}
                    </div>
                    {!isEditable && !isCreatingTransform && canBecomeEditable && (
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
                    {stageData.emotionArcs && stageData.emotionArcs.length > 0 && (
                        <div>
                            <Space align="center" style={{ marginBottom: '8px' }}>
                                <HeartOutlined style={{ color: '#f759ab' }} />
                                <Text strong style={{ color: '#f759ab' }}>情感发展</Text>
                            </Space>
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
                        </div>
                    )}

                    {/* Relationship Developments */}
                    {stageData.relationshipDevelopments && stageData.relationshipDevelopments.length > 0 && (
                        <div>
                            <Space align="center" style={{ marginBottom: '8px' }}>
                                <TeamOutlined style={{ color: '#52c41a' }} />
                                <Text strong style={{ color: '#52c41a' }}>关系发展</Text>
                            </Space>
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
                        </div>
                    )}

                    {/* Key Insights */}
                    {stageData.insights && stageData.insights.length > 0 && (
                        <div>
                            <Space align="center" style={{ marginBottom: '8px' }}>
                                <BulbOutlined style={{ color: '#fadb14' }} />
                                <Text strong style={{ color: '#fadb14' }}>关键洞察</Text>
                            </Space>
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
                        </div>
                    )}
                </div>
            </Collapse>
        </Card>
    );
}; 