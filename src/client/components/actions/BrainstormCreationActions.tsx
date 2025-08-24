import React, { useState, useCallback } from 'react';
import { Button, Typography, message, Grid } from 'antd';
import { EditOutlined, BulbOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import AIButton from '../shared/AIButton';

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

    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;

    return (
        <div style={{
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
        }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}>
                选择您希望如何开始创建项目
            </Text>

            <div style={{
                display: 'flex',
                gap: isMobile ? '12px' : '24px',
                justifyContent: 'center',
                alignItems: 'stretch',
                width: '100%',
                maxWidth: isMobile ? '600px' : '760px',
                padding: isMobile ? '0 12px' : '0 16px',
                flexWrap: 'nowrap'
            }}>
                {/* Brainstorm Creation Button */}
                <div style={{ flex: isMobile ? '1 1 0' : '0 1 320px', minWidth: isMobile ? 0 : 260 }}>
                    <AIButton
                        size="large"
                        onClick={handleCreateBrainstormInput}
                        loading={isCreating}
                        showIcon={false}
                        style={{ height: isMobile ? 120 : 130, width: '100%', fontSize: 16, padding: isMobile ? '12px 12px' : '16px 20px' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BulbOutlined style={{ fontSize: '20px' }} />
                                <span>使用头脑风暴</span>
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                通过AI辅助生成创意想法
                            </div>
                        </div>
                    </AIButton>
                </div>

                {/* Manual Creation Button */}
                <div style={{ flex: isMobile ? '1 1 0' : '0 1 320px', minWidth: isMobile ? 0 : 260 }}>
                    <Button
                        type="primary"
                        size="large"
                        onClick={handleCreateManualInput}
                        loading={isCreatingManual}
                        style={{
                            height: isMobile ? 120 : 130,
                            width: '100%',
                            fontSize: 16,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #1890ff, #40a9ff, #69c0ff, #1890ff)',
                            backgroundSize: '200% 200%',
                            backgroundPosition: '0% 50%',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            padding: isMobile ? '12px 12px' : '16px 20px'
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <EditOutlined style={{ fontSize: '20px' }} />
                                <span>手动输入素材</span>
                            </div>
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