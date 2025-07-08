import React, { useMemo, useEffect, useRef } from 'react';
import { Card, Typography, Space, Alert, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useActionItemsStore } from '../stores/actionItemsStore';
import { computeParamsAndActions } from '../utils/actionComputation';
import ActionItemRenderer from './actions/ActionItemRenderer';

const { Text, Title } = Typography;

interface ActionItemsSectionProps {
    projectId: string;
}

export const ActionItemsSection: React.FC<ActionItemsSectionProps> = ({ projectId }) => {
    const projectData = useProjectData();
    const store = useActionItemsStore(projectId);

    // Use refs to track previous values to prevent unnecessary re-renders
    const prevProjectDataRef = useRef(projectData);
    const prevComputationResultRef = useRef<any>(null);

    // Stable computation with minimal dependencies
    const computationResult = useMemo(() => {
        if (projectData.isLoading) {
            return null;
        }

        if (!Array.isArray(projectData.artifacts) || !Array.isArray(projectData.transforms)) {
            return null;
        }

        // Check if data has actually changed
        const currentData = {
            artifacts: projectData.artifacts,
            transforms: projectData.transforms,
            transformInputs: projectData.transformInputs,
            transformOutputs: projectData.transformOutputs,
            humanTransforms: projectData.humanTransforms
        };

        // Simple deep equality check for arrays
        const dataChanged =
            JSON.stringify(currentData.artifacts) !== JSON.stringify(prevProjectDataRef.current.artifacts) ||
            JSON.stringify(currentData.transforms) !== JSON.stringify(prevProjectDataRef.current.transforms) ||
            JSON.stringify(currentData.transformInputs) !== JSON.stringify(prevProjectDataRef.current.transformInputs) ||
            JSON.stringify(currentData.transformOutputs) !== JSON.stringify(prevProjectDataRef.current.transformOutputs) ||
            JSON.stringify(currentData.humanTransforms) !== JSON.stringify(prevProjectDataRef.current.humanTransforms);

        if (!dataChanged && prevComputationResultRef.current) {
            return prevComputationResultRef.current;
        }

        const result = computeParamsAndActions(projectData);

        prevProjectDataRef.current = projectData;
        prevComputationResultRef.current = result;

        return result;
    }, [
        projectData.isLoading,
        projectData.artifacts?.length,
        projectData.transforms?.length,
        projectData.transformInputs?.length,
        projectData.transformOutputs?.length,
        projectData.humanTransforms?.length
    ]);

    if (projectData.isLoading || !computationResult) {
        return (
            <Card
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #434343',
                    marginTop: '24px'
                }}
            >
                <div style={{ textAlign: 'center', padding: '24px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '16px' }}>
                        <Text type="secondary">分析项目状态...</Text>
                    </div>
                </div>
            </Card>
        );
    }

    const { currentStage, stageDescription, actions } = computationResult;

    // Check for active transforms
    const hasActiveTransforms = Array.isArray(projectData.transforms) &&
        projectData.transforms.some((t: any) => t.status === 'running' || t.status === 'pending');

    return (
        <Card
            style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #52c41a',
                marginTop: '24px'
            }}
            styles={{ body: { padding: '24px' } }}
        >
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                        width: '6px',
                        height: '32px',
                        backgroundColor: '#52c41a',
                        borderRadius: '3px'
                    }} />
                    <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                        🎯 操作面板
                    </Title>
                </div>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                    当前阶段：{currentStage} - {stageDescription}
                </Text>
            </div>

            {/* Loading overlay for active transforms */}
            {hasActiveTransforms && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '6px',
                    border: '1px solid #1890ff'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                        <Text style={{ color: '#1890ff' }}>正在处理中...</Text>
                    </div>
                </div>
            )}

            {/* Actions */}
            {actions.length > 0 ? (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {actions.map((action: any, index: number) => (
                        <ActionItemRenderer
                            key={`${action.type}-${index}`}
                            action={action}
                        />
                    ))}
                </Space>
            ) : (
                <Alert
                    message="暂无可用操作"
                    description="当前项目状态下没有可执行的操作。"
                    type="info"
                    showIcon
                    style={{
                        backgroundColor: '#0a0a0a',
                        borderColor: '#434343'
                    }}
                />
            )}
        </Card>
    );
}; 