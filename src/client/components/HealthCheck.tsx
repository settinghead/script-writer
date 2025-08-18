import React, { useState, useEffect, ReactNode } from 'react';
import { Alert, Spin, Typography, Button, Space } from 'antd';
import { ExclamationTriangleOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface HealthCheckResponse {
    status: string;
    timestamp: string;
    uptime: number;
    memory: any;
    version: string;
    environment: string;
    particleSystem: boolean;
}

interface HealthCheckProps {
    children: ReactNode;
    checkInterval?: number; // in milliseconds, default 30 seconds
}

interface HealthStatus {
    isHealthy: boolean;
    isLoading: boolean;
    error: string | null;
    lastCheck: Date | null;
    serverInfo: HealthCheckResponse | null;
}

const HealthCheck: React.FC<HealthCheckProps> = ({
    children,
    checkInterval = 30000 // 30 seconds
}) => {
    const [healthStatus, setHealthStatus] = useState<HealthStatus>({
        isHealthy: true, // Start optimistic
        isLoading: true,
        error: null,
        lastCheck: null,
        serverInfo: null
    });

    const performHealthCheck = async () => {
        try {
            setHealthStatus(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await fetch('/health', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const serverInfo: HealthCheckResponse = await response.json();

            if (serverInfo.status !== 'ok') {
                throw new Error(`Server status is not ok: ${serverInfo.status}`);
            }

            setHealthStatus({
                isHealthy: true,
                isLoading: false,
                error: null,
                lastCheck: new Date(),
                serverInfo
            });

        } catch (error) {
            console.error('Health check failed:', error);

            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            setHealthStatus({
                isHealthy: false,
                isLoading: false,
                error: errorMessage,
                lastCheck: new Date(),
                serverInfo: null
            });
        }
    };

    // Perform initial health check and set up interval
    useEffect(() => {
        performHealthCheck();

        const intervalId = setInterval(performHealthCheck, checkInterval);

        return () => clearInterval(intervalId);
    }, [checkInterval]);

    // Manual retry function
    const handleRetry = () => {
        performHealthCheck();
    };

    // If server is healthy, render children normally
    if (healthStatus.isHealthy) {
        return <>{children}</>;
    }

    // If server is unhealthy, show error page
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#141414', // Dark background to match theme
            padding: '20px'
        }}>
            <div style={{
                maxWidth: '600px',
                width: '100%',
                textAlign: 'center'
            }}>
                {healthStatus.isLoading ? (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Spin size="large" />
                        <Text style={{ color: 'white' }}>正在检查服务器状态...</Text>
                    </Space>
                ) : (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <ExclamationTriangleOutlined
                            style={{
                                fontSize: '64px',
                                color: '#ff4d4f'
                            }}
                        />

                        <Title level={2} style={{ color: 'white', margin: 0 }}>
                            服务器连接失败
                        </Title>

                        <Alert
                            message="服务器不可用"
                            description={
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    <Text>无法连接到后端服务器。请检查服务器是否正常运行。</Text>
                                    <Text code style={{ fontSize: '12px' }}>
                                        错误详情: {healthStatus.error}
                                    </Text>
                                    {healthStatus.lastCheck && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            最后检查时间: {healthStatus.lastCheck.toLocaleString()}
                                        </Text>
                                    )}
                                </Space>
                            }
                            type="error"
                            showIcon
                        />

                        <Space>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                loading={healthStatus.isLoading}
                                onClick={handleRetry}
                            >
                                重新检查
                            </Button>

                            <Button
                                onClick={() => window.location.reload()}
                                ghost
                            >
                                刷新页面
                            </Button>
                        </Space>

                        <Alert
                            message="可能的解决方案"
                            description={
                                <div style={{ textAlign: 'left' }}>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        <li>确认开发服务器正在运行 (npm run dev)</li>
                                        <li>检查网络连接是否正常</li>
                                        <li>确认服务器端口 (通常是 4600) 可以访问</li>
                                        <li>查看控制台日志以获取更多信息</li>
                                        <li>如果问题持续存在，请联系技术支持</li>
                                    </ul>
                                </div>
                            }
                            type="info"
                            showIcon
                        />
                    </Space>
                )}
            </div>
        </div>
    );
};

export default HealthCheck;
