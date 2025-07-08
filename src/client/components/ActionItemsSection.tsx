import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Spin, Alert } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useActionItemsStore } from '../stores/actionItemsStore';
import { computeParamsAndActions } from '../utils/actionComputation';
import { ActionItemRenderer } from './actions';

const { Text } = Typography;

const ActionItemsSection: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectData = useProjectData();
    const actionItemsStore = useActionItemsStore(projectId);

    // Compute available actions
    const { actions, currentStage, hasActiveTransforms, stageDescription } = useMemo(() =>
        computeParamsAndActions(projectData, actionItemsStore.selectedBrainstormIdea),
        [projectData, actionItemsStore.selectedBrainstormIdea]
    );

    // Show loading state during active transforms
    if (hasActiveTransforms) {
        return (
            <div style={{
                background: '#1a1a1a',
                borderTop: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                flexShrink: 0
            }}>
                <Spin
                    indicator={<LoadingOutlined style={{ fontSize: 18, color: '#1890ff' }} spin />}
                    size="small"
                />
                <Text type="secondary" style={{ marginLeft: '12px', fontSize: '14px' }}>
                    {stageDescription}
                </Text>
            </div>
        );
    }

    // Show error state if project data failed to load
    if (projectData.artifacts === "error" || projectData.transforms === "error") {
        return (
            <div style={{
                background: '#1a1a1a',
                borderTop: '1px solid #333',
                padding: '16px 12px',
                flexShrink: 0
            }}>
                <Alert
                    message="加载项目数据时出错"
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    // Show placeholder if no actions available
    if (actions.length === 0) {
        return (
            <div style={{
                background: '#1a1a1a',
                borderTop: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                flexShrink: 0
            }}>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                    {stageDescription || '暂无可用操作'}
                </Text>
            </div>
        );
    }

    // Render actions in priority order
    return (
        <div style={{
            background: '#1a1a1a',
            borderTop: '1px solid #333',
            padding: '16px 12px',
            flexShrink: 0
        }}>
            {/* Stage description */}
            <div style={{ marginBottom: '12px' }}>
                <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                    当前阶段: {currentStage}
                </Text>
                <br />
                <Text style={{ fontSize: '14px', color: '#fff' }}>
                    {stageDescription}
                </Text>
            </div>

            {/* Action items */}
            <div className="action-items-list">
                {actions
                    .sort((a, b) => a.priority - b.priority)
                    .map(action => (
                        <ActionItemRenderer key={action.id} action={action} />
                    ))
                }
            </div>
        </div>
    );
};

export default ActionItemsSection; 