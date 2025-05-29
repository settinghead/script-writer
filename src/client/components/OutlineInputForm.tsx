import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Radio, InputNumber, Alert, Typography, Space, Row, Col, Empty, Spin } from 'antd';
import { FileTextOutlined, PlusOutlined, BulbOutlined } from '@ant-design/icons';
import { apiService } from '../services/apiService';
import { Artifact } from '../../server/types/artifacts';

const { Title, Text, Paragraph } = Typography;

export const OutlineInputForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [ideasLoading, setIdeasLoading] = useState(true);
    const [ideas, setIdeas] = useState<Artifact[]>([]);
    const [selectedIdeaId, setSelectedIdeaId] = useState<string>('');
    const [totalEpisodes, setTotalEpisodes] = useState<number>(12);
    const [episodeDuration, setEpisodeDuration] = useState<number>(45);
    const [error, setError] = useState<string>('');

    // Check if there's a specific artifact_id in the URL
    const artifactId = searchParams.get('artifact_id');

    // Load user's brainstorm ideas on component mount
    useEffect(() => {
        if (artifactId) {
            // Load specific artifact
            loadSpecificArtifact(artifactId);
        } else {
            // Load all available ideas
            loadIdeas();
        }
    }, [artifactId]);

    const loadSpecificArtifact = async (id: string) => {
        try {
            setIdeasLoading(true);
            setError('');

            // Use the existing artifact endpoint
            const response = await fetch(`/api/artifacts/${id}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch artifact: ${response.status}`);
            }
            const artifact = await response.json();

            // Set this single artifact as the only option
            setIdeas([artifact]);
            setSelectedIdeaId(artifact.id);

        } catch (error) {
            console.error('Error loading specific artifact:', error);
            setError('Failed to load the specified story idea. Please try selecting from available ideas.');
            // Fall back to loading all ideas
            loadIdeas();
        } finally {
            setIdeasLoading(false);
        }
    };

    const loadIdeas = async () => {
        try {
            setIdeasLoading(true);
            const userIdeas = await apiService.getUserIdeas();
            setIdeas(userIdeas);

            // Auto-select the first idea if available
            if (userIdeas.length > 0) {
                setSelectedIdeaId(userIdeas[0].id);
            }
        } catch (error) {
            console.error('Error loading ideas:', error);
            setError('Failed to load story ideas');
        } finally {
            setIdeasLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedIdeaId) {
            setError('请选择一个故事灵感');
            return;
        }

        if (totalEpisodes < 1 || totalEpisodes > 100) {
            setError('集数必须在1-100之间');
            return;
        }

        if (episodeDuration < 10 || episodeDuration > 180) {
            setError('每集时长必须在10-180分钟之间');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Start outline generation
            const response = await apiService.generateOutline({
                sourceArtifactId: selectedIdeaId,
                totalEpisodes,
                episodeDuration
            });

            // Navigate to the streaming outline page
            navigate(`/outlines/${response.sessionId}?transform=${response.transformId}`);

        } catch (error) {
            console.error('Error generating outline:', error);
            setError('生成大纲时出错，请重试');
            setIsLoading(false);
        }
    };

    const selectedIdea = ideas.find(idea => idea.id === selectedIdeaId);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN');
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <Card>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {/* Header */}
                    <div>
                        <Title level={2} style={{ color: '#fff', margin: '0 0 8px 0' }}>
                            生成剧本大纲
                        </Title>
                        <Text type="secondary">
                            基于您的故事灵感，生成详细的剧本大纲，包括故事结构、角色设定等。
                        </Text>
                        {artifactId && (
                            <Alert
                                message="使用指定故事灵感"
                                description="您正在基于特定的故事灵感生成大纲。"
                                type="info"
                                showIcon
                                style={{ marginTop: '12px' }}
                            />
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Alert
                            message="错误"
                            description={error}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setError('')}
                        />
                    )}

                    {/* Source Idea Selection */}
                    <div>
                        <Title level={4} style={{ color: '#fff', margin: '0 0 12px 0' }}>
                            选择故事灵感 *
                        </Title>

                        {ideasLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <Spin size="large" />
                                <Text style={{ display: 'block', marginTop: '12px', color: '#fff' }}>
                                    {artifactId ? '加载指定故事灵感...' : '加载故事灵感...'}
                                </Text>
                            </div>
                        ) : ideas.length === 0 ? (
                            <Empty
                                image={<BulbOutlined style={{ fontSize: '64px', color: '#999' }} />}
                                description="还没有故事灵感？"
                                style={{ padding: '40px 20px' }}
                            >
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => navigate('/new-ideation')}
                                >
                                    先去创建一些故事灵感
                                </Button>
                            </Empty>
                        ) : (
                            <Radio.Group
                                value={selectedIdeaId}
                                onChange={(e) => setSelectedIdeaId(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    {ideas.map((idea) => (
                                        <Radio.Button
                                            key={idea.id}
                                            value={idea.id}
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                                padding: '16px',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <div>
                                                <Title level={5} style={{ margin: '0 0 8px 0', color: '#000' }}>
                                                    {idea.data.idea_title || idea.data.title || '无标题'}
                                                </Title>
                                                <Paragraph
                                                    ellipsis={{ rows: 2, expandable: false }}
                                                    style={{ margin: '0 0 8px 0', color: '#666' }}
                                                >
                                                    {idea.data.idea_text || idea.data.text}
                                                </Paragraph>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    创建时间: {formatDate(idea.created_at)}
                                                </Text>
                                            </div>
                                        </Radio.Button>
                                    ))}
                                </Space>
                            </Radio.Group>
                        )}

                        {/* Option to browse all ideas when coming from specific artifact */}
                        {artifactId && ideas.length > 0 && (
                            <div style={{ marginTop: '12px', textAlign: 'center' }}>
                                <Button
                                    type="link"
                                    onClick={() => navigate('/new-outline')}
                                >
                                    或者浏览所有故事灵感
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Episode Configuration */}
                    <div>
                        <Title level={4} style={{ color: '#fff', margin: '0 0 12px 0' }}>
                            剧集配置
                        </Title>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#000' }}>
                                        总集数 *
                                    </Text>
                                    <InputNumber
                                        min={1}
                                        max={100}
                                        value={totalEpisodes}
                                        onChange={(value) => setTotalEpisodes(value || 1)}
                                        style={{ width: '100%' }}
                                        placeholder="例如: 12"
                                    />
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                        建议: 电视剧12-24集，网剧6-12集
                                    </Text>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
                                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#000' }}>
                                        每集时长 (分钟) *
                                    </Text>
                                    <InputNumber
                                        min={10}
                                        max={180}
                                        value={episodeDuration}
                                        onChange={(value) => setEpisodeDuration(value || 45)}
                                        style={{ width: '100%' }}
                                        placeholder="例如: 45"
                                    />
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                        建议: 网剧20-30分钟，电视剧40-50分钟
                                    </Text>
                                </Card>
                            </Col>
                        </Row>
                    </div>

                    {/* Selected Idea Preview */}
                    {selectedIdea && (
                        <Card
                            title={
                                <Text strong style={{ color: '#000' }}>选中的故事灵感</Text>
                            }
                            size="small"
                            style={{ backgroundColor: '#f9f9f9' }}
                        >
                            <Space direction="vertical" size="small">
                                <Text strong style={{ color: '#1890ff' }}>
                                    {selectedIdea.data.idea_title || selectedIdea.data.title || '无标题'}
                                </Text>
                                <Paragraph style={{ margin: 0, color: '#333' }}>
                                    {selectedIdea.data.idea_text || selectedIdea.data.text}
                                </Paragraph>
                            </Space>
                        </Card>
                    )}

                    {/* Generate Button */}
                    <div style={{ textAlign: 'right' }}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<FileTextOutlined />}
                            onClick={handleGenerate}
                            disabled={isLoading || !selectedIdeaId || ideas.length === 0}
                            loading={isLoading}
                        >
                            {isLoading ? '正在生成...' : '开始生成大纲'}
                        </Button>
                    </div>
                </Space>
            </Card>
        </div>
    );
}; 