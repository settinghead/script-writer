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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('script'); // Default to script tab for testing

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
      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header style={{ padding: '0 20px', flexShrink: 0 }}>
          <Title level={3} style={{ color: 'white', margin: '16px 0' }}>AI 剧本写作助手</Title>
        </Header>
        <Content style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
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
            // Add this to make TabPanes also flex containers
            renderTabBar={(props, DefaultTabBar) => (
              <DefaultTabBar {...props} style={{ flexShrink: 0 }} />
            )}
            // Apply styles to the content area of the tabs
            tabBarStyle={{ marginBottom: 0 }}
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
