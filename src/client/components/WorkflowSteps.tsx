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
    // Debug: Show detailed step information
    console.log('🔄 WorkflowSteps - All steps:', steps?.map(s => ({ title: s.title, status: s.status })));

    if (!steps || steps.length === 0) {
        return null;
    }

    // Force show spinner for testing - REMOVE THIS AFTER DEBUGGING
    const testSteps = steps.map(s => {
        if (s.title === '大纲') {
            console.log('🔧 Forcing 大纲 step to process status');
            return { ...s, status: 'process' as const };
        }
        return s;
    });

    return (
        <div className="custom-workflow-steps">
            {testSteps.map((step, index) => (
                <React.Fragment key={step.id}>
                    <div className="workflow-step-item">
                        {/* Step indicator */}
                        <div className={`step-indicator ${step.status}`}>
                            {(() => {
                                console.log(`🔧 Step "${step.title}" rendering with status: ${step.status}`);
                                if (step.status === 'process') {
                                    console.log(`🔄 Rendering spinner for step: ${step.title}`);
                                    return (
                                        <Spin
                                            indicator={<LoadingOutlined style={{ fontSize: 10, color: '#1890ff' }} />}
                                            size="small"
                                        />
                                    );
                                } else {
                                    console.log(`🔵 Rendering dot for step: ${step.title}`);
                                    return <div className="step-dot" />;
                                }
                            })()}
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