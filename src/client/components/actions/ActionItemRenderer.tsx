import React from 'react';
import { ActionItem } from '../../utils/actionComputation';

interface ActionItemRendererProps {
    action: ActionItem;
}

const ActionItemRenderer: React.FC<ActionItemRendererProps> = ({ action }) => {
    const Component = action.component;

    if (!Component) {
        return null;
    }

    return (
        <div
            className="action-item-renderer"
            style={{
                marginBottom: '16px',
                opacity: action.enabled ? 1 : 0.6,
                pointerEvents: action.enabled ? 'auto' : 'none'
            }}
        >
            <Component {...action.props} />
        </div>
    );
};

export default ActionItemRenderer; 