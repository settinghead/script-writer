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
    DeleteOutlined,
    EditOutlined,
    ProjectOutlined,
    FileTextOutlined,
    PlayCircleOutlined,
    FileDoneOutlined,
    ThunderboltOutlined,
    FormOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showCreateModal, setShowCreateModal] = useState(false);

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
                navigate('/new-project-from-brainstorming');
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
                navigate('/new-project-from-brainstorming');
        }
    };

    const handleCreateNew = () => {
        setShowCreateModal(true);
    };

    const handleCreateWithBrainstorm = () => {
        setShowCreateModal(false);
        navigate('/new-project-from-brainstorming');
    };

    const handleCreateWithDirectOutline = () => {
        setShowCreateModal(false);
        navigate('/projects/new/outline');
    };

    const handleDeleteProject = async (project: ProjectSummary) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除项目 "${project.name}" 吗？此操作无法撤销。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const response = await fetch(`/api/projects/${project.id}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to delete project: ${response.status}`);
                    }

                    // Remove from local state
                    setProjects(prev => prev.filter(p => p.id !== project.id));

                    Modal.success({
                        title: '删除成功',
                        content: '项目已成功删除',
                    });
                } catch (err) {
                    console.error('Error deleting project:', err);
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

    const getPhaseIcon = (phase: string) => {
        switch (phase) {
            case 'brainstorming':
                return <ProjectOutlined />;
            case 'outline':
                return <FileTextOutlined />;
            case 'episodes':
                return <PlayCircleOutlined />;
            case 'scripts':
                return <FileDoneOutlined />;
            default:
                return <ProjectOutlined />;
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
                                            handleDeleteProject(project);
                                        }}
                                        style={{ color: '#ff4d4f' }}
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
                                    <div style={{ marginBottom: '12px' }}>
                                        <Text strong style={{
                                            fontSize: '16px',
                                            color: '#fff',
                                            lineHeight: '1.4'
                                        }}>
                                            {project.name}
                                        </Text>
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

            {/* Create Project Modal - Two Options */}
            <Modal
                title="选择创建方式"
                open={showCreateModal}
                onCancel={() => setShowCreateModal(false)}
                footer={null}
                width={600}
                centered
            >
                <div style={{ padding: '20px 0' }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px', textAlign: 'center' }}>
                        选择您希望如何开始创建项目
                    </Text>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Card
                            hoverable
                            onClick={handleCreateWithBrainstorm}
                            style={{ cursor: 'pointer', flex: 1 }}
                            bodyStyle={{ padding: '20px' }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: '#faad14',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    color: '#fff',
                                    marginBottom: '16px'
                                }}>
                                    <ThunderboltOutlined />
                                </div>
                                <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
                                    使用头脑风暴
                                </Title>
                                <Text type="secondary">
                                    通过AI辅助的头脑风暴生成创意想法，然后逐步完善为完整项目
                                </Text>
                            </div>
                        </Card>

                        <Card
                            hoverable
                            onClick={handleCreateWithDirectOutline}
                            style={{ cursor: 'pointer', flex: 1 }}
                            bodyStyle={{ padding: '20px' }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: '#1890ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    color: '#fff',
                                    marginBottom: '16px'
                                }}>
                                    <FormOutlined />
                                </div>
                                <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
                                    自己输入素材
                                </Title>
                                <Text type="secondary">
                                    可以是一句话灵感、PDF、Word文档等，AI将为您自动生成详细的故事大纲
                                </Text>
                            </div>
                        </Card>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProjectsList; 