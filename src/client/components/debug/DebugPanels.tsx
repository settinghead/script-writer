import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import RawGraphVisualization from '../RawGraphVisualization';
import RawChatMessages from '../RawChatMessages';
import RawAgentContext from '../RawAgentContext';
import { ScrollPositionDemo } from '../ScrollPositionDemo';
import { YJSDebugComponent } from './YJSDebugComponent';
import { useDebugState } from './DebugMenu';

interface DebugPanelsProps {
    projectId: string;
}

export const DebugPanels: React.FC<DebugPanelsProps> = ({ projectId }) => {
    const { showRawGraph, showRawChat, showRawContext, showScrollDemo } = useDebugState();
    const [searchParams, setSearchParams] = useSearchParams();

    // Check for YJS debug mode
    const showYJSDebug = searchParams.get('yjs-debug') === '1';
    const artifactId = searchParams.get('artifact-id');

    // Don't render anything if no debug mode is active
    if (!showRawGraph && !showRawChat && !showRawContext && !showScrollDemo && !showYJSDebug) {
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
    } else if (showScrollDemo) {
        debugTitle = '滚动位置保存演示';
        debugContent = <ScrollPositionDemo />;
    } else if (showYJSDebug && artifactId) {
        debugTitle = 'YJS调试信息';
        debugContent = <YJSDebugComponent artifactId={artifactId} />;
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            backgroundColor: '#1a1a1a',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Debug Panel Header */}
            <div style={{
                height: '60px',
                backgroundColor: '#1a1a1a',
                borderBottom: '1px solid #434343',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                flexShrink: 0
            }}>
                <div style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#fff'
                }}>
                    {debugTitle}
                </div>
                <Button
                    type="text"
                    icon={<CloseOutlined />}
                    onClick={() => {
                        // Close debug panel by clearing search params
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete('raw-graph');
                        newSearchParams.delete('raw-chat');
                        newSearchParams.delete('raw-context');
                        newSearchParams.delete('yjs-demo');
                        newSearchParams.delete('yjs-debug');
                        newSearchParams.delete('artifact-id');
                        newSearchParams.delete('scroll-demo');
                        setSearchParams(newSearchParams);
                    }}
                    style={{
                        color: '#fff',
                        fontSize: '16px'
                    }}
                    size="large"
                />
            </div>

            {/* Debug Panel Content */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {debugContent}
            </div>
        </div>
    );
}; 