import React, { useMemo, useEffect, useRef } from 'react';
import { Card, Typography, Space, Alert, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useActionItemsStore } from '../stores/actionItemsStore';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';
import ActionItemRenderer from './actions/ActionItemRenderer';

const { Text, Title } = Typography;

interface ActionItemsSectionProps {
    projectId: string;
}

export const ActionItemsSection: React.FC<ActionItemsSectionProps> = ({ projectId }) => {
    console.log('🔄 ActionItemsSection render - projectId:', projectId);

    const projectData = useProjectData();
    const store = useActionItemsStore(projectId);

    // Use refs to track previous values to prevent unnecessary re-renders
    const prevProjectDataRef = useRef(projectData);
    const prevComputationResultRef = useRef<any>(null);
    const renderCountRef = useRef(0);

    // Track render count to detect infinite loops
    renderCountRef.current += 1;
    console.log('📊 ActionItemsSection render count:', renderCountRef.current);

    // Alert if we're rendering too frequently
    if (renderCountRef.current > 50) {
        console.error('🚨 ActionItemsSection: Too many renders detected! Possible infinite loop.');
        // Reset counter to prevent spam
        renderCountRef.current = 0;
    }

    // Log store state changes
    useEffect(() => {
        console.log('🏪 Store state changed:', {
            selectedBrainstormIdea: store.selectedBrainstormIdea,
            formDataKeys: Object.keys(store.formData)
        });
    }, [store.selectedBrainstormIdea, store.formData]);

    // Stable computation with minimal dependencies
    const computationResult = useMemo(() => {
        console.log('🧮 Computing actions and params...');
        console.log('📊 Project data state:', {
            isLoading: projectData.isLoading,
            artifactsType: typeof projectData.artifacts,
            artifactsLength: Array.isArray(projectData.artifacts) ? projectData.artifacts.length : 'N/A',
            transformsType: typeof projectData.transforms,
            transformsLength: Array.isArray(projectData.transforms) ? projectData.transforms.length : 'N/A'
        });

        if (projectData.isLoading) {
            console.log('⏳ Project data is loading, skipping computation');
            return null;
        }

        if (!Array.isArray(projectData.artifacts) || !Array.isArray(projectData.transforms)) {
            console.log('❌ Project data not ready');
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
            console.log('✅ Using cached computation result');
            return prevComputationResultRef.current;
        }

        console.log('🔄 Data changed, recomputing...');

        const result = computeUnifiedWorkflowState(projectData, projectId);

        prevProjectDataRef.current = projectData;
        prevComputationResultRef.current = result;

        console.log('✅ Computation complete:', {
            currentStage: result.parameters.currentStage,
            actionsCount: result.actions.length
        });

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
        console.log('⏳ Showing loading state');
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

    const { steps, displayComponents, actions, parameters } = computationResult;

    // Check for active transforms
    const hasActiveTransforms = Array.isArray(projectData.transforms) &&
        projectData.transforms.some((t: any) => t.status === 'running' || t.status === 'pending');

    console.log('🚀 Rendering ActionItemsSection with:', {
        currentStage: parameters.currentStage,
        actionsCount: actions.length,
        hasActiveTransforms,
        actionDetails: actions.map((a: any) => ({ id: a.id, title: a.title, type: a.type, component: a.component?.name }))
    });

    return (
        <Card
            style={{
                backgroundColor: '#1a1a1a',
            }}

        >
            {/* Hader */}


            {/* Loading state is now handled by workflow steps */}

            {/* Actions */}
            {actions.length > 0 ? (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {actions.map((action: any, index: number) => {
                        console.log('🎬 Rendering action:', { type: action.type, priority: action.priority, index });
                        return (
                            <ActionItemRenderer
                                key={`${action.type}-${index}`}
                                action={action}
                                projectId={projectId}
                                hasActiveTransforms={hasActiveTransforms}
                                workflowSteps={steps}
                                onSuccess={() => {
                                    console.log('✅ Action completed successfully:', action.type);
                                    // Optionally refresh project data or show success message
                                }}
                                onError={(error: Error) => {
                                    console.error('❌ Action failed:', action.type, error);
                                    // Optionally show error message
                                }}
                            />
                        );
                    })}
                </Space>
            ) : (
                <></>
            )}


        </Card>
    );
}; 