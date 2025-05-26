import React, { useState, useEffect } from 'react';
import '@ant-design/v5-patch-for-react-19';

import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Typography, ConfigProvider, theme, Button, Drawer, Menu } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import IdeationTab from './components/IdeationTab';
import ChatTab from './components/ChatTab';
import ScriptTab from './components/ScriptTab';

// Import CSS for any custom styling needed
import "./index.css";

const { Header, Content } = Layout;
const { Title } = Typography;

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMenuVisible(false); // Close menu drawer after selection on mobile
    }
  };

  // Get current route key for menu selection
  const getCurrentKey = () => {
    switch (location.pathname) {
      case '/ideation':
        return 'ideation';
      case '/chat':
        return 'chat';
      case '/script':
        return 'script';
      default:
        return 'script'; // Default selection
    }
  };

  // Mobile menu items
  const menuItems = [
    {
      key: 'ideation',
      label: '灵感',
      onClick: () => handleMenuClick('/ideation')
    },
    {
      key: 'chat',
      label: '对话',
      onClick: () => handleMenuClick('/chat')
    },
    {
      key: 'script',
      label: '剧本编辑',
      onClick: () => handleMenuClick('/script')
    }
  ];

  // Desktop tab items for navigation
  const tabItems = [
    {
      key: 'ideation',
      label: '灵感',
      path: '/ideation'
    },
    {
      key: 'chat',
      label: '对话',
      path: '/chat'
    },
    {
      key: 'script',
      label: '剧本编辑',
      path: '/script'
    }
  ];

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{
        padding: '0 20px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={3} style={{ color: 'white', margin: '16px 0' }}>Script Aid</Title>
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
              style={{ padding: 0 }}
            >
              <Menu
                mode="vertical"
                selectedKeys={[getCurrentKey()]}
                items={menuItems}
                style={{ height: '100%' }}
              />
            </Drawer>
            <div style={{ flexGrow: 1, overflow: 'auto', padding: '0 10px' }}>
              <Routes>
                <Route path="/ideation/:id" element={<IdeationTab />} />
                <Route path="/ideation" element={<IdeationTab />} />
                <Route path="/chat" element={<ChatTab />} />
                <Route path="/script" element={<ScriptTab />} />
                <Route path="/" element={<Navigate to="/script" replace />} />
              </Routes>
            </div>
          </>
        ) : (
          <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Desktop Navigation Bar */}
            <div style={{
              borderBottom: '1px solid #434343',
              padding: '0 20px',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                gap: '0',
                borderBottom: '1px solid transparent'
              }}>
                {tabItems.map(item => (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.path)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '12px 16px',
                      color: getCurrentKey() === item.key ? '#1890ff' : '#d9d9d9',
                      cursor: 'pointer',
                      borderBottom: getCurrentKey() === item.key ? '2px solid #1890ff' : '2px solid transparent',
                      fontSize: '14px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      if (getCurrentKey() !== item.key) {
                        e.currentTarget.style.color = '#40a9ff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (getCurrentKey() !== item.key) {
                        e.currentTarget.style.color = '#d9d9d9';
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Content Area */}
            <div style={{
              flexGrow: 1,
              overflow: 'hidden',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Routes>
                <Route path="/ideation/:id" element={<IdeationTab />} />
                <Route path="/ideation" element={<IdeationTab />} />
                <Route path="/chat" element={<ChatTab />} />
                <Route path="/script" element={<ScriptTab />} />
                <Route path="/" element={<Navigate to="/script" replace />} />
              </Routes>
            </div>
          </div>
        )}
      </Content>
    </Layout>
  );
};

const App: React.FC = () => {
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
      <Router>
        <AppContent />
      </Router>
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
