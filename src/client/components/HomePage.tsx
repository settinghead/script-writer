import React, { useState, useEffect } from 'react';
import { Card, List, Button, Tag, Empty, Spin, Alert, Typography, Space, Progress, Tooltip, Modal } from 'antd';
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
    ExclamationCircleOutlined,
    ThunderboltOutlined,
    FormOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

// Updated interface to match ProjectService.listUserProjects() return type
interface ProjectSummary {
    id: string;
    name: string;
    description: string;
    currentPhase: 'brainstorming' | 'outline' | 'episodes' | 'scripts';
    status: 'active' | 'completed' | 'failed';
    platform?: string;
    genre?: string;
    createdAt: string;
    updatedAt: string;
    artifactCounts: {
        ideations: number;
        outlines: number;
        episodes: number;
        scripts: number;
    };
}

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch all projects from the new endpoint
    const {
        data: projects = [],
        isLoading: loading,
        error,
        refetch: loadProjects
    } = useQuery<ProjectSummary[]>({
        queryKey: ['user-projects'],
        queryFn: async () => {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error(`Failed to fetch projects: ${response.status}`);
            }
            return response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const handleCreateNew = () => {
        setShowCreateModal(true);
    };

    const handleCreateWithBrainstorm = () => {
        setShowCreateModal(false);
        navigate('/ideation');
    };

    const handleCreateWithDirectOutline = () => {
        setShowCreateModal(false);
        navigate('/projects/new/outline');
    };

    const handleViewProject = (project: ProjectSummary) => {
        // Navigate based on current phase
        switch (project.currentPhase) {
            case 'brainstorming':
                navigate('/ideation');
                break;
            case 'outline':
                navigate(`/projects/${project.id}/outline`);
                break;
            case 'episodes':
                navigate(`/projects/${project.id}/episodes`);
                break;
            case 'scripts':
                navigate(`/projects/${project.id}/scripts`);
                break;
            default:
                navigate('/ideation');
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

    const getProgressValue = (project: ProjectSummary) => {
        const phases = ['brainstorming', 'outline', 'episodes', 'scripts'];
        const currentIndex = phases.indexOf(project.currentPhase);
        return ((currentIndex + 1) / phases.length) * 100;
    };

    const renderStageProgression = (project: ProjectSummary) => {
        const stages = [
            { key: 'brainstorming', label: '创意构思', icon: <BulbOutlined /> },
            { key: 'outline', label: '大纲设计', icon: <FileTextOutlined /> },
            { key: 'episodes', label: '分集大纲', icon: <PlayCircleOutlined /> },
            { key: 'scripts', label: '剧本创作', icon: <FileDoneOutlined /> }
        ];

        const currentIndex = stages.findIndex(stage => stage.key === project.currentPhase);

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                padding: '8px 0'
            }}>
                {stages.map((stage, index) => {
                    const isActive = index === currentIndex;
                    const isCompleted = index < currentIndex;
                    const isFuture = index > currentIndex;

                    return (
                        <React.Fragment key={stage.key}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                opacity: isFuture ? 0.4 : 1,
                                transition: 'opacity 0.3s ease'
                            }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    backgroundColor: isActive
                                        ? getPhaseColor(project.currentPhase)
                                        : isCompleted
                                            ? '#52c41a'
                                            : '#434343',
                                    color: isActive || isCompleted ? '#fff' : '#999',
                                    border: isActive ? `2px solid ${getPhaseColor(project.currentPhase)}` : 'none',
                                    boxShadow: isActive ? `0 0 8px ${getPhaseColor(project.currentPhase)}40` : 'none'
                                }}>
                                    {isCompleted ? <CheckCircleOutlined style={{ fontSize: '12px' }} /> : stage.icon}
                                </div>
                                <Text style={{
                                    fontSize: '10px',
                                    marginTop: '4px',
                                    color: isActive
                                        ? getPhaseColor(project.currentPhase)
                                        : isCompleted
                                            ? '#52c41a'
                                            : isFuture
                                                ? '#666'
                                                : '#999',
                                    fontWeight: isActive ? 'bold' : 'normal',
                                    textAlign: 'center'
                                }}>
                                    {stage.label}
                                </Text>
                            </div>
                            {index < stages.length - 1 && (
                                <div style={{
                                    flex: 1,
                                    height: '2px',
                                    margin: '0 8px',
                                    backgroundColor: index < currentIndex ? '#52c41a' : '#434343',
                                    opacity: index >= currentIndex ? 0.4 : 1,
                                    transition: 'all 0.3s ease'
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
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
                description={error instanceof Error ? error.message : '加载项目失败'}
                type="error"
                showIcon
                style={{ margin: '20px 0' }}
                action={
                    <Button onClick={() => loadProjects()} size="small">
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

            {projects.length === 0 ? (
                <Empty
                    description="还没有项目"
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
                    dataSource={projects}
                    renderItem={(project) => (
                        <List.Item>
                            <Card
                                hoverable
                                style={{
                                    minHeight: '280px',
                                    height: 'auto',
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleViewProject(project)}
                                actions={[
                                    <Button
                                        key="view"
                                        type="text"
                                        icon={<EyeOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewProject(project);
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
                                            {project.name}
                                        </Title>
                                        <Tooltip title={getStatusText(project.status)}>
                                            {getStatusIcon(project.status)}
                                        </Tooltip>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        {renderStageProgression(project)}
                                    </div>
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
                                    {project.description || '暂无描述'}
                                </Paragraph>

                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    {project.platform && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            平台: {project.platform}
                                        </Text>
                                    )}
                                    {project.genre && (
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            类型: {project.genre}
                                        </Text>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                        <Space size="small">
                                            {project.artifactCounts.ideations > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{project.artifactCounts.ideations}个想法</Tag>
                                            )}
                                            {project.artifactCounts.outlines > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{project.artifactCounts.outlines}个大纲</Tag>
                                            )}
                                            {project.artifactCounts.episodes > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{project.artifactCounts.episodes}集大纲</Tag>
                                            )}
                                            {project.artifactCounts.scripts > 0 && (
                                                <Tag style={{ fontSize: '11px' }}>{project.artifactCounts.scripts}个剧本</Tag>
                                            )}
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            {formatDate(project.updatedAt)}
                                        </Text>
                                    </div>
                                </Space>
                            </Card>
                        </List.Item>
                    )}
                />
            )}

            {/* Create Project Modal */}
            <Modal
                title="选择创建方式"
                open={showCreateModal}
                onCancel={() => setShowCreateModal(false)}
                footer={null}
                width={500}
                centered
            >
                <div style={{ padding: '20px 0' }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px', textAlign: 'center' }}>
                        选择您希望如何开始创建项目
                    </Text>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <Card
                            hoverable
                            onClick={handleCreateWithBrainstorm}
                            style={{ cursor: 'pointer' }}
                            bodyStyle={{ padding: '20px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: '#faad14',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    color: '#fff'
                                }}>
                                    <ThunderboltOutlined />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
                                        头脑风暴创意
                                    </Title>
                                    <Text type="secondary">
                                        通过AI辅助的头脑风暴生成创意想法，然后逐步完善为完整项目
                                    </Text>
                                </div>
                            </div>
                        </Card>

                        <Card
                            hoverable
                            onClick={handleCreateWithDirectOutline}
                            style={{ cursor: 'pointer' }}
                            bodyStyle={{ padding: '20px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: '#1890ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    color: '#fff'
                                }}>
                                    <FormOutlined />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
                                        素材生成大纲
                                    </Title>
                                    <Text type="secondary">
                                        输入任何形式的素材内容，AI将为您自动生成详细的故事大纲
                                    </Text>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default HomePage; 