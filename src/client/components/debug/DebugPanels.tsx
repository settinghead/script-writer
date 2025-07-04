import React from 'react';
import RawGraphVisualization from '../RawGraphVisualization';
import RawChatMessages from '../RawChatMessages';
import RawAgentContext from '../RawAgentContext';
import { useDebugState } from './DebugMenu';

interface DebugPanelsProps {
    projectId: string;
}

export const DebugPanels: React.FC<DebugPanelsProps> = ({ projectId }) => {
    const { showRawGraph, showRawChat, showRawContext } = useDebugState();

    if (showRawGraph) {
        return (
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <RawGraphVisualization />
            </div>
        );
    }

    if (showRawChat) {
        return (
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <RawChatMessages projectId={projectId} />
            </div>
        );
    }

    if (showRawContext) {
        return (
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <RawAgentContext projectId={projectId} />
            </div>
        );
    }

    return null;
}; 