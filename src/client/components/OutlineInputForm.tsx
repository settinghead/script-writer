import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, InputNumber, Alert, Typography, Space, Row, Col, Input, Spin } from 'antd';
import { FileTextOutlined, SaveOutlined } from '@ant-design/icons';
import { apiService } from '../services/apiService';
import { Artifact } from '../../server/types/artifacts';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const OutlineInputForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [artifactLoading, setArtifactLoading] = useState(true);
    const [sourceArtifact, setSourceArtifact] = useState<Artifact | null>(null);
    const [ideaText, setIdeaText] = useState<string>('');
    const [totalEpisodes, setTotalEpisodes] = useState<number>(12);
    const [episodeDuration, setEpisodeDuration] = useState<number>(45);
    const [error, setError] = useState<string>('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Check if there's a specific artifact_id in the URL
    const artifactId = searchParams.get('artifact_id');

    // Load artifact on component mount
    useEffect(() => {
        if (artifactId) {
            loadArtifact(artifactId);
        } else {
            // No artifact specified, start with empty form
            setArtifactLoading(false);
            setIdeaText('');
        }
    }, [artifactId]);

    const loadArtifact = async (id: string) => {
        try {
            setArtifactLoading(true);
            setError('');

            const response = await fetch(`/api/artifacts/${id}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch artifact: ${response.status}`);
            }
            const artifact = await response.json();

            setSourceArtifact(artifact);
            setIdeaText(artifact.data.idea_text || artifact.data.text || '');

        } catch (error) {
            console.error('Error loading artifact:', error);
            setError('Failed to load the specified story idea.');
        } finally {
            setArtifactLoading(false);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setIdeaText(e.target.value);
        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (!hasUnsavedChanges || !ideaText.trim()) {
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Create new user_input artifact with the edited content
            const response = await fetch('/api/artifacts/user-input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: ideaText.trim(),
                    sourceArtifactId: sourceArtifact?.id
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to save changes: ${response.status}`);
            }

            const newArtifact = await response.json();
            setSourceArtifact(newArtifact);
            setHasUnsavedChanges(false);

        } catch (error) {
            console.error('Error saving changes:', error);
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        // Save changes first if there are any
        if (hasUnsavedChanges) {
            await handleSaveChanges();
        }

        if (!ideaText.trim()) {
            setError('请输入主题或灵感');
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
            // Use the current source artifact (either original or newly created user_input)
            const artifactIdToUse = sourceArtifact?.id;
            if (!artifactIdToUse) {
                throw new Error('No source artifact available');
            }

            const response = await apiService.generateOutline({
                sourceArtifactId: artifactIdToUse,
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

    if (artifactLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px'
            }}>
                <Spin size="large" />
                <Text style={{ marginLeft: '12px', color: '#fff' }}>
                    加载内容...
                </Text>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <Card style={{ backgroundColor: '#1f1f1f', border: '1px solid #303030' }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {/* Header */}
                    <div>
                        <Title level={2} style={{ color: '#fff', margin: '0 0 8px 0' }}>
                            生成剧本大纲
                        </Title>
                        <Text style={{ color: '#aaa' }}>
                            输入您的故事主题或灵感，设置剧集参数，然后生成详细的剧本大纲。
                        </Text>
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
                            style={{ backgroundColor: '#2a1a1a', border: '1px solid #ff4d4f' }}
                        />
                    )}

                    {/* Story Content Editor */}
                    <div>
                        <Title level={4} style={{ color: '#fff', margin: '0 0 12px 0' }}>
                            故事内容
                        </Title>

                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <div>
                                <Text style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                    故事内容 *
                                </Text>
                                <TextArea
                                    value={ideaText}
                                    onChange={handleTextChange}
                                    placeholder="输入或编辑您的故事内容..."
                                    rows={8}
                                    style={{
                                        backgroundColor: '#2a2a2a',
                                        border: '1px solid #404040',
                                        color: '#fff'
                                    }}
                                />
                            </div>

                            {hasUnsavedChanges && (
                                <Button
                                    icon={<SaveOutlined />}
                                    onClick={handleSaveChanges}
                                    loading={isLoading}
                                    style={{ alignSelf: 'flex-start' }}
                                >
                                    保存修改
                                </Button>
                            )}
                        </Space>
                    </div>

                    {/* Episode Configuration */}
                    <div>
                        <Title level={4} style={{ color: '#fff', margin: '0 0 12px 0' }}>
                            剧集配置
                        </Title>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Card
                                    size="small"
                                    style={{ backgroundColor: '#2a2a2a', border: '1px solid #404040' }}
                                >
                                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>
                                        总集数 *
                                    </Text>
                                    <InputNumber
                                        min={1}
                                        max={100}
                                        value={totalEpisodes}
                                        onChange={(value) => setTotalEpisodes(value || 1)}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #404040'
                                        }}
                                        placeholder="例如: 12"
                                    />
                                    <Text style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#aaa' }}>
                                        建议: 电视剧12-24集，网剧6-12集
                                    </Text>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card
                                    size="small"
                                    style={{ backgroundColor: '#2a2a2a', border: '1px solid #404040' }}
                                >
                                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#fff' }}>
                                        每集时长 (分钟) *
                                    </Text>
                                    <InputNumber
                                        min={10}
                                        max={180}
                                        value={episodeDuration}
                                        onChange={(value) => setEpisodeDuration(value || 45)}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #404040'
                                        }}
                                        placeholder="例如: 45"
                                    />
                                    <Text style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#aaa' }}>
                                        建议: 网剧20-30分钟，电视剧40-50分钟
                                    </Text>
                                </Card>
                            </Col>
                        </Row>
                    </div>

                    {/* Generate Button */}
                    <div style={{ textAlign: 'right', paddingTop: '20px', borderTop: '1px solid #404040' }}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<FileTextOutlined />}
                            onClick={handleGenerate}
                            disabled={isLoading || !ideaText.trim()}
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