import React from 'react';
import { Layout, Typography, Badge, Button, Tooltip } from 'antd';
import { RobotOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import { useChatMessages } from '../../hooks/useChatMessages';
import { useProjectInitialMode } from '../../transform-artifact-framework/useLineageResolution';
import { useProjectChatRuntime } from '../../hooks/useProjectChatRuntime';
import { BasicThread } from './BasicThread';
import './chat.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface AssistantChatSidebarProps {
    projectId: string;
}

export const AssistantChatSidebar: React.FC<AssistantChatSidebarProps> = ({ projectId }) => {
    const { messages, isLoading, error } = useChatMessages(projectId);
    const { isInitialMode } = useProjectInitialMode();
    const runtime = useProjectChatRuntime(projectId);

    const handleClearChat = async () => {
        // TODO: Implement clear chat functionality
        console.log('Clear chat clicked');
    };

    return (
        <Layout style={{ height: '100%', background: '#1a1a1a' }}>
            <Header style={{
                background: '#1e1e1e',
                borderBottom: '1px solid #333',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RobotOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                    <Title level={4} style={{ color: '#f0f0f0', margin: 0 }}>
                        觅子智能体
                    </Title>
                    <Badge status="success" text="在线" />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <Tooltip title="清空对话">
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            onClick={handleClearChat}
                            style={{ color: '#8c8c8c' }}
                        />
                    </Tooltip>
                    <Tooltip title="设置">
                        <Button
                            type="text"
                            icon={<SettingOutlined />}
                            style={{ color: '#8c8c8c' }}
                        />
                    </Tooltip>
                </div>
            </Header>

            <Content style={{
                background: '#1a1a1a',
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Assistant-UI style Thread component */}
                <BasicThread projectId={projectId} />


            </Content>
        </Layout>
    );
}; 