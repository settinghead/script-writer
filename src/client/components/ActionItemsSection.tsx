import React, { useMemo, useEffect, useRef } from 'react';
import { Card, Typography, Space, Alert, Spin } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useActionItemsStore } from '../stores/actionItemsStore';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';
import ActionItemRenderer from './actions/ActionItemRenderer';
import { WorkflowSteps } from './WorkflowSteps';

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

        if (!Array.isArray(projectData.jsonDocs) || !Array.isArray(projectData.transforms)) {
            return null;
        }

        // Check if data has actually changed
        const currentData = {
            jsonDocs: projectData.jsonDocs,
            transforms: projectData.transforms,
            transformInputs: projectData.transformInputs,
            transformOutputs: projectData.transformOutputs,
            humanTransforms: projectData.humanTransforms
        };

        // Simple deep equality check for arrays
        const dataChanged =
            JSON.stringify(currentData.jsonDocs) !== JSON.stringify(prevProjectDataRef.current.jsonDocs) ||
            JSON.stringify(currentData.transforms) !== JSON.stringify(prevProjectDataRef.current.transforms) ||
            JSON.stringify(currentData.transformInputs) !== JSON.stringify(prevProjectDataRef.current.transformInputs) ||
            JSON.stringify(currentData.transformOutputs) !== JSON.stringify(prevProjectDataRef.current.transformOutputs) ||
            JSON.stringify(currentData.humanTransforms) !== JSON.stringify(prevProjectDataRef.current.humanTransforms);

        if (!dataChanged && prevComputationResultRef.current) {
            return prevComputationResultRef.current;
        }

        const result = computeUnifiedWorkflowState(projectData, projectId);

        prevProjectDataRef.current = projectData;
        prevComputationResultRef.current = result;

        return result;
    }, [
        projectData.isLoading,
        projectData.jsonDocs?.length,
        projectData.transforms?.length,
        projectData.transformInputs?.length,
        projectData.transformOutputs?.length,
        projectData.humanTransforms?.length,
        // Add transform statuses to trigger recomputation when status changes
        Array.isArray(projectData.transforms) ? projectData.transforms.map(t => t.status).join(',') : ''
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

    const { steps, displayComponents, actions, parameters } = computationResult;

    // Check for active transforms
    const hasActiveTransforms = Array.isArray(projectData.transforms) &&
        projectData.transforms.some((t: any) => t.status === 'running' || t.status === 'pending');



    return (
        <Card
            style={{
                backgroundColor: '#1a1a1a',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
            }}

        >
            {/* Hader */}


            {/* Horizontal layout: workflow steps on left, actions on right */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', width: '100%' }}>
                {/* Workflow steps take available space */}
                {/* <div style={{ flex: 1 }}>
                    {steps.length > 0 && (
                        <WorkflowSteps steps={steps} inline={true} />
                    )}
                </div> */}

                {/* Actions on the right */}
                <div style={{ flexShrink: 0 }}>
                    {actions.length > 0 ? (
                        <Space direction="vertical">
                            {actions.map((action: any, index: number) => (
                                <ActionItemRenderer
                                    key={`${action.type}-${index}`}
                                    action={action}
                                    projectId={projectId}
                                    hasActiveTransforms={hasActiveTransforms}
                                    workflowSteps={[]} // Don't pass steps here since we show them above
                                    onSuccess={() => {
                                        // Action completed successfully
                                    }}
                                    onError={(error: Error) => {
                                        console.error('❌ Action failed:', action.type, error);
                                    }}
                                />
                            ))}
                        </Space>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                            <Text type="secondary">生成中(完成后可编辑)...</Text>
                        </div>
                    )}
                </div>
            </div>


        </Card>
    );
}; 