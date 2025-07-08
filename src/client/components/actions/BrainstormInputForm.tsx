import React, { useState } from 'react';
import { Button, Typography, message, Space } from 'antd';
import { BulbOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title } = Typography;

interface BrainstormInputFormProps extends BaseActionProps {
    brainstormArtifact: any;
}

const BrainstormInputForm: React.FC<BrainstormInputFormProps> = ({
    projectId,
    brainstormArtifact,
    onSuccess,
    onError
}) => {
    const [isStarting, setIsStarting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const projectData = useProjectData();

    const handleStartBrainstorm = async () => {
        if (isStarting) return;

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

            // Trigger brainstorm agent
            const response = await fetch(`/api/projects/${projectId}/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    userRequest: `基于artifact ID ${brainstormArtifact?.id} 的头脑风暴参数，生成${currentData.numberOfIdeas || 3}个创意想法。平台：${currentData.platform}，类型：${currentData.genre}${currentData.other_requirements ? `，其他要求：${currentData.other_requirements}` : ''}`,
                    projectId: projectId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start brainstorm');
            }

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
        if (isDeleting) return;

        try {
            setIsDeleting(true);

            // Delete the brainstorm input artifact
            const response = await fetch(`/api/artifacts/${brainstormArtifact.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete brainstorm input');
            }

            message.success('已返回到项目创建选择');
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

                <Button
                    type="primary"
                    size="large"
                    loading={isStarting}
                    onClick={handleStartBrainstorm}
                    style={{
                        minWidth: '200px',
                        height: '48px',
                        fontSize: '16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #1890ff, #52c41a)',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
                    }}
                >
                    {isStarting ? '启动中...' : '开始头脑风暴'}
                </Button>
            </Space>
        </div>
    );
};

export default BrainstormInputForm; 