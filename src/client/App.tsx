import React from 'react';
import ReactDOM from 'react-dom/client';
import { useChat } from '@ai-sdk/react';
// Import Ant Design components - using default import style for Ant Design 5.x
import { Button, Input, Layout, Typography, Spin, Alert, ConfigProvider, theme } from 'antd';
// Import components with potential type issues separately
import Card from 'antd/lib/card';
import List from 'antd/lib/list';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
// With Ant Design 5.x, we don't need to import the CSS file directly
// The components will automatically import their own styles

// Import CSS for any custom styling needed
import "./index.css";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// Add a declaration for Vite env variables
declare interface ImportMeta {
  env: {
    VITE_DEEPSEEK_MODEL_NAME?: string;
    // Add any other env variables you need
    [key: string]: any;
  };
}

const App: React.FC = () => {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/llm-api/chat/completions',
  });

  // Hardcode the model name to avoid env variable issues for now
  const MODEL_NAME = 'deepseek-chat';

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e, {
      body: {
        model: MODEL_NAME,
      }
    });
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        }
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ padding: '0 20px' }}>
          <Title level={4} style={{ color: 'white', margin: '16px 0' }}>AI Chat Assistant</Title>
        </Header>
        <Content style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          {error && (
            <Alert
              message="Error"
              description={error.message}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}

          {/* Using a div instead of Card to avoid type issues */}
          <div
            style={{
              marginBottom: '24px',
              maxHeight: '500px',
              overflowY: 'auto',
              backgroundColor: '#1f1f1f',
              border: '1px solid #303030',
              borderRadius: '8px',
              padding: '12px'
            }}
          >
            <List
              dataSource={messages}
              locale={{ emptyText: 'No messages yet. Start a conversation!' }}
              renderItem={(message) => (
                <List.Item style={{
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}>
                  {/* Using a div instead of Card to avoid type issues */}
                  <div
                    style={{
                      maxWidth: '80%',
                      backgroundColor: message.role === 'user' ? '#1890ff' : '#2a2a2a',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      {message.role === 'user' ? (
                        <UserOutlined style={{ marginRight: '8px' }} />
                      ) : (
                        <RobotOutlined style={{ marginRight: '8px' }} />
                      )}
                      <Text strong style={{ color: message.role === 'user' ? 'white' : '#d9d9d9' }}>
                        {message.role === 'user' ? 'You' : 'AI'}
                      </Text>
                    </div>
                    <Text style={{
                      whiteSpace: 'pre-wrap',
                      color: message.role === 'user' ? 'white' : '#d9d9d9'
                    }}>
                      {message.content}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="Type your message here..."
              value={input}
              onChange={(e) => handleInputChange(e)}
              disabled={isLoading}
              style={{ flexGrow: 1 }}
              suffix={isLoading && <Spin size="small" />}
            />
            <Button
              type="primary"
              htmlType="submit"
              disabled={isLoading}
              icon={<SendOutlined />}
            >
              Send
            </Button>
          </form>
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
