import React, { useState, useEffect } from 'react';
import '@ant-design/v5-patch-for-react-19';

import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Layout, Typography, ConfigProvider, theme, Button, Drawer, Menu, Dropdown, Avatar } from 'antd';
import { MenuOutlined, UserOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import IdeationTab from './components/IdeationTab';
import ProjectsList from './components/IdeationsList';
import HomePage from './components/HomePage';
import { OutlineTab } from './components/OutlineTab';
import ChatTab from './components/ChatTab';
import ScriptTab from './components/ScriptTab';
import ProjectLayout from './components/ProjectLayout';
import ProjectBrainstormPage from './components/ProjectBrainstormPage';
import Breadcrumb from './components/Breadcrumb';
import StagewiseToolbar from './components/StagewiseToolbar';
import { StageDetailView } from './components/StageDetailView';
import NewProjectFromBrainstormPage from './components/NewProjectFromBrainstormPage';

// Import CSS for any custom styling needed
import "./index.css";

const { Header, Content } = Layout;
const { Title } = Typography;

// Create a client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Disable aggressive refetching
    },
  },
});

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

  // Mobile menu items
  const menuItems = [
    {
      key: 'projects',
      label: '创作工作台',
      onClick: () => handleMenuClick('/projects')
    },
    {
      key: 'ideation',
      label: '新建灵感',
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

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{
        padding: '0 20px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={3} style={{ color: 'white', margin: '16px 0' }}>觅光助手</Title>
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
      <Content style={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
                items={menuItems}
                style={{ height: '100%' }}
              />
            </Drawer>
            <div style={{ flexGrow: 1, overflow: 'auto', padding: '0 10px' }}>
              <Breadcrumb />
              <Routes>
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <ProjectsList />
                  </ProtectedRoute>
                } />
                <Route path="/projects/:projectId/*" element={
                  <ProtectedRoute>
                      <ProjectLayout />
                  </ProtectedRoute>
                }>
                  <Route path="brainstorm" element={<ProjectBrainstormPage />} />
                  <Route path="stage/:stageId" element={<StageDetailView />} />
                </Route>
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
                <Route path="/new-outline" element={
                  <ProtectedRoute>
                    <OutlineTab />
                  </ProtectedRoute>
                } />
                <Route path="/outlines" element={
                  <ProtectedRoute>
                    <OutlineTab />
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
                <Route path="/new-project-from-brainstorming" element={
                  <ProtectedRoute>
                    <NewProjectFromBrainstormPage />
                  </ProtectedRoute>
                } />
                <Route path="/" element={<Navigate to="/projects" replace />} />
              </Routes>
            </div>
          </>
        ) : (
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Content Area with Breadcrumbs */}
            <div style={{
              flexGrow: 1,
              overflow: 'hidden',
              padding: location.pathname.includes('/projects/') ? '0' : '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Breadcrumb />
              <Routes>
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <ProjectsList />
                  </ProtectedRoute>
                } />
                <Route path="/projects/:projectId/*" element={
                  <ProtectedRoute>
                      <ProjectLayout />
                  </ProtectedRoute>
                }>
                  <Route path="brainstorm" element={<ProjectBrainstormPage />} />
                  {/* Add other project sub-routes here in the future */}
                </Route>
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
                <Route path="/new-outline" element={
                  <ProtectedRoute>
                    <OutlineTab />
                  </ProtectedRoute>
                } />
                <Route path="/outlines" element={
                  <ProtectedRoute>
                    <OutlineTab />
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
                <Route path="/new-project-from-brainstorming" element={
                  <ProtectedRoute>
                    <NewProjectFromBrainstormPage />
                  </ProtectedRoute>
                } />
                <Route path="/" element={<Navigate to="/projects" replace />} />
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
    <QueryClientProvider client={queryClient}>
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
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
