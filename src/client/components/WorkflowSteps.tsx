import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import './WorkflowSteps.css';

export interface WorkflowStep {
    id: string;
    title: string;
    status: 'wait' | 'process' | 'finish' | 'error';
}

interface WorkflowStepsProps {
    steps: WorkflowStep[];
    inline?: boolean;
}

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ steps, inline = true }) => {
    if (!steps || steps.length === 0) {
        return null;
    }

    return (
        <div className="custom-workflow-steps">
            {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                    <div className="workflow-step-item">
                        {/* Step indicator */}
                        <div className={`step-indicator ${step.status}`}>
                            {step.status === 'process' ? (
                                <Spin size="small" />
                            ) : (
                                <div className="step-dot" />
                            )}
                        </div>

                        {/* Step label */}
                        <div className="step-label">{step.title}</div>
                    </div>

                    {/* Connection line (not for last item) */}
                    {index < steps.length - 1 && (
                        <div className={`step-connector-line ${step.status === 'finish' ? 'completed' : ''}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}; 