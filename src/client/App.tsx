import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Tabs, Layout, Typography, ConfigProvider, theme } from 'antd';
import InspirationTab from './components/InspirationTab';
import ChatTab from './components/ChatTab';
import ScriptTab from './components/ScriptTab';

// Import CSS for any custom styling needed
import "./index.css";

const { Header, Content } = Layout;
const { Title } = Typography;
const { TabPane } = Tabs;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inspiration');

  const handleTabChange = (key: string) => {
    setActiveTab(key);
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
          <Title level={3} style={{ color: 'white', margin: '16px 0' }}>AI 剧本写作助手</Title>
        </Header>
        <Content>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            style={{
              padding: '0 20px',
              color: 'white'
            }}
            items={[
              {
                key: 'inspiration',
                label: '灵感',
                children: <InspirationTab />
              },
              {
                key: 'chat',
                label: '对话',
                children: <ChatTab />
              },
              {
                key: 'script',
                label: '剧本编辑',
                children: <ScriptTab />
              }
            ]}
          />
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
