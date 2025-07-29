import React from 'react';
import { Typography, Button, Tooltip, Modal } from 'antd';
import { Cpu, Plus } from 'iconoir-react';

import { BasicThread } from './BasicThread';
import { useClearChat } from '../../hooks/useChatMessages';
import { useChatContext } from '../../contexts/ChatContext';
import { AppColors } from '../../../common/theme/colors';
import './chat.css';

const { Title } = Typography;

interface AssistantChatSidebarProps {
    projectId: string;
}

export const AssistantChatSidebar: React.FC<AssistantChatSidebarProps> = ({ projectId }) => {
    const clearChatMutation = useClearChat(projectId);
    const { createNewConversation, currentConversationId } = useChatContext();

    const handleNewConversation = () => {
        Modal.confirm({
            title: '开始新对话',
            content: '确定要开始新的对话吗？当前对话将被保存。',
            okText: '开始新对话',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await createNewConversation();
                } catch (error) {
                    console.error('Failed to create new conversation:', error);
                    // Fallback to clear chat
                    clearChatMutation.mutate();
                }
            },
        });
    };

    return (
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            {/* Animated Background */}
            <div className="chat-background">
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
                <span className="chat-ball"></span>
            </div>
            {/* Glass Header Overlay */}
            <div
                className="chat-header-glass"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '64px',
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 10,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu style={{ fontSize: '20px', color: AppColors.ai.primary }} />
                    <Title level={4} style={{ color: '#f0f0f0', margin: 0 }}>
                        觅光智能体
                    </Title>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <Tooltip title="开始新对话">
                        <Button
                            type="text"
                            icon={<Plus style={{ fontSize: 18, color: AppColors.ai.primary }} />}
                            style={{ color: AppColors.ai.primary }}
                            loading={clearChatMutation.isPending}
                            onClick={handleNewConversation}
                        />
                    </Tooltip>
                </div>
            </div>

            {/* Main Chat Content */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Assistant-UI style Thread component with enhanced message handling */}
                <BasicThread projectId={projectId} />
            </div>
        </div>
    );
}; 