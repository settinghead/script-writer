import React, { useState, useEffect } from 'react';
import '@ant-design/v5-patch-for-react-19';

import ReactDOM from 'react-dom/client';
import { Tabs, Layout, Typography, ConfigProvider, theme, Button, Drawer, Menu } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import IdeationTab from './components/IdeationTab';
import ChatTab from './components/ChatTab';
import ScriptTab from './components/ScriptTab';

// Import CSS for any custom styling needed
import "./index.css";

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('script'); // Default to script tab for testing
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (isMobile) {
      setMenuVisible(false); // Close menu drawer after selection on mobile
    }
  };

  // Define tab content components
  const tabComponents = {
    ideation: <IdeationTab />,
    chat: <ChatTab />,
    script: <ScriptTab />
  };

  // Mobile menu items
  const menuItems = [
    { key: 'ideation', label: '灵感' },
    { key: 'chat', label: '对话' },
    { key: 'script', label: '剧本编辑' }
  ];

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
        <Header style={{
          padding: '0 20px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Title level={3} style={{ color: 'white', margin: '16px 0' }}>AI 剧本写作助手</Title>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: 'white', fontSize: '20px' }} />}
              onClick={() => setMenuVisible(true)}
            />
          )}
        </Header>
        <Content style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isMobile ? (
            <>
              <Drawer
                title="菜单"
                placement="right"
                onClose={() => setMenuVisible(false)}
                open={menuVisible}
                bodyStyle={{ padding: 0 }}
              >
                <Menu
                  mode="vertical"
                  selectedKeys={[activeTab]}
                  onClick={({ key }) => handleTabChange(key)}
                  items={menuItems}
                  style={{ height: '100%' }}
                />
              </Drawer>
              <div style={{ flexGrow: 1, overflow: 'hidden', padding: '0 10px' }}>
                {tabComponents[activeTab as keyof typeof tabComponents]}
              </div>
            </>
          ) : (
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
                  key: 'ideation',
                  label: '灵感',
                  children: <IdeationTab />
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
          )}
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
