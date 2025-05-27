import React, { useState, useEffect } from 'react';
import '@ant-design/v5-patch-for-react-19';

import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Typography, ConfigProvider, theme, Button, Drawer, Menu, Dropdown, Avatar } from 'antd';
import { MenuOutlined, UserOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import IdeationTab from './components/IdeationTab';
import ChatTab from './components/ChatTab';
import ScriptTab from './components/ScriptTab';
import StagewiseToolbar from './components/StagewiseToolbar';

// Import CSS for any custom styling needed
import "./index.css";

const { Header, Content } = Layout;
const { Title } = Typography;

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [menuVisible, setMenuVisible] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleLogin = () => {
    navigate('/login');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User Authentication Section */}
          {isAuthenticated && user ? (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'user-info',
                    label: (
                      <div style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 500 }}>{user.display_name || user.username}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>@{user.username}</div>
                      </div>
                    ),
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    label: '退出登录',
                    icon: <LogoutOutlined />,
                    onClick: handleLogout,
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button
                type="text"
                style={{
                  height: 'auto',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px'
                }}
              >
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <span style={{ fontSize: '14px' }}>
                  {user.display_name || user.username}
                </span>
              </Button>
            </Dropdown>
          ) : (
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={handleLogin}
              style={{
                background: 'linear-gradient(135deg, #1890ff, #40a9ff)',
                border: 'none',
                borderRadius: '6px'
              }}
            >
              登录
            </Button>
          )}

          {/* Mobile Menu Button */}
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: 'white', fontSize: '20px' }} />}
              onClick={() => setMenuVisible(true)}
            />
          )}
        </div>
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
                <Route path="/ideation/:id" element={
                  <ProtectedRoute>
                    <IdeationTab />
                  </ProtectedRoute>
                } />
                <Route path="/ideation" element={
                  <ProtectedRoute>
                    <IdeationTab />
                  </ProtectedRoute>
                } />
                <Route path="/chat" element={
                  <ProtectedRoute>
                    <ChatTab />
                  </ProtectedRoute>
                } />
                <Route path="/script" element={
                  <ProtectedRoute>
                    <ScriptTab />
                  </ProtectedRoute>
                } />
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
                <Route path="/ideation/:id" element={
                  <ProtectedRoute>
                    <IdeationTab />
                  </ProtectedRoute>
                } />
                <Route path="/ideation" element={
                  <ProtectedRoute>
                    <IdeationTab />
                  </ProtectedRoute>
                } />
                <Route path="/chat" element={
                  <ProtectedRoute>
                    <ChatTab />
                  </ProtectedRoute>
                } />
                <Route path="/script" element={
                  <ProtectedRoute>
                    <ScriptTab />
                  </ProtectedRoute>
                } />
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
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </AuthProvider>
      </Router>
      <StagewiseToolbar />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
