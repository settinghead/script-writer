import React from 'react';
import { Progress } from 'antd';

interface TopProgressBarProps {
    /** Whether streaming/generation is currently active */
    isStreaming: boolean;
    /** Current progress percentage (0-100) */
    progress: number;
    /** Current count of completed items */
    currentCount: number;
    /** Total expected count of items */
    totalCount: number;
    /** Label for the items being generated (e.g. "剧集", "想法") */
    itemLabel?: string;
    /** Custom completion message */
    completionMessage?: string;
    /** Whether to show the progress bar at all */
    visible?: boolean;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({
    isStreaming,
    progress,
    currentCount,
    totalCount,
    itemLabel = '项目',
    completionMessage,
    visible = true
}) => {
    if (!visible || (!isStreaming && currentCount === 0)) {
        return null;
    }

    return (
        <div style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: '#0d1117',
            borderBottom: '1px solid #21262d',
            padding: '0',
            marginBottom: '1px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}>
            {/* CSS for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
            
            <Progress
                percent={progress}
                status={isStreaming ? "active" : "normal"}
                showInfo={false}
                size="small"
                strokeWidth={5}
                strokeColor={isStreaming ? {
                    '0%': '#1890ff',
                    '50%': '#52c41a', 
                    '100%': '#faad14'
                } : '#52c41a'}
                trailColor="rgba(255, 255, 255, 0.1)"
                style={{
                    margin: 0,
                    padding: 0
                }}
            />
            
            {/* Streaming indicator */}
            {isStreaming && (
                <div style={{
                    position: 'absolute',
                    top: '6px',
                    right: '12px',
                    fontSize: '11px',
                    color: '#8b949e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span>正在生成 {currentCount}/{totalCount} {itemLabel}</span>
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#1890ff',
                        animation: 'pulse 2s infinite'
                    }} />
                </div>
            )}
            
            {/* Completion indicator */}
            {!isStreaming && currentCount > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '6px',
                    right: '12px',
                    fontSize: '11px',
                    color: '#52c41a',
                    fontWeight: 500
                }}>
                    {completionMessage || `已完成 ${currentCount}/${totalCount} ${itemLabel}`}
                </div>
            )}
        </div>
    );
}; 