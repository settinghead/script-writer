import React from 'react';
import { Typography, Button, Tooltip, Modal } from 'antd';
import { Cpu, Trash } from 'iconoir-react';

import { BasicThread } from './BasicThread';
import { useClearChat } from '../../hooks/useChatMessages';
import { AppColors } from '../../../common/theme/colors';
import './chat.css';
import LiquidGlass from 'liquid-glass-react'

const { Title } = Typography;

interface AssistantChatSidebarProps {
    projectId: string;
}

export const AssistantChatSidebar: React.FC<AssistantChatSidebarProps> = ({ projectId }) => {
    const clearChatMutation = useClearChat(projectId);

    const handleClearChat = () => {
        Modal.confirm({
            title: '确认清空对话',
            content: '确定要清空所有对话记录吗？此操作无法撤销。',
            okText: '确认',
            cancelText: '取消',
            onOk: () => {
                clearChatMutation.mutate();
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
            <LiquidGlass>
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
                        <Tooltip title="清空对话">
                            <Button
                                type="text"
                                icon={<Trash style={{ fontSize: 18, color: AppColors.ai.primary }} />}
                                style={{ color: AppColors.ai.primary }}
                                loading={clearChatMutation.isPending}
                                onClick={handleClearChat}
                            />
                        </Tooltip>
                    </div>
                </div>
            </LiquidGlass>

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