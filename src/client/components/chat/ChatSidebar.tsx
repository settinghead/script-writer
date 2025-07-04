import React from 'react';
import { Layout, Typography, Badge, Button, Tooltip, Divider } from 'antd';
import { RobotOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import './chat.css';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { useChatMessages } from '../../hooks/useChatMessages.js';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

interface ChatSidebarProps {
    projectId: string;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ projectId }) => {
    const { messages, sendMessage, isLoading } = useChatMessages(projectId);

    const handleSendMessage = (content: string) => {
        sendMessage(content);
    };

    // Simple layout that fits within the Sider
    return (
        <Layout style={{ height: '100%', background: '#1a1a1a' }}>
            <Header style={{
                background: '#1e1e1e',
                borderBottom: '1px solid #333',
                paddingLeft: '16px',
                paddingRight: "16px",
                height: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                        <Title level={4} style={{ margin: 0, color: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RobotOutlined />
                            觅子智能体
                        </Title>

                    </div>

                    <Badge
                        status={isLoading ? "processing" : "success"}
                        text={
                            <Text style={{ fontSize: 12, color: isLoading ? '#fbbf24' : '#4ade80' }}>
                                {isLoading ? '思考中...' : '在线'}
                            </Text>
                        }
                    />
                </div>


            </Header>

            <Content style={{ background: '#1a1a1a', overflow: 'hidden' }}>
                <ChatMessageList messages={messages} isLoading={isLoading} />
            </Content>

            <Footer style={{
                background: '#1e1e1e',
                borderTop: '1px solid #333',
                padding: '16px'
            }}>
                <ChatInput onSend={handleSendMessage} disabled={isLoading} />
            </Footer>
        </Layout>
    );
}; 