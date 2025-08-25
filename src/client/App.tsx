import React, { useState, useEffect } from 'react';
import '@ant-design/v5-patch-for-react-19';

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Layout, Button, Drawer, Menu, Dropdown, Avatar, App as AntdApp } from 'antd';
import { MenuOutlined, UserOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';
import LogoSvg from './components/LogoSvg';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectDataProvider } from './contexts/ProjectDataContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import ProjectsList from './components/ProjectList';
import ProjectLayout from './components/ProjectLayout';
import ProjectAccessGuard from './components/ProjectAccessGuard';
import Breadcrumb from './components/Breadcrumb';
import HealthCheck from './components/HealthCheck';

// Import design system and styled theme
import { ThemeProvider } from './styled-system';

// Import CSS for styling
import "./index.css";
import "./styles/utilities.css";

const { Header, Content } = Layout;

// Create a client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Disable aggressive refetching
    },
  },
});

// Wrapper component to provide ProjectDataProvider with projectId from route params
const ProjectLayoutWrapper: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <ProjectAccessGuard projectId={projectId}>
      <ProjectDataProvider projectId={projectId}>
        <ProjectLayout />
      </ProjectDataProvider>
    </ProjectAccessGuard>
  );
};

// Extracted common routes component to eliminate duplication
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/projects" element={
        <ProtectedRoute>
          <ProjectsList />
        </ProtectedRoute>
      } />
      <Route path="/projects/:projectId/*" element={
        <ProtectedRoute>
          <ProjectLayoutWrapper />
        </ProtectedRoute>
      }>
      </Route>




      <Route path="/" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [menuVisible, setMenuVisible] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Debug state from URL params
  const showRawGraph = searchParams.get('raw-graph') === '1';
  const showRawChat = searchParams.get('raw-chat') === '1';
  const showRawContext = searchParams.get('raw-context') === '1';
  const showParticleDebug = searchParams.get('particle-debug') === '1';
  const showAgentContext = searchParams.get('agent-context') === '1';

  // Toggle helpers mirroring DebugMenu behavior
  const toggleParam = (key: string, onKeysToClear: string[] = []) => {
    const next = new URLSearchParams(searchParams);
    if (next.get(key) === '1') {
      next.delete(key);
    } else {
      next.set(key, '1');
      onKeysToClear.forEach(k => next.delete(k));
    }
    setSearchParams(next);
  };

  const toggleRawGraph = () => toggleParam('raw-graph', ['raw-chat', 'raw-context', 'agent-context', 'particle-debug']);
  const toggleRawChat = () => toggleParam('raw-chat', ['raw-graph', 'raw-context', 'agent-context', 'particle-debug']);
  const toggleRawContext = () => toggleParam('raw-context', ['raw-graph', 'raw-chat', 'agent-context', 'particle-debug']);
  const toggleAgentContext = () => toggleParam('agent-context', ['raw-graph', 'raw-chat', 'raw-context', 'particle-debug']);
  const toggleParticleDebug = () => toggleParam('particle-debug', ['raw-graph', 'raw-chat', 'raw-context', 'agent-context']);

  // Core app navigation items
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

  // Drawer items for mobile (include auth actions)
  const drawerItems = (() => {
    if (isMobile) {
      const debugItems = [
        { type: 'divider' as const },
        { key: 'debug-title', label: '调试', disabled: true as const },
        { key: 'debug-raw-graph', label: showRawGraph ? '关闭图谱' : '打开图谱', onClick: toggleRawGraph },
        { key: 'debug-agent-context', label: showAgentContext ? '关闭Agent上下文' : 'Agent上下文', onClick: toggleAgentContext },
        { key: 'debug-raw-context', label: showRawContext ? '关闭工具调用' : '工具调用', onClick: toggleRawContext },
        { key: 'debug-raw-chat', label: showRawChat ? '关闭内部对话' : '打开内部对话', onClick: toggleRawChat },
        { key: 'debug-particle', label: showParticleDebug ? '关闭粒子搜索' : '粒子搜索', onClick: toggleParticleDebug },
        { type: 'divider' as const },
        { key: 'actions-title', label: '项目', disabled: true as const },
        { key: 'mobile-open-tree', label: '目录/地图', onClick: () => { setMenuVisible(false); window.history.replaceState(null, '', `${location.pathname}?rightDrawer=1`); window.dispatchEvent(new PopStateEvent('popstate')); } },
        { key: 'mobile-export', label: '导出', onClick: () => { setMenuVisible(false); toggleParam('export'); } },
        { key: 'mobile-settings', label: '设置', onClick: () => { setMenuVisible(false); toggleParam('projectSettings'); } },
      ];
      if (isAuthenticated && user) {
        return [
          {
            key: 'user-info',
            label: (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontWeight: 500 }}>{user.display_name || user.username}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>@{user.username}</div>
              </div>
            ),
            disabled: true as const,
          },
          { type: 'divider' as const },
          {
            key: 'logout',
            label: '退出登录',
            icon: <LogoutOutlined />,
            onClick: handleLogout,
          },
          { type: 'divider' as const },
          ...menuItems,
          ...debugItems,
        ];
      }
      return [
        {
          key: 'login',
          label: '登录',
          icon: <LoginOutlined />,
          onClick: handleLogin,
        },
        { type: 'divider' as const },
        ...menuItems,
        ...debugItems,
      ];
    }
    return menuItems;
  })();

  // Common content wrapper styles
  const getContentWrapperStyle = () => ({
    flexGrow: 1,
    overflow: isMobile ? 'auto' : 'hidden',
    padding: isMobile
      ? '0 10px'
      : (location.pathname.includes('/projects/') ? '0' : '20px'),
    display: 'flex',
    flexDirection: 'column' as const
  });

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{
        padding: '0px 10px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: "auto"
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
          <div
            onClick={() => navigate('/')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <LogoSvg
              style={{
                height: isMobile ? '22px' : '28px',
                width: 'auto',
                color: 'white',
                margin: isMobile ? '6px 8px' : '10px 16px',
                fill: 'currentColor'
              }}
            />
          </div>
          <Breadcrumb style={{
            margin: isMobile ? '0 8px' : '0 30px',
            flex: isMobile ? '1 1 auto' : undefined,
            minWidth: isMobile ? 0 : undefined
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px' }}>
          {/* User Authentication Section */}
          {!isMobile && isAuthenticated && user ? (
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
                  padding: isMobile ? '2px 4px' : '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '0px' : '8px',
                  color: 'white',
                  border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px'
                }}
              >
                <Avatar
                  size={isMobile ? 'small' : 'small'}
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
                />
                {!isMobile && (
                  <span style={{ fontSize: '14px' }}>
                    {user.display_name || user.username}
                  </span>
                )}
              </Button>
            </Dropdown>
          ) : (!isMobile && (
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
          ))}

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
        {/* Mobile Drawer Menu */}
        {isMobile && (
          <Drawer
            title="菜单"
            placement="right"
            onClose={() => setMenuVisible(false)}
            open={menuVisible}
            style={{ padding: 0 }}
          >
            <Menu
              mode="vertical"
              items={drawerItems}
              style={{ height: '100%' }}
            />
          </Drawer>
        )}

        {/* Unified Content Area */}
        <div style={getContentWrapperStyle()}>
          <AppRoutes />
        </div>
      </Content>
    </Layout>
  );
};

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AntdApp>
          <HealthCheck>
            <Router>
              <AuthProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/*" element={<AppContent />} />
                </Routes>
              </AuthProvider>
            </Router>
          </HealthCheck>
        </AntdApp>
      </ThemeProvider>
      {!isMobile && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
