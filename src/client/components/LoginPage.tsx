import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Typography, Alert, Spin, Form } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

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
                throw new Error('Failed to load test users');
            }

            const data = await response.json();
            setTestUsers(data.users || []);
        } catch (error) {
            console.error('Failed to load test users:', error);
            setUsersError('Failed to load test users');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleLogin = async () => {
        if (!selectedUser) {
            return;
        }

        clearError();

        const success = await login('dropdown', selectedUser);
        if (success) {
            // Redirect to the page they were trying to access, or default to /script
            navigate(from, { replace: true });
        }
    };

    const handleUserChange = (value: string) => {
        setSelectedUser(value);
        clearError();
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)',
            padding: '20px'
        }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    borderRadius: '12px',
                    border: '1px solid #333'
                }}
                bodyStyle={{
                    padding: '40px 32px'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1890ff, #40a9ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 4px 16px rgba(24, 144, 255, 0.3)'
                    }}>
                        <UserOutlined style={{ fontSize: '32px', color: 'white' }} />
                    </div>
                    <Title level={2} style={{ margin: '0 0 8px', color: '#fff' }}>
                        登录 Script Aid
                    </Title>
                    <Text type="secondary">
                        请选择测试用户登录
                    </Text>
                </div>

                <Form layout="vertical" onFinish={handleLogin}>
                    <Form.Item
                        label={<span style={{ color: '#d9d9d9' }}>选择用户</span>}
                        validateStatus={error ? 'error' : ''}
                        help={error}
                    >
                        <Select
                            placeholder="请选择测试用户"
                            value={selectedUser}
                            onChange={handleUserChange}
                            size="large"
                            loading={loadingUsers}
                            style={{ width: '100%' }}
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
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        padding: '4px 0'
                                    }}>
                                        <UserOutlined style={{
                                            marginRight: '8px',
                                            color: '#1890ff',
                                            flexShrink: 0,
                                            fontSize: '14px'
                                        }} />
                                        <div style={{
                                            flex: 1,
                                            minWidth: 0,
                                            overflow: 'hidden',
                                            lineHeight: '1.2'
                                        }}>
                                            <div style={{
                                                fontWeight: 500,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                fontSize: '14px',
                                                marginBottom: user.display_name ? '2px' : '0'
                                            }}>
                                                {user.display_name || user.username}
                                            </div>
                                            {user.display_name && (
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: '#666',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    lineHeight: '1'
                                                }}>
                                                    @{user.username}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {usersError && (
                        <Alert
                            type="error"
                            message={usersError}
                            style={{ marginBottom: '16px' }}
                            action={
                                <Button
                                    size="small"
                                    type="text"
                                    onClick={loadTestUsers}
                                >
                                    重试
                                </Button>
                            }
                        />
                    )}

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={isLoading}
                            disabled={!selectedUser || loadingUsers}
                            style={{
                                width: '100%',
                                height: '48px',
                                borderRadius: '8px',
                                fontWeight: 500,
                                background: selectedUser ? 'linear-gradient(135deg, #1890ff, #40a9ff)' : undefined,
                                border: 'none',
                                boxShadow: selectedUser ? '0 4px 16px rgba(24, 144, 255, 0.3)' : undefined
                            }}
                        >
                            {isLoading ? '登录中...' : '登录'}
                        </Button>
                    </Form.Item>
                </Form>

                <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    background: 'rgba(24, 144, 255, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(24, 144, 255, 0.2)'
                }}>
                    <Text style={{ color: '#40a9ff', fontSize: '13px' }}>
                        <strong>测试说明：</strong>这是测试登录页面，选择任意用户即可登录系统。
                        未来将支持微信、微博、短信等多种登录方式。
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default LoginPage; 