import React from 'react';
import { Button, Space, Spin } from 'antd';
import { StopOutlined } from '@ant-design/icons';

interface StreamingProgressProps {
    isStreaming: boolean;
    isConnecting: boolean;
    onStop: () => void;
    itemCount?: number;
    itemLabel?: string; // "ideas" or "components"
}

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
    isStreaming,
    isConnecting,
    onStop,
    itemCount = 0,
    itemLabel = 'items'
}) => {
    if (!isStreaming && !isConnecting) {
        return null;
    }

    return (
        <div
            style={{
                backgroundColor: '#1a3c5a',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #2563eb',
                marginBottom: '16px'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size="middle">
                    <Spin size="small" />
                    <span style={{ color: '#fff' }}>
                        {isConnecting ? (
                            <span>正在连接...</span>
                        ) : (
                            <span>正在生成 {itemLabel}... ({itemCount} 已完成)</span>
                        )}
                    </span>
                </Space>

                <Button
                    onClick={onStop}
                    danger
                    icon={<StopOutlined />}
                    disabled={isConnecting}
                    size="small"
                >
                    停止生成
                </Button>
            </div>
        </div>
    );
}; 