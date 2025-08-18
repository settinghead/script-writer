import React, { useState, useEffect } from 'react';
import { Select, Button, Typography, Alert, Spin, Form } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { StyledCard, StyledButton, Container, Inline } from './shared/StyledComponents';
import { DesignTokens } from '@/common/theme/designSystem';
import { AppColors } from '@/common/theme/colors';

const { Title, Text } = Typography;
const { Option } = Select;

interface TestUser {
    username: string;
    display_name?: string;
}

const LoginPage: React.FC = () => {
    const [testUsers, setTestUsers] = useState<TestUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);

    const { login, isLoading, error, clearError } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Get redirect path from location state, default to /script
    const from = (location.state as any)?.from?.pathname || '/script';

    useEffect(() => {
        loadTestUsers();
    }, []);

    const loadTestUsers = async () => {
        try {
            setLoadingUsers(true);
            setUsersError(null);

            const response = await fetch('/auth/test-users', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to load test users: ${response.status}`);
            }

            const data = await response.json();
            const users = data.users || [];
            setTestUsers(users);

            // Auto-select first user if available
            if (users.length > 0 && !selectedUser) {
                setSelectedUser(users[0].username);
            }
        } catch (error) {
            console.error('Error loading test users:', error);
            setUsersError('Failed to load test users. Please try again.');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleLogin = async () => {
        if (!selectedUser) return;

        try {
            const result = await login('test', selectedUser);
            if (result) {
                navigate(from, { replace: true });
            }
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    const handleUserChange = (value: string) => {
        setSelectedUser(value);
        clearError();
    };

    return (
        <div className="min-h-screen flex-center gradient-card p-lg">
            <Container size="sm">
                <StyledCard
                    variant="elevated"
                    style={{
                        maxWidth: '400px',
                        margin: '0 auto',
                        padding: `${DesignTokens.spacing.xxl}px ${DesignTokens.spacing.xl}px`,
                    }}
                >
                    {/* Header Section */}
                    <div className="flex-col-center mb-xl">
                        <div className="flex-center rounded-full shadow-glow-ai mb-md animate-bounce-subtle"
                            style={{
                                width: '64px',
                                height: '64px',
                                background: AppColors.ai.gradient,
                            }}>
                            <UserOutlined style={{ fontSize: '32px', color: 'white' }} />
                        </div>
                        <Title
                            level={2}
                            className="text-gradient-ai mb-sm animate-fade-in"
                            style={{ margin: 0 }}
                        >
                            登录 觅光助创
                        </Title>
                        <Text type="secondary" className="animate-fade-in animate-delay-200">
                            请选择测试用户登录
                        </Text>
                    </div>

                    {/* Login Form */}
                    <Form layout="vertical" onFinish={handleLogin} className="animate-slide-up animate-delay-300">
                        <Form.Item
                            label={<span style={{ color: AppColors.text.primary }}>选择用户</span>}
                            validateStatus={error ? 'error' : ''}
                            help={error}
                            className="mb-lg"
                        >
                            <Select
                                placeholder="请选择测试用户"
                                value={selectedUser}
                                onChange={handleUserChange}
                                size="large"
                                loading={loadingUsers}
                                className="w-full focus-ring"
                                suffixIcon={loadingUsers ? <Spin size="small" /> : undefined}
                                dropdownStyle={{
                                    maxWidth: '100%'
                                }}
                                optionLabelProp="label"
                            >
                                {testUsers.map(user => (
                                    <Option
                                        key={user.username}
                                        value={user.username}
                                        label={user.display_name || user.username}
                                    >
                                        <Inline gap="sm" className="py-xs">
                                            <UserOutlined className="text-gradient-ai" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-ellipsis" style={{
                                                    fontWeight: DesignTokens.typography.fontWeight.medium,
                                                    fontSize: DesignTokens.typography.fontSize.sm,
                                                    marginBottom: user.display_name ? '2px' : '0'
                                                }}>
                                                    {user.display_name || user.username}
                                                </div>
                                                {user.display_name && (
                                                    <div className="text-ellipsis" style={{
                                                        fontSize: DesignTokens.typography.fontSize.xs,
                                                        color: AppColors.text.muted,
                                                    }}>
                                                        @{user.username}
                                                    </div>
                                                )}
                                            </div>
                                        </Inline>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        {/* Error Alert */}
                        {usersError && (
                            <Alert
                                type="error"
                                message={usersError}
                                className="mb-md rounded-md animate-slide-up"
                                action={
                                    <Button
                                        size="small"
                                        type="text"
                                        onClick={loadTestUsers}
                                        className="hover-lift"
                                    >
                                        重试
                                    </Button>
                                }
                            />
                        )}

                        {/* Login Button */}
                        <Form.Item style={{ marginBottom: 0 }}>
                            <StyledButton
                                variant="ai"
                                htmlType="submit"
                                size="large"
                                loading={isLoading}
                                disabled={!selectedUser || loadingUsers}
                                glow={!!selectedUser}
                                animated
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    fontSize: DesignTokens.typography.fontSize.base,
                                    fontWeight: DesignTokens.typography.fontWeight.medium,
                                }}
                                className="hover-lift focus-ring-ai"
                            >
                                {isLoading ? '登录中...' : '登录'}
                            </StyledButton>
                        </Form.Item>
                    </Form>

                    {/* Info Panel */}
                    <div className="mt-lg p-md rounded-md glass animate-slide-up animate-delay-500"
                        style={{
                            border: `1px solid ${AppColors.ai.primary}40`,
                        }}>
                        <Text style={{
                            color: AppColors.ai.primary,
                            fontSize: DesignTokens.typography.fontSize.sm
                        }}>
                            <strong>测试说明：</strong>这是测试登录页面，选择任意用户即可登录系统。
                            未来将支持微信、微博、短信等多种登录方式。
                        </Text>
                    </div>
                </StyledCard>
            </Container>
        </div>
    );
};

export default LoginPage; 