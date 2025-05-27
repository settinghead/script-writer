import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    List,
    Card,
    Typography,
    Tag,
    Button,
    Spin,
    Alert,
    Empty,
    Space,
    Descriptions
} from 'antd';
import {
    EyeOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    BulbOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Title, Text, Paragraph } = Typography;

interface IdeationRun {
    id: string;
    user_input: string;
    selected_platform: string;
    created_at: string;
    // Add other fields as needed
}

const IdeationsList: React.FC = () => {
    const navigate = useNavigate();
    const [ideations, setIdeations] = useState<IdeationRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchIdeations();
    }, []);

    const fetchIdeations = async () => {
        try {
            const response = await fetch('/api/ideations');
            if (!response.ok) {
                throw new Error(`Failed to fetch ideations: ${response.status}`);
            }

            const data = await response.json();
            setIdeations(data);
        } catch (err) {
            console.error('Error fetching ideations:', err);
            setError(err instanceof Error ? err.message : 'Failed to load ideations');
        } finally {
            setLoading(false);
        }
    };

    const handleViewIdeation = (id: string) => {
        navigate(`/ideation/${id}`);
    };

    const handleCreateNew = () => {
        navigate('/ideation');
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return formatDistanceToNow(date, {
                addSuffix: true,
                locale: zhCN
            });
        } catch {
            return dateString;
        }
    };

    const truncateText = (text: string, maxLength: number = 60) => {
        if (!text) return '未设置';
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert
                message="加载失败"
                description={error}
                type="error"
                showIcon
                style={{ margin: '20px 0' }}
            />
        );
    }

    return (
        <div style={{ padding: '0 4px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <Title level={2} style={{ margin: 0, color: '#fff' }}>
                    <BulbOutlined style={{ marginRight: '8px' }} />
                    灵感历史
                </Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateNew}
                    size="large"
                >
                    新建灵感
                </Button>
            </div>

            {ideations.length === 0 ? (
                <Empty
                    description="还没有创建过灵感"
                    style={{ margin: '60px 0' }}
                >
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                        创建第一个灵感
                    </Button>
                </Empty>
            ) : (
                <List
                    grid={{
                        gutter: 16,
                        xs: 1,
                        sm: 1,
                        md: 2,
                        lg: 2,
                        xl: 3,
                        xxl: 3,
                    }}
                    dataSource={ideations}
                    renderItem={(ideation) => (
                        <List.Item>
                            <Card
                                hoverable
                                style={{
                                    height: '200px',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                                bodyStyle={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '16px'
                                }}
                                actions={[
                                    <Button
                                        key="view"
                                        type="text"
                                        icon={<EyeOutlined />}
                                        onClick={() => handleViewIdeation(ideation.id)}
                                        style={{ color: '#1890ff' }}
                                    >
                                        查看详情
                                    </Button>
                                ]}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <Text strong style={{ fontSize: '16px', color: '#fff' }}>
                                            {truncateText(ideation.user_input, 40) || '未命名灵感'}
                                        </Text>
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                        <Text type="secondary" style={{ fontSize: '13px' }}>
                                            {truncateText(ideation.user_input, 80)}
                                        </Text>
                                    </div>

                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        {ideation.selected_platform && (
                                            <div>
                                                <Tag color="blue" style={{ fontSize: '12px' }}>
                                                    {ideation.selected_platform}
                                                </Tag>
                                            </div>
                                        )}

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginTop: 'auto',
                                            paddingTop: '8px'
                                        }}>
                                            <ClockCircleOutlined style={{
                                                marginRight: '4px',
                                                fontSize: '12px',
                                                color: '#888'
                                            }} />
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                {formatDate(ideation.created_at)}
                                            </Text>
                                        </div>
                                    </Space>
                                </div>
                            </Card>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
};

export default IdeationsList; 