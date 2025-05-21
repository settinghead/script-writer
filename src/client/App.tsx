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
      <Layout style={{
        height: '100vh',
        overflow: 'hidden' // Prevent outer scrollbar
      }}>
        <Header style={{
          padding: '0 20px',
          height: '64px', // Explicitly set header height
          lineHeight: '64px'
        }}>
          <Title level={3} style={{ color: 'white', margin: '0' }}>AI 剧本写作助手</Title>
        </Header>
        <Content style={{
          height: 'calc(100vh - 64px)', // Full height minus header
          overflow: 'hidden'
        }}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
            tabBarStyle={{
              marginBottom: 0,
              padding: '0 20px'
            }}
            items={[
              {
                key: 'inspiration',
                label: '灵感',
                children: <div style={{ height: 'calc(100% - 46px)', overflow: 'auto' }}><InspirationTab /></div>
              },
              {
                key: 'chat',
                label: '对话',
                children: <div style={{ height: 'calc(100% - 46px)', overflow: 'auto' }}><ChatTab /></div>
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
