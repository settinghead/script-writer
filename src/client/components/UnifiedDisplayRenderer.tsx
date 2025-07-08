import React from 'react';
import { Space } from 'antd';
import { DisplayComponent } from '../utils/workflowTypes';

interface UnifiedDisplayRendererProps {
    displayComponents: DisplayComponent[];
}

export const UnifiedDisplayRenderer: React.FC<UnifiedDisplayRendererProps> = ({
    displayComponents
}) => {


    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {displayComponents.map((displayComponent) => {
                const Component = displayComponent.component;

                // Skip hidden components
                if (displayComponent.mode === 'hidden') {
                    return null;
                }

                return (
                    <div key={displayComponent.id}>
                        <Component {...displayComponent.props} />
                    </div>
                );
            })}
        </Space>
    );
}; 