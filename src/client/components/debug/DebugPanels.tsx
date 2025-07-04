import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import RawGraphVisualization from '../RawGraphVisualization';
import RawChatMessages from '../RawChatMessages';
import RawAgentContext from '../RawAgentContext';
import { useDebugState } from './DebugMenu';

interface DebugPanelsProps {
    projectId: string;
}

export const DebugPanels: React.FC<DebugPanelsProps> = ({ projectId }) => {
    const { showRawGraph, showRawChat, showRawContext } = useDebugState();
    const [searchParams, setSearchParams] = useSearchParams();

    // Don't render anything if no debug mode is active
    if (!showRawGraph && !showRawChat && !showRawContext) {
        return null;
    }

    let debugTitle = '';
    let debugContent = null;

    if (showRawGraph) {
        debugTitle = '原始图谱视图';
        debugContent = <RawGraphVisualization />;
    } else if (showRawChat) {
        debugTitle = '内部对话记录';
        debugContent = <RawChatMessages projectId={projectId} />;
    } else if (showRawContext) {
        debugTitle = '代理上下文';
        debugContent = <RawAgentContext projectId={projectId} />;
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <Card
                title={debugTitle}
                style={{
                    width: '90%',
                    height: '90%',
                    maxWidth: '1200px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #434343'
                }}
                styles={{
                    body: {
                        padding: 0,
                        height: 'calc(100% - 57px)', // Account for header height
                        overflow: 'hidden'
                    },
                    header: {
                        backgroundColor: '#1a1a1a',
                        borderBottom: '1px solid #434343',
                        color: '#fff'
                    }
                }}
                extra={
                    <Button
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={() => {
                            // Close debug panel by clearing search params
                            const newSearchParams = new URLSearchParams(searchParams);
                            newSearchParams.delete('raw-graph');
                            newSearchParams.delete('raw-chat');
                            newSearchParams.delete('raw-context');
                            setSearchParams(newSearchParams);
                        }}
                        style={{ color: '#fff' }}
                    />
                }
            >
                <div style={{
                    height: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {debugContent}
                </div>
            </Card>
        </div>
    );
}; 