import React, { useState } from 'react';
import { Button, Typography, message, Space } from 'antd';
import { BulbOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import AIButton from '../shared/AIButton';

const { Title } = Typography;

interface BrainstormInputFormProps extends BaseActionProps {
    brainstormJsondoc: any;
}

// Support both old props and new ActionComponentProps
type BrainstormInputFormPropsUnion = BrainstormInputFormProps | (ActionComponentProps & { brainstormJsondoc?: any });

const BrainstormInputForm: React.FC<BrainstormInputFormPropsUnion> = (props) => {
    const { projectId, onSuccess, onError } = props;

    // Get brainstormJsondoc from either old props or new jsondocs structure
    const brainstormJsondoc = 'brainstormJsondoc' in props
        ? props.brainstormJsondoc
        : ('jsondocs' in props ? props.jsondocs.brainstormInput : null);

    const [isStarting, setIsStarting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleStartBrainstorm = async () => {
        if (isStarting || !brainstormJsondoc) return;

        try {
            // Get current jsondoc data
            let currentData;
            try {
                currentData = typeof brainstormJsondoc.data === 'string'
                    ? JSON.parse(brainstormJsondoc.data)
                    : brainstormJsondoc.data;
            } catch (error) {
                console.error('Failed to parse jsondoc data:', error);
                message.error('无法读取头脑风暴参数');
                return;
            }

            // Validate required fields
            if (!currentData?.genre || !currentData?.genre.trim()) {
                message.warning('请先在上方填写故事类型');
                return;
            }

            if (!currentData?.platform || !currentData?.platform.trim()) {
                message.warning('请先在上方填写目标平台');
                return;
            }

            setIsStarting(true);

            // Use apiService to send chat message
            const userRequest = `基于jsondoc ID ${brainstormJsondoc.id} 的头脑风暴参数，生成${currentData.numberOfIdeas || 3}个创意想法。平台：${currentData.platform}，类型：${currentData.genre}${currentData.other_requirements ? `，其他要求：${currentData.other_requirements}` : ''}`;

            await apiService.sendChatMessage(projectId, userRequest, {
                action: 'start_brainstorm',
                jsondocId: brainstormJsondoc.id
            });

            message.success('头脑风暴已开始！请查看聊天面板了解进度。');
            onSuccess?.();
        } catch (error) {
            console.error('Error starting brainstorm:', error);
            const errorMessage = `启动头脑风暴失败：${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsStarting(false);
        }
    };

    const handleGoBack = async () => {
        if (isDeleting || !brainstormJsondoc) return;

        try {
            setIsDeleting(true);

            // Use apiService to delete the brainstorm input jsondoc
            await apiService.deleteBrainstormInput(brainstormJsondoc.id);

            onSuccess?.(); // This will trigger a re-render and return to initial state
        } catch (error) {
            console.error('Error deleting brainstorm input:', error);
            const errorMessage = `返回失败：${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>


            <Space size="large">
                <Button
                    icon={<ArrowLeftOutlined />}
                    size="large"
                    loading={isDeleting}
                    onClick={handleGoBack}
                    style={{
                        minWidth: '120px',
                        height: '48px',
                        fontSize: '16px',
                        borderRadius: '8px'
                    }}
                >
                    {isDeleting ? '返回中...' : '返回'}
                </Button>

                <AIButton
                    size="large"
                    loading={isStarting}

                    onClick={handleStartBrainstorm}
                    style={{
                        minWidth: '200px',
                        height: '48px',
                        fontSize: '16px'
                    }}
                >
                    {isStarting ? '启动中...' : <>开始头脑风暴 <ArrowRightOutlined /></>}

                </AIButton>
            </Space>
        </div>
    );
};

export default BrainstormInputForm; 