import React from 'react';
import { Space } from 'antd';
import { DisplayComponent } from '../utils/workflowTypes';

interface UnifiedDisplayRendererProps {
    displayComponents: DisplayComponent[];
}

export const UnifiedDisplayRenderer: React.FC<UnifiedDisplayRendererProps> = ({
    displayComponents
}) => {

    console.log('[UnifiedDisplayRenderer] Rendering components:', {
        totalComponents: displayComponents.length,
        componentIds: displayComponents.map(c => c.id),
        componentDetails: displayComponents.map(c => ({
            id: c.id,
            mode: c.mode,
            hasComponent: !!c.component,
            componentName: c.component?.name || 'anonymous'
        }))
    });

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {displayComponents.map((displayComponent) => {
                const Component = displayComponent.component;

                console.log(`[UnifiedDisplayRenderer] Rendering component ${displayComponent.id}:`, {
                    id: displayComponent.id,
                    mode: displayComponent.mode,
                    hasComponent: !!Component,
                    componentName: Component?.name || 'anonymous',
                    props: displayComponent.props
                });

                // Skip hidden components
                if (displayComponent.mode === 'hidden') {
                    console.log(`[UnifiedDisplayRenderer] Skipping hidden component: ${displayComponent.id}`);
                    return null;
                }

                if (!Component) {
                    console.error(`[UnifiedDisplayRenderer] No component found for ${displayComponent.id}`);
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