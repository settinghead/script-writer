import React, { useState, useEffect } from 'react';
import { Card, List, Button, Tag, Empty, Spin, Alert, Typography, Space, Progress, Tooltip } from 'antd';
import {
    BulbOutlined,
    FileTextOutlined,
    PlusOutlined,
    EyeOutlined,
    PlayCircleOutlined,
    FileDoneOutlined,
    EditOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

interface ProjectFlow {
    id: string;
    title: string;
    description: string;
    currentPhase: 'brainstorming' | 'outline' | 'episodes' | 'scripts';
    status: 'active' | 'completed' | 'failed';
    platform?: string;
    genre?: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    createdAt: string;
    updatedAt: string;
    sourceType: 'brainstorm' | 'direct_outline';
    artifactCounts: {
        ideas: number;
        outlines: number;
        episodes: number;
        scripts: number;
    };
}

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch all project flows
    const {
        data: flows = [],
        isLoading: loading,
        error,
        refetch: loadFlows
    } = useQuery<ProjectFlow[]>({
        queryKey: ['project-flows'],
        queryFn: async () => {
            const response = await fetch('/api/flows');
            if (!response.ok) {
                throw new Error(`Failed to fetch flows: ${response.status}`);
            }
            return response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const handleCreateNew = () => {
        navigate('/ideation');
    };

    const handleViewFlow = (flow: ProjectFlow) => {
        // Navigate based on current phase
        switch (flow.currentPhase) {
            case 'brainstorming':
                if (flow.sourceType === 'brainstorm') {
                    navigate(`/ideation/${flow.id}`);
                } else {
                    navigate(`/projects/${flow.id}/outline`);
                }
                break;
            case 'outline':
                navigate(`/projects/${flow.id}/outline`);
                break;
            case 'episodes':
                navigate(`/projects/${flow.id}/episodes`);
                break;
            case 'scripts':
                navigate(`/projects/${flow.id}/scripts`);
                break;
            default:
                navigate(`/projects/${flow.id}/outline`);
        }
    };

    const getPhaseIcon = (phase: string) => {
        switch (phase) {
            case 'brainstorming':
                return <BulbOutlined />;
            case 'outline':
                return <FileTextOutlined />;
            case 'episodes':
                return <PlayCircleOutlined />;
            case 'scripts':
                return <FileDoneOutlined />;
            default:
                return <FileTextOutlined />;
        }
    };

    const getPhaseText = (phase: string) => {
        switch (phase) {
            case 'brainstorming':
                return '头脑风暴';
            case 'outline':
                return '大纲阶段';
            case 'episodes':
                return '分集阶段';
            case 'scripts':
                return '剧本阶段';
            default:
                return '未知阶段';
        }
    };

    const getPhaseColor = (phase: string) => {
        switch (phase) {
            case 'brainstorming':
                return '#faad14';
            case 'outline':
                return '#1890ff';
            case 'episodes':
                return '#52c41a';
            case 'scripts':
                return '#722ed1';
            default:
                return '#8c8c8c';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <LoadingOutlined spin />;
            case 'completed':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'failed':
                return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
            default:
                return null;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active':
                return '进行中';
            case 'completed':
                return '已完成';
            case 'failed':
                return '失败';
            default:
                return '';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getProgressValue = (flow: ProjectFlow) => {
        const phases = ['brainstorming', 'outline', 'episodes', 'scripts'];
        const currentIndex = phases.indexOf(flow.currentPhase);
        return ((currentIndex + 1) / phases.length) * 100;
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
                description={error instanceof Error ? error.message : '加载项目流程失败'}
                type="error"
                showIcon
                style={{ margin: '20px 0' }}
                action={
                    <Button onClick={() => loadFlows()} size="small">
                        重试
                    </Button>
                }
            />
        );
    }

    return (
        <div style={{ padding: isMobile ? '0 8px' : '0 4px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: isMobile ? '16px' : '20px',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '12px' : '0'
            }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0, color: '#fff' }}>
                    创作工作台
                </Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateNew}
                    size={isMobile ? 'middle' : 'large'}
                    style={isMobile ? { alignSelf: 'flex-start' } : {}}
                >
                    新建项目
                </Button>
            </div>

            {flows.length === 0 ? (
                <Empty
                    description="还没有项目流程"
                    style={{ margin: '60px 0' }}
                    image={<FileTextOutlined style={{ fontSize: '64px', color: '#999' }} />}
                >
                    <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                        开始您的创作之旅，从头脑风暴到完整剧本
                    </Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                        创建第一个项目
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
                    dataSource={flows}
                    renderItem={(flow) => (
                        <List.Item>
                            <Card
                                hoverable
                                style={{
                                    minHeight: '280px',
                                    height: 'auto',
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleViewFlow(flow)}
                                actions={[
                                    <Button
                                        key="view"
                                        type="text"
                                        icon={<EyeOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewFlow(flow);
                                        }}
                                        style={{ color: '#1890ff' }}
                                    >
                                        查看详情
                                    </Button>
                                ]}
                            >
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <Title level={4} style={{ margin: 0, color: '#fff' }}>
                                            {flow.title}
                                        </Title>
                                        <Tooltip title={getStatusText(flow.status)}>
                                            {getStatusIcon(flow.status)}
                                        </Tooltip>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <Tag
                                            icon={getPhaseIcon(flow.currentPhase)}
                                            color={getPhaseColor(flow.currentPhase)}
                                        >
                                            {getPhaseText(flow.currentPhase)}
                                        </Tag>
                                        {flow.sourceType === 'brainstorm' && (
                                            <Tag color="orange">从头脑风暴开始</Tag>
                                        )}
                                        {flow.sourceType === 'direct_outline' && (
                                            <Tag color="blue">直接大纲</Tag>
                                        )}
                                    </div>

                                    <Progress
                                        percent={getProgressValue(flow)}
                                        size="small"
                                        strokeColor={getPhaseColor(flow.currentPhase)}
                                        showInfo={false}
                                        style={{ marginBottom: '12px' }}
                                    />
                                </div>

                                <Paragraph
                                    style={{
                                        color: '#999',
                                        fontSize: '13px',
                                        marginBottom: '12px',
                                        minHeight: '40px'
                                    }}
                                    ellipsis={{ rows: 2 }}
                                >
                                    {flow.description || '暂无描述'}
                                </Paragraph>

                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    {flow.platform && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            平台: {flow.platform}
                                        </Text>
                                    )}
                                    {flow.genre && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            类型: {flow.genre}
                                        </Text>
                                    )}
                                    {flow.totalEpisodes && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {flow.totalEpisodes}集 · {flow.episodeDuration}分钟/集
                                        </Text>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                        <Space size="small">
                                            {flow.artifactCounts.ideas > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{flow.artifactCounts.ideas}个想法</Tag>
                                            )}
                                            {flow.artifactCounts.outlines > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{flow.artifactCounts.outlines}个大纲组件</Tag>
                                            )}
                                            {flow.artifactCounts.episodes > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{flow.artifactCounts.episodes}集大纲</Tag>
                                            )}
                                            {flow.artifactCounts.scripts > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{flow.artifactCounts.scripts}个剧本</Tag>
                                            )}
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            {formatDate(flow.updatedAt)}
                                        </Text>
                                    </div>
                                </Space>
                            </Card>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
};

export default HomePage; 