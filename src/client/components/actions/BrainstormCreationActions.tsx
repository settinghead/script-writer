import React, { useState, useCallback } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { BulbOutlined, EditOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';

const { Text } = Typography;

// Support both old BaseActionProps and new ActionComponentProps for backward compatibility
type BrainstormCreationActionsProps = BaseActionProps | ActionComponentProps;

const BrainstormCreationActions: React.FC<BrainstormCreationActionsProps> = (props) => {
    const { projectId, onSuccess, onError } = props;
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingManual, setIsCreatingManual] = useState(false);

    const handleCreateBrainstormInput = useCallback(async () => {
        if (isCreating) return;

        setIsCreating(true);
        try {
            await apiService.createBrainstormInput(projectId);
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

    const handleCreateManualInput = useCallback(async () => {
        if (isCreatingManual) return;

        setIsCreatingManual(true);
        try {
            await apiService.createManualBrainstormIdea(projectId);
            message.success('手动创意已创建！');
            onSuccess?.();
        } catch (error) {
            console.error('Error creating manual brainstorm idea:', error);
            const errorMessage = `创建失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsCreatingManual(false);
        }
    }, [projectId, onSuccess, onError, isCreatingManual]);

    return (
        <div style={{ padding: '16px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px', textAlign: 'center' }}>
                选择您希望如何开始创建项目
            </Text>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                maxWidth: '640px',
                margin: '0 auto',
                padding: '0 16px'
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
                            background: 'linear-gradient(135deg, #722ed1, #9254de, #b37feb, #722ed1)',
                            backgroundSize: '200% 200%',
                            backgroundPosition: '0% 50%',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(114, 46, 209, 0.3)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.background = 'linear-gradient(135deg, #531dab, #722ed1, #9254de, #531dab)';
                            target.style.backgroundSize = '200% 200%';
                            target.style.backgroundPosition = '100% 50%';
                            target.style.boxShadow = '0 6px 16px rgba(114, 46, 209, 0.4)';
                            target.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.background = 'linear-gradient(135deg, #722ed1, #9254de, #b37feb, #722ed1)';
                            target.style.backgroundSize = '200% 200%';
                            target.style.backgroundPosition = '0% 50%';
                            target.style.boxShadow = '0 4px 12px rgba(114, 46, 209, 0.3)';
                            target.style.transform = 'translateY(0)';
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

                {/* Manual Creation Button */}
                <div style={{ textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<EditOutlined />}
                        onClick={handleCreateManualInput}
                        loading={isCreatingManual}
                        style={{
                            height: '120px',
                            width: '100%',
                            minWidth: '200px',
                            fontSize: '16px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #1890ff, #40a9ff, #69c0ff, #1890ff)',
                            backgroundSize: '200% 200%',
                            backgroundPosition: '0% 50%',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.background = 'linear-gradient(135deg, #096dd9, #1890ff, #40a9ff, #096dd9)';
                            target.style.backgroundSize = '200% 200%';
                            target.style.backgroundPosition = '100% 50%';
                            target.style.boxShadow = '0 6px 16px rgba(24, 144, 255, 0.4)';
                            target.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.background = 'linear-gradient(135deg, #1890ff, #40a9ff, #69c0ff, #1890ff)';
                            target.style.backgroundSize = '200% 200%';
                            target.style.backgroundPosition = '0% 50%';
                            target.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.3)';
                            target.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '24px' }}>📝</div>
                            <div>手动输入素材</div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                直接输入您的创意内容
                            </div>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BrainstormCreationActions; 