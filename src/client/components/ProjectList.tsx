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
    Popconfirm,
    message,
    Tooltip
} from 'antd';
import {
    PlusOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    ProjectOutlined,
    FileTextOutlined,
    PlayCircleOutlined,
    FileDoneOutlined,
    BulbOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useQueryClient, useMutation } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

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

const ProjectsList: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        fetchProjects();

        // Handle window resize for mobile detection
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error(`Failed to fetch projects: ${response.status}`);
            }

            const data = await response.json();
            setProjects(data);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError(err instanceof Error ? err.message : 'Failed to load projects');
        } finally {
            setLoading(false);
        }
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
                navigate(`/projects/${project.id}/brainstorm`);
        }
    };

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
        onSuccess: (project: any) => {
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

    const handleDeleteProject = async (projectId: string) => {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete project: ${response.status}`);
            }

            // Remove from local state
            setProjects(prev => prev.filter(p => p.id !== projectId));
            message.success('项目删除成功');
        } catch (err) {
            console.error('Error deleting project:', err);
            message.error('删除失败，请重试');
        }
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
                return <BulbOutlined />;
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'green';
            case 'completed':
                return 'blue';
            case 'failed':
                return 'red';
            default:
                return 'default';
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
                return status;
        }
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
            <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateNew}
                    loading={createProjectMutation.isPending}
                    size={isMobile ? 'middle' : 'large'}
                >
                    创建新项目
                </Button>
            </div>

            {projects.length === 0 ? (
                <Empty
                    description="还没有创建过项目"
                    style={{ margin: '60px 0' }}
                >
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
                        <List.Item style={{ marginBottom: '16px' }}>
                            <Card
                                hoverable
                                style={{
                                    minHeight: '220px',
                                    height: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flex: 1,
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleViewProject(project)}
                            >
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: 0
                                }}>
                                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Text strong style={{
                                            fontSize: '16px',
                                            color: '#fff',
                                            lineHeight: '1.4',
                                            flex: 1
                                        }}>
                                            {project.name}
                                        </Text>
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

                                    {project.description && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <Text type="secondary" style={{
                                                fontSize: '13px',
                                                lineHeight: '1.4'
                                            }}>
                                                {project.description}
                                            </Text>
                                        </div>
                                    )}

                                    <div style={{ marginBottom: '8px' }}>
                                        <Space size={[4, 4]} wrap>
                                            <Tag
                                                icon={getPhaseIcon(project.currentPhase)}
                                                color="blue"
                                                style={{ fontSize: '11px' }}
                                            >
                                                {getPhaseText(project.currentPhase)}
                                            </Tag>
                                            <Tag
                                                color={getStatusColor(project.status)}
                                                style={{ fontSize: '11px' }}
                                            >
                                                {getStatusText(project.status)}
                                            </Tag>
                                            {project.platform && (
                                                <Tag color="purple" style={{ fontSize: '11px' }}>
                                                    {project.platform}
                                                </Tag>
                                            )}
                                            {project.genre && (
                                                <Tag color="green" style={{ fontSize: '11px' }}>
                                                    {project.genre}
                                                </Tag>
                                            )}
                                        </Space>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginTop: 'auto',
                                        paddingTop: '4px'
                                    }}>
                                        <ClockCircleOutlined style={{
                                            marginRight: '4px',
                                            fontSize: '12px',
                                            color: '#888'
                                        }} />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {formatDate(project.updatedAt)}
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

export default ProjectsList; 