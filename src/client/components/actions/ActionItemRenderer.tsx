import React from 'react';
import { Alert } from 'antd';
import { ActionItem } from '../../utils/actionComputation';
import { WorkflowSteps, WorkflowStep } from '../WorkflowSteps';

interface ActionItemRendererProps {
    action: ActionItem;
    projectId: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    // Add optional props to help determine if streaming is in progress
    hasActiveTransforms?: boolean;
    stageDescription?: string;
    // NEW: Add workflow steps for unified display
    workflowSteps?: WorkflowStep[];
}

const ActionItemRenderer: React.FC<ActionItemRendererProps> = ({
    action,
    projectId,
    onSuccess,
    onError,
    hasActiveTransforms = false,
    stageDescription = '',
    workflowSteps = []
}) => {
    const Component = action.component;

    if (!Component) {
        return null;
    }

    // Combine action props with the required BaseActionProps
    const combinedProps = {
        ...action.props,
        projectId,
        onSuccess,
        onError
    };

    // Check if the action is disabled due to streaming/generation in progress
    const isDisabledDueToStreaming = !action.enabled && hasActiveTransforms;

    return (
        <div className="action-item-renderer">
            {/* Always show workflow steps when available */}
            {workflowSteps.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '6px',
                    border: '1px solid #333'
                }}>
                    <WorkflowSteps steps={workflowSteps} inline={true} />
                    <div
                        style={{
                            opacity: action.enabled ? 1 : 0.6,
                            pointerEvents: action.enabled ? 'auto' : 'none',
                            minWidth: '200px',
                            flexShrink: 0
                        }}
                    >
                        {isDisabledDueToStreaming && (
                            <Alert
                                message="生成进行中"
                                description="当前内容正在生成，生成完成后您可以进行编辑操作"
                                type="info"
                                showIcon
                                style={{ marginBottom: '12px' }}
                            />
                        )}
                        <Component {...combinedProps} />
                    </div>
                </div>
            )}

            {/* Show action without workflow steps if no steps available */}
            {workflowSteps.length === 0 && (
                <div
                    style={{
                        marginBottom: '16px',
                        opacity: action.enabled ? 1 : 0.6,
                        pointerEvents: action.enabled ? 'auto' : 'none'
                    }}
                >
                    {isDisabledDueToStreaming && (
                        <Alert
                            message="生成进行中"
                            description="当前内容正在生成，生成完成后您可以进行编辑操作"
                            type="info"
                            showIcon
                            style={{ marginBottom: '12px' }}
                        />
                    )}
                    <Component {...combinedProps} />
                </div>
            )}
        </div>
    );
};

export default ActionItemRenderer; 