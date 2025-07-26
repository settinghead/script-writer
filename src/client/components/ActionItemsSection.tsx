import React, { useMemo, useEffect, useRef } from 'react';
import { Card, Typography, Space, Alert, Spin, Row, Col } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useActionItemsStore } from '../stores/actionItemsStore';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';
import ActionItemRenderer from './actions/ActionItemRenderer';
// import { WorkflowSteps } from './WorkflowSteps';

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

        if (!Array.isArray(projectData.jsondocs) || !Array.isArray(projectData.transforms)) {
            return null;
        }

        // Check if data has actually changed
        const currentData = {
            jsondocs: projectData.jsondocs,
            transforms: projectData.transforms,
            transformInputs: projectData.transformInputs,
            transformOutputs: projectData.transformOutputs,
            humanTransforms: projectData.humanTransforms
        };

        // Simple deep equality check for arrays
        const dataChanged =
            JSON.stringify(currentData.jsondocs) !== JSON.stringify(prevProjectDataRef.current.jsondocs) ||
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
        projectData.jsondocs?.length,
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



        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '24px',
                width: '100%',
                padding: '36px 32px',
                background: 'linear-gradient(145deg, #232323 60%, #181818 100%)',
                borderRadius: '12px',
                boxShadow:
                    '0 12px 36px 0 rgba(0,0,0,0.60), 0 4px 16px 0 rgba(80,80,80,0.22), 0 2px 8px 0 rgba(255,255,255,0.06) inset',
                border: '2.5px solid #232323',
                transition: 'box-shadow 0.2s cubic-bezier(.4,2,.6,1)'
            }}
        >
            {/* Actions on the right */}
            {actions.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", width: "100%", justifyContent: "center" }}>
                    {actions.map((action: any, index: number) => (
                        <div key={`${action.type}-${index}`}>
                            <ActionItemRenderer
                                action={action}
                                projectId={projectId}
                                hasActiveTransforms={hasActiveTransforms}
                                onSuccess={() => {
                                    // Action completed successfully
                                }}
                                onError={(error: Error) => {
                                    console.error('❌ Action failed:', action.type, error);
                                }}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    <Text type="secondary">生成中(完成后可编辑)...</Text>
                </div>
            )}
        </div>


    );
}; 