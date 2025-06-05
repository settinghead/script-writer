import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, List, Button, Tag, Empty, Spin, Alert, Typography, Space } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;

interface OutlineSessionSummary {
    id: string;
    source_idea: string;
    source_idea_title?: string;
    source_artifact_id: string;
    ideation_run_id?: string;
    title?: string;
    genre?: string;
    total_episodes?: number;
    episode_duration?: number;
    created_at: string;
    status: 'active' | 'completed' | 'failed';
}

export const OutlinesList: React.FC = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<OutlineSessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await apiService.getOutlineSessions();
            setSessions(data);
        } catch (error) {
            console.error('Error loading outline sessions:', error);
            setError('Failed to load outline sessions');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (sessionId: string, sessionTitle: string) => {
        if (!confirm(`确定要删除大纲"${sessionTitle}"吗？此操作无法撤销。`)) {
            return;
        }

        try {
            setDeleting(sessionId);
            await apiService.deleteOutlineSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
        } catch (error) {
            console.error('Error deleting outline session:', error);
            alert('删除大纲时出错，请重试');
        } finally {
            setDeleting(null);
        }
    };

    const handleViewOutline = (sessionId: string) => {
                                navigate(`/projects/${sessionId}/outline`);
    };

    const handleViewSourceIdea = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session?.ideation_run_id) {
            navigate(`/ideation/${session.ideation_run_id}`);
        }
    };

    const handleCreateNew = () => {
        navigate('/new-outline');
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'completed':
                return <Tag color="success">已完成</Tag>;
            case 'active':
                return <Tag color="processing">生成中</Tag>;
            case 'failed':
                return <Tag color="error">失败</Tag>;
            default:
                return null;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const truncateText = (text: string, maxLength: number = 80) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
                action={
                    <Button onClick={loadSessions} size="small">
                        重试
                    </Button>
                }
            />
        );
    }

    return (
        <div style={{ padding: isMobile ? '0 8px' : '0 4px' }}>
            {sessions.length === 0 ? (
                <Empty
                    description="还没有大纲"
                    style={{ margin: '60px 0' }}
                    image={<FileTextOutlined style={{ fontSize: '64px', color: '#999' }} />}
                >
                    <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                        基于您的故事灵感生成详细的剧本大纲
                    </Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                        开始生成大纲
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
                    dataSource={sessions}
                    renderItem={(session) => (
                        <List.Item style={{ marginBottom: '16px' }}>
                            <Card
                                hoverable
                                style={{
                                    minHeight: '240px',
                                    height: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flex: 1,
                                    padding: isMobile ? '12px' : '16px'
                                }}
                                actions={[
                                    <Button
                                        key="view"
                                        type="text"
                                        icon={<EyeOutlined />}
                                        onClick={() => handleViewOutline(session.id)}
                                        style={{
                                            color: '#1890ff',
                                            fontSize: isMobile ? '12px' : '14px',
                                            padding: isMobile ? '4px 8px' : '4px 15px'
                                        }}
                                        size={isMobile ? 'small' : 'middle'}
                                    >
                                        {isMobile ? '查看' : '查看详情'}
                                    </Button>,
                                    session.ideation_run_id && (
                                        <Button
                                            key="source"
                                            type="text"
                                            icon={<FileTextOutlined />}
                                            onClick={() => handleViewSourceIdea(session.id)}
                                            style={{
                                                color: '#52c41a',
                                                fontSize: isMobile ? '12px' : '14px',
                                                padding: isMobile ? '4px 8px' : '4px 15px'
                                            }}
                                            size={isMobile ? 'small' : 'middle'}
                                            title="查看源故事灵感"
                                        >
                                            源灵感
                                        </Button>
                                    ),
                                    <Button
                                        key="delete"
                                        type="text"
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDelete(session.id, session.title || '无标题大纲')}
                                        loading={deleting === session.id}
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
                                ].filter(Boolean)}
                            >
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0
                                }}>
                                    {/* Title and Status */}
                                    <div style={{
                                        marginBottom: isMobile ? '8px' : '12px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '8px'
                                    }}>
                                        <Text strong style={{
                                            fontSize: isMobile ? '14px' : '16px',
                                            color: '#fff',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word',
                                            flex: 1
                                        }}>
                                            {session.title || '无标题大纲'}
                                        </Text>
                                        {getStatusTag(session.status)}
                                    </div>

                                    {/* Genre */}
                                    {session.genre && (
                                        <div style={{ marginBottom: isMobile ? '6px' : '8px' }}>
                                            <Tag color="blue" style={{ fontSize: '12px' }}>
                                                {session.genre}
                                            </Tag>
                                        </div>
                                    )}

                                    {/* Source Idea */}
                                    <div style={{ marginBottom: isMobile ? '8px' : '12px' }}>
                                        <Text type="secondary" style={{
                                            fontSize: isMobile ? '11px' : '12px',
                                            display: 'block',
                                            marginBottom: '4px'
                                        }}>
                                            <strong>源故事灵感:</strong> {session.source_idea_title || '无标题'}
                                        </Text>
                                        <Text type="secondary" style={{
                                            fontSize: isMobile ? '11px' : '12px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word'
                                        }}>
                                            {truncateText(session.source_idea)}
                                        </Text>
                                    </div>

                                    {/* Metadata */}
                                    <div style={{
                                        marginTop: 'auto',
                                        paddingTop: '8px'
                                    }}>
                                        <Space size={[8, 4]} wrap>
                                            <Text type="secondary" style={{ fontSize: '11px' }}>
                                                {formatDate(session.created_at)}
                                            </Text>
                                            {session.total_episodes && (
                                                <Tag size="small" color="default">
                                                    {session.total_episodes} 集
                                                </Tag>
                                            )}
                                            {session.episode_duration && (
                                                <Tag size="small" color="default">
                                                    每集 {session.episode_duration} 分钟
                                                </Tag>
                                            )}
                                        </Space>
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