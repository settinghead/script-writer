import React, { useState, useCallback } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { BulbOutlined, EditOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';

const { Text } = Typography;

const BrainstormCreationActions: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateBrainstormInput = useCallback(async () => {
        if (isCreating) return;

        setIsCreating(true);
        try {
            // Create empty brainstorm input artifact
            const response = await fetch('/api/artifacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    projectId,
                    type: 'brainstorm_tool_input_schema',
                    data: {
                        initialInput: true // Explicitly mark as initial input to bypass validation
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create brainstorm input: ${response.status}`);
            }

            const newArtifact = await response.json();
            message.success('头脑风暴表单已创建！');
            onSuccess?.();
        } catch (error) {
            console.error('Error creating brainstorm input:', error);
            const errorMessage = `创建失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsCreating(false);
        }
    }, [projectId, onSuccess, onError, isCreating]);

    return (
        <div style={{ padding: '16px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px', textAlign: 'center' }}>
                选择您希望如何开始创建项目
            </Text>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                maxWidth: '640px',
                margin: '0 auto'
            }}>
                {/* Brainstorm Creation Button */}
                <div style={{ textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<BulbOutlined />}
                        onClick={handleCreateBrainstormInput}
                        loading={isCreating}
                        style={{
                            height: '120px',
                            width: '100%',
                            minWidth: '200px',
                            fontSize: '16px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #faad14, #ffc53d)',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(250, 173, 20, 0.3)'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '24px' }}>💡</div>
                            <div>使用头脑风暴</div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                通过AI辅助生成创意想法
                            </div>
                        </div>
                    </Button>
                </div>

                {/* Manual Creation Button (Disabled) */}
                <div style={{ textAlign: 'center' }}>
                    <Button
                        size="large"
                        icon={<EditOutlined />}
                        disabled
                        style={{
                            height: '120px',
                            width: '100%',
                            minWidth: '200px',
                            fontSize: '16px',
                            borderRadius: '12px',
                            borderColor: '#434343',
                            color: '#8c8c8c'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '24px' }}>📝</div>
                            <div>手动输入素材</div>
                            <div style={{ fontSize: '12px', opacity: 0.6 }}>
                                即将推出...
                            </div>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BrainstormCreationActions; 