import React from 'react';
import { ActionItem } from '../../utils/actionComputation';

interface ActionItemRendererProps {
    action: ActionItem;
    projectId: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

const ActionItemRenderer: React.FC<ActionItemRendererProps> = ({
    action,
    projectId,
    onSuccess,
    onError
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

    return (
        <div
            className="action-item-renderer"
            style={{
                marginBottom: '16px',
                opacity: action.enabled ? 1 : 0.6,
                pointerEvents: action.enabled ? 'auto' : 'none'
            }}
        >
            <Component {...combinedProps} />
        </div>
    );
};

export default ActionItemRenderer; 