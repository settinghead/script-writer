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
    Modal
} from 'antd';
import {
    EyeOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    FileTextOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Title, Text } = Typography;

interface OutlineSessionSummary {
    id: string;
    ideationSessionId: string;
    status: 'active' | 'completed';
    title?: string;
    createdAt: string;
}

const OutlinesList: React.FC = () => {
    const navigate = useNavigate();
    const [outlines, setOutlines] = useState<OutlineSessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        fetchOutlines();

        // Handle window resize for mobile detection
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchOutlines = async () => {
        try {
            const response = await fetch('/api/outlines');
            if (!response.ok) {
                throw new Error(`Failed to fetch outlines: ${response.status}`);
            }

            const data = await response.json();
            setOutlines(data);
        } catch (err) {
            console.error('Error fetching outlines:', err);
            setError(err instanceof Error ? err.message : 'Failed to load outlines');
        } finally {
            setLoading(false);
        }
    };

    const handleViewOutline = (id: string) => {
        navigate(`/outlines/${id}`);
    };

    const handleCreateNew = () => {
        navigate('/ideation');
    };

    const handleDeleteOutline = async (id: string, title: string) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除大纲 "${title}" 吗？此操作无法撤销。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const response = await fetch(`/api/outlines/${id}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to delete outline: ${response.status}`);
                    }

                    // Remove from local state to update UI immediately
                    setOutlines(prevOutlines => prevOutlines.filter(outline => outline.id !== id));

                    // Show success message
                    Modal.success({
                        title: '删除成功',
                        content: '大纲已成功删除',
                    });
                } catch (err) {
                    console.error('Error deleting outline:', err);
                    Modal.error({
                        title: '删除失败',
                        content: '删除失败，请重试。',
                    });
                }
            }
        });
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
        if (!text) return '';
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    };

    const generateTitle = (outline: OutlineSessionSummary) => {
        const maxLength = isMobile ? 30 : 40;

        // Use outline title if available
        if (outline.title && outline.title.trim()) {
            return truncateText(outline.title, maxLength);
        }

        // Fallback to a more descriptive title with session ID
        return `故事大纲 (${outline.id.slice(0, 8)}...)`;
    };

    const generateDescription = (outline: OutlineSessionSummary) => {
        // Show status and creation time
        const statusText = outline.status === 'completed' ? '已完成' : '进行中';
        const timeText = formatDate(outline.createdAt);

        if (outline.title && outline.title.trim()) {
            return `${statusText} · ${timeText}`;
        } else {
            return `${statusText} · ${timeText} · 无标题`;
        }
    };

    const getOutlineTags = (outline: OutlineSessionSummary) => {
        const tags = [];

        if (outline.status === 'completed') {
            tags.push({ text: '已完成', color: 'green' });
        } else {
            tags.push({ text: '进行中', color: 'orange' });
        }

        return tags;
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
        <div style={{ padding: isMobile ? '0 8px' : '0 4px' }}>
            {outlines.length === 0 ? (
                <Empty
                    description="还没有创建过大纲"
                    style={{ margin: '60px 0' }}
                >
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                        创建第一个灵感
                    </Button>
                </Empty>
            ) : (
                <List
                    grid={{
                        gutter: [16, 24],
                        xs: 1,
                        sm: 1,
                        md: 2,
                        lg: 2,
                        xl: 3,
                        xxl: 3,
                    }}
                    dataSource={outlines}
                    renderItem={(outline) => (
                        <List.Item style={{ marginBottom: '16px' }}>
                            <Card
                                hoverable
                                style={{
                                    minHeight: '220px',
                                    height: 'auto',
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: isMobile ? '12px' : '16px'
                                }}
                                actions={[
                                    <Button
                                        key="view"
                                        type="text"
                                        icon={<EyeOutlined />}
                                        onClick={() => handleViewOutline(outline.id)}
                                        style={{
                                            color: '#1890ff',
                                            fontSize: isMobile ? '12px' : '14px',
                                            padding: isMobile ? '4px 8px' : '4px 15px'
                                        }}
                                        size={isMobile ? 'small' : 'middle'}
                                    >
                                        {isMobile ? '查看' : '查看详情'}
                                    </Button>,
                                    <Button
                                        key="delete"
                                        type="text"
                                        icon={<DeleteOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteOutline(outline.id, generateTitle(outline));
                                        }}
                                        style={{
                                            color: '#ff4d4f',
                                            fontSize: isMobile ? '12px' : '14px',
                                            padding: isMobile ? '4px 8px' : '4px 15px'
                                        }}
                                        size={isMobile ? 'small' : 'middle'}
                                        danger
                                    >
                                        删除
                                    </Button>
                                ]}
                            >
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0
                                }}>
                                    <div style={{ marginBottom: isMobile ? '8px' : '12px' }}>
                                        <Text strong style={{
                                            fontSize: isMobile ? '14px' : '16px',
                                            color: '#fff',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word'
                                        }}>
                                            {generateTitle(outline)}
                                        </Text>
                                    </div>

                                    <div style={{ marginBottom: isMobile ? '8px' : '12px' }}>
                                        <Text type="secondary" style={{
                                            fontSize: isMobile ? '12px' : '13px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word'
                                        }}>
                                            {generateDescription(outline)}
                                        </Text>
                                    </div>

                                    <div style={{
                                        marginBottom: isMobile ? '6px' : '8px',
                                        flex: '0 0 auto'
                                    }}>
                                        <Space size={[4, 4]} wrap>
                                            {getOutlineTags(outline).map((tag, index) => (
                                                <Tag
                                                    key={index}
                                                    color={tag.color}
                                                    style={{
                                                        fontSize: isMobile ? '10px' : '11px',
                                                        margin: '2px 0',
                                                        padding: isMobile ? '0 4px' : '0 6px'
                                                    }}
                                                >
                                                    {tag.text}
                                                </Tag>
                                            ))}
                                        </Space>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginTop: 'auto',
                                        paddingTop: '4px',
                                        flex: '0 0 auto'
                                    }}>
                                        <ClockCircleOutlined style={{
                                            marginRight: '4px',
                                            fontSize: isMobile ? '11px' : '12px',
                                            color: '#888'
                                        }} />
                                        <Text type="secondary" style={{
                                            fontSize: isMobile ? '11px' : '12px'
                                        }}>
                                            {formatDate(outline.createdAt)}
                                        </Text>
                                    </div>
                                </div>
                            </Card>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
};

export default OutlinesList; 