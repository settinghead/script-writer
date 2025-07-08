import React from 'react';
import { Layout, Typography, Badge, Button, Tooltip } from 'antd';
import { Cpu, Trash, Settings } from 'iconoir-react';

import { BasicThread } from './BasicThread';
import './chat.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface AssistantChatSidebarProps {
    projectId: string;
}

export const AssistantChatSidebar: React.FC<AssistantChatSidebarProps> = ({ projectId }) => {

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
                    <Cpu style={{ fontSize: '20px', color: '#1890ff' }} />
                    <Title level={4} style={{ color: '#f0f0f0', margin: 0 }}>
                        觅光智能体
                    </Title>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Future: Add status indicators, clear chat button, etc. */}
                </div>
            </Header>

            <Content style={{
                background: '#1a1a1a',
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Assistant-UI style Thread component with enhanced message handling */}
                <BasicThread projectId={projectId} />
            </Content>
        </Layout>
    );
}; 