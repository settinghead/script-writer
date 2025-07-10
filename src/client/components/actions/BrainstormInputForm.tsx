import React, { useState } from 'react';
import { Button, Typography, message, Space } from 'antd';
import { BulbOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import AIButton from '../shared/AIButton';

const { Title } = Typography;

interface BrainstormInputFormProps extends BaseActionProps {
    brainstormArtifact: any;
}

// Support both old props and new ActionComponentProps
type BrainstormInputFormPropsUnion = BrainstormInputFormProps | (ActionComponentProps & { brainstormArtifact?: any });

const BrainstormInputForm: React.FC<BrainstormInputFormPropsUnion> = (props) => {
    const { projectId, onSuccess, onError } = props;

    // Get brainstormArtifact from either old props or new artifacts structure
    const brainstormArtifact = 'brainstormArtifact' in props
        ? props.brainstormArtifact
        : ('artifacts' in props ? props.artifacts.brainstormInput : null);

    const [isStarting, setIsStarting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleStartBrainstorm = async () => {
        if (isStarting || !brainstormArtifact) return;

        try {
            // Get current artifact data
            let currentData;
            try {
                currentData = typeof brainstormArtifact.data === 'string'
                    ? JSON.parse(brainstormArtifact.data)
                    : brainstormArtifact.data;
            } catch (error) {
                console.error('Failed to parse artifact data:', error);
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
            const userRequest = `基于artifact ID ${brainstormArtifact.id} 的头脑风暴参数，生成${currentData.numberOfIdeas || 3}个创意想法。平台：${currentData.platform}，类型：${currentData.genre}${currentData.other_requirements ? `，其他要求：${currentData.other_requirements}` : ''}`;

            await apiService.sendChatMessage(projectId, userRequest, {
                action: 'start_brainstorm',
                artifactId: brainstormArtifact.id
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
        if (isDeleting || !brainstormArtifact) return;

        try {
            setIsDeleting(true);

            // Use apiService to delete the brainstorm input artifact
            await apiService.deleteBrainstormInput(brainstormArtifact.id);

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
            <div style={{ marginBottom: '16px' }}>
                <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                    请确保上方的参数已填写完整，然后点击下方按钮开始生成创意
                </Typography.Text>
            </div>

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
                    {isStarting ? '启动中...' : '开始头脑风暴'}
                </AIButton>
            </Space>
        </div>
    );
};

export default BrainstormInputForm; 