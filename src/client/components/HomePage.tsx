import React, { useState, useEffect } from 'react';
import { Card, List, Button, Tag, Empty, Spin, Alert, Typography, Space, Progress, Tooltip, Modal, Popconfirm, message } from 'antd';
import {
    BulbOutlined,
    FileTextOutlined,
    PlusOutlined,
    PlayCircleOutlined,
    FileDoneOutlined,
    EditOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    ExclamationCircleOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
    const queryClient = useQueryClient();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

    // Delete project mutation
    const deleteProjectMutation = useMutation({
        mutationFn: async (projectId: string) => {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete project');
            }
            return response.json();
        },
        onSuccess: () => {
            message.success('项目删除成功');
            queryClient.invalidateQueries({ queryKey: ['user-projects'] });
        },
        onError: (error: any) => {
            message.error(`删除失败: ${error.message}`);
        },
    });

    // Create project mutation - simplified to just create empty project
    const createProjectMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `新项目 - ${new Date().toLocaleString('zh-CN')}`,
                    description: '通过头脑风暴创建的项目'
                })
            });
            if (!response.ok) {
                throw new Error('Failed to create project');
            }
            return response.json();
        },
        onSuccess: (project) => {
            message.success('项目已创建！');
            queryClient.invalidateQueries({ queryKey: ['user-projects'] });
            // Navigate to the new project where ProjectCreationForm will appear
            navigate(`/projects/${project.id}`);
        },
        onError: (error: any) => {
            message.error(`创建失败: ${error.message}`);
        },
    });

    const handleCreateNew = () => {
        createProjectMutation.mutate();
    };

    const handleDeleteProject = (projectId: string) => {
        deleteProjectMutation.mutate(projectId);
    };

    const handleViewProject = (project: ProjectSummary) => {
        // Navigate based on current phase
        switch (project.currentPhase) {
            case 'brainstorming':
                navigate(`/projects/${project.id}/brainstorm`);
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
                navigate(`/projects/${project.id}`);
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
                    loading={createProjectMutation.isPending}
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
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreateNew}
                        loading={createProjectMutation.isPending}
                    >
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
                            >
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <Title level={4} style={{ margin: 0, color: '#fff', flex: 1 }}>
                                            {project.name}
                                        </Title>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Tooltip title={getStatusText(project.status)}>
                                                {getStatusIcon(project.status)}
                                            </Tooltip>
                                            <Popconfirm
                                                title="删除项目"
                                                description="确定要删除这个项目吗？此操作不可撤销。"
                                                onConfirm={(e) => {
                                                    e?.stopPropagation();
                                                    handleDeleteProject(project.id);
                                                }}
                                                onCancel={(e) => e?.stopPropagation()}
                                                okText="删除"
                                                cancelText="取消"
                                                okType="danger"
                                            >
                                                <Button
                                                    type="text"
                                                    icon={<DeleteOutlined />}
                                                    size="small"
                                                    danger
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: '4px'
                                                    }}
                                                />
                                            </Popconfirm>
                                        </div>
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
        </div>
    );
};

export default HomePage; 