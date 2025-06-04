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
    Descriptions,
    Modal
} from 'antd';
import {
    EyeOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Title, Text, Paragraph } = Typography;

interface IdeationRun {
    id: string;
    user_input: string;
    selected_platform: string;
    genre_prompt_string: string;
    genre_paths: string[][];
    genre_proportions: number[];
    initial_ideas: string[];
    initial_idea_titles?: string[];
    created_at: string;
}

const IdeationsList: React.FC = () => {
    const navigate = useNavigate();
    const [ideations, setIdeations] = useState<IdeationRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        fetchIdeations();

        // Handle window resize for mobile detection
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    const handleDeleteIdeation = async (id: string, title: string) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除灵感 "${title}" 吗？此操作无法撤销。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const response = await fetch(`/api/ideations/${id}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to delete ideation: ${response.status}`);
                    }

                    // Remove from local state to update UI immediately
                    setIdeations(prevIdeations => prevIdeations.filter(ideation => ideation.id !== id));

                    // Show success message
                    Modal.success({
                        title: '删除成功',
                        content: '灵感已成功删除',
                    });
                } catch (err) {
                    console.error('Error deleting ideation:', err);
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

    const generateTitle = (ideation: IdeationRun) => {
        // Priority: use comma-separated idea titles, then user input, then generate from platform + genre
        const maxLength = isMobile ? 25 : 35; // Shorter titles on mobile

        if (ideation.initial_idea_titles && ideation.initial_idea_titles.length > 0) {
            // Filter out empty titles and join with commas
            const validTitles = ideation.initial_idea_titles.filter(title => title && title.trim());
            if (validTitles.length > 0) {
                const titleString = validTitles.join('，');
                return truncateText(titleString, maxLength);
            }
        }

        // Fallback to first initial idea if no titles available
        if (ideation.initial_ideas && ideation.initial_ideas.length > 0) {
            return truncateText(ideation.initial_ideas[0], maxLength);
        }

        if (ideation.user_input && ideation.user_input.trim()) {
            return truncateText(ideation.user_input, maxLength);
        }

        // Generate title from platform and genre
        const parts = [];
        if (ideation.selected_platform) {
            parts.push(ideation.selected_platform);
        }

        if (ideation.genre_paths && ideation.genre_paths.length > 0) {
            const genreStrings = [];
            ideation.genre_paths.forEach(path => {
                if (path && path.length > 0) {
                    // Use the most specific genre (last element)
                    const specificGenre = path[path.length - 1];
                    genreStrings.push(specificGenre);
                }
            });
            
            // Add all genres to the title
            if (genreStrings.length > 0) {
                parts.push(...genreStrings);
            }
        }

        return parts.length > 0 ? parts.join(' · ') : '灵感创作';
    };

    const generateDescription = (ideation: IdeationRun) => {
        // Priority: show genre combination, then initial ideas preview, then platform info
        if (ideation.genre_prompt_string && ideation.genre_prompt_string !== '未指定') {
            return ideation.genre_prompt_string;
        }

        if (ideation.initial_ideas && ideation.initial_ideas.length > 1) {
            return `包含 ${ideation.initial_ideas.length} 个故事灵感`;
        }

        if (ideation.selected_platform) {
            return `${ideation.selected_platform} 平台内容`;
        }

        return '创意灵感记录';
    };

    const getGenreTags = (ideation: IdeationRun) => {
        const tags = [];

        if (ideation.selected_platform) {
            tags.push({ text: ideation.selected_platform, color: 'blue' });
        }

        if (ideation.genre_paths && ideation.genre_paths.length > 0) {
            ideation.genre_paths.forEach((path, index) => {
                if (path && path.length > 0) {
                    const genreText = path.length > 1 ? path[path.length - 1] : path[0];
                    const proportion = ideation.genre_proportions && ideation.genre_proportions[index];
                    const displayText = ideation.genre_paths.length > 1 && proportion
                        ? `${genreText} ${proportion}%`
                        : genreText;
                    tags.push({ text: displayText, color: 'purple' });
                }
            });
        }

        if (ideation.initial_ideas && ideation.initial_ideas.length > 0) {
            tags.push({ text: `${ideation.initial_ideas.length} 个故事`, color: 'green' });
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
                        gutter: [16, 24], // [horizontal, vertical] spacing
                        xs: 1,
                        sm: 1,
                        md: 2,
                        lg: 2,
                        xl: 3,
                        xxl: 3,
                    }}
                    dataSource={ideations}
                    renderItem={(ideation) => (
                        <List.Item style={{ marginBottom: '16px' }}>
                            <Card
                                hoverable
                                style={{
                                    minHeight: '220px',
                                    height: 'auto', // Allow dynamic height
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flex: 1,
                                    padding: isMobile ? '12px' : '16px' // Smaller padding on mobile
                                }}
                                actions={[
                                    <Button
                                        key="view"
                                        type="text"
                                        icon={<EyeOutlined />}
                                        onClick={() => handleViewIdeation(ideation.id)}
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
                                            handleDeleteIdeation(ideation.id, generateTitle(ideation));
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
                                    minHeight: 0 // Prevents flex item from overflowing
                                }}>
                                    <div style={{ marginBottom: isMobile ? '8px' : '12px' }}>
                                        <Text strong style={{
                                            fontSize: isMobile ? '14px' : '16px',
                                            color: '#fff',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word'
                                        }}>
                                            {generateTitle(ideation)}
                                        </Text>
                                    </div>

                                    <div style={{ marginBottom: isMobile ? '8px' : '12px' }}>
                                        <Text type="secondary" style={{
                                            fontSize: isMobile ? '12px' : '13px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word'
                                        }}>
                                            {generateDescription(ideation)}
                                        </Text>
                                    </div>

                                    <div style={{
                                        marginBottom: isMobile ? '6px' : '8px',
                                        flex: '0 0 auto' // Don't grow or shrink
                                    }}>
                                        <Space size={[4, 4]} wrap>
                                            {getGenreTags(ideation).map((tag, index) => (
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
                                        flex: '0 0 auto' // Don't grow or shrink
                                    }}>
                                        <ClockCircleOutlined style={{
                                            marginRight: '4px',
                                            fontSize: isMobile ? '11px' : '12px',
                                            color: '#888'
                                        }} />
                                        <Text type="secondary" style={{
                                            fontSize: isMobile ? '11px' : '12px'
                                        }}>
                                            {formatDate(ideation.created_at)}
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

export default IdeationsList; 