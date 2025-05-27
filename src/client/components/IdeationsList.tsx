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
    genre_prompt_string: string;
    genre_paths: string[][];
    genre_proportions: number[];
    initial_ideas: string[];
    created_at: string;
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
        if (!text) return '';
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    };

    const generateTitle = (ideation: IdeationRun) => {
        // Priority: use first initial idea, then user input, then generate from platform + genre
        if (ideation.initial_ideas && ideation.initial_ideas.length > 0) {
            return truncateText(ideation.initial_ideas[0], 35);
        }

        if (ideation.user_input && ideation.user_input.trim()) {
            return truncateText(ideation.user_input, 35);
        }

        // Generate title from platform and genre
        const parts = [];
        if (ideation.selected_platform) {
            parts.push(ideation.selected_platform);
        }

        if (ideation.genre_paths && ideation.genre_paths.length > 0) {
            const primaryGenre = ideation.genre_paths[0];
            if (primaryGenre && primaryGenre.length > 0) {
                // Use the most specific genre (last element)
                const specificGenre = primaryGenre[primaryGenre.length - 1];
                parts.push(specificGenre);
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
            return `包含 ${ideation.initial_ideas.length} 个故事梗概`;
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
                                            {generateTitle(ideation)}
                                        </Text>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <Text type="secondary" style={{ fontSize: '13px' }}>
                                            {generateDescription(ideation)}
                                        </Text>
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                        <Space size={[4, 4]} wrap>
                                            {getGenreTags(ideation).map((tag, index) => (
                                                <Tag
                                                    key={index}
                                                    color={tag.color}
                                                    style={{ fontSize: '11px', margin: '2px 0' }}
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
                                        paddingTop: '4px'
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