import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Typography, Alert, Space, message, InputNumber, Row, Col } from 'antd';
import { SaveOutlined, FileTextOutlined } from '@ant-design/icons';
import TextareaAutosize from 'react-textarea-autosize';
import { apiService } from '../services/apiService';
import { Artifact, getArtifactTextContent } from '../../common/types';

const { Title, Text } = Typography;

export const OutlineInputForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const artifact_id = searchParams.get('artifact_id');

    const [text, setText] = useState('');
    const [totalEpisodes, setTotalEpisodes] = useState<number>(10);
    const [episodeDuration, setEpisodeDuration] = useState<number>(3);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [sourceArtifact, setSourceArtifact] = useState<Artifact | null>(null);

    // Load artifact if artifact_id is provided
    useEffect(() => {
        if (artifact_id) {
            loadArtifact(artifact_id);
        }
    }, [artifact_id]);

    const loadArtifact = async (artifactId: string) => {
        try {
            setIsLoading(true);
            setError('');

            const response = await fetch(`/api/artifacts/${artifactId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch artifact: ${response.status}`);
            }
            const artifact = await response.json();
            setSourceArtifact(artifact);

            // Use the shared helper function to get text content
            const textToSet = getArtifactTextContent(artifact);
            setText(textToSet);

        } catch (error: any) {
            console.error('Error loading artifact:', error);
            setError(`加载失败: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        setHasUnsavedChanges(true);
    };

    const saveChanges = async () => {
        if (!text.trim()) {
            message.error('内容不能为空');
            return;
        }

        try {
            if (sourceArtifact) {
                // Create a new user_input artifact when editing an existing artifact
                const response = await fetch('/api/artifacts/user-input', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text.trim(),
                        sourceArtifactId: sourceArtifact.id
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to save: ${response.status}`);
                }
            }

            setHasUnsavedChanges(false);
            message.success('保存成功');

        } catch (error: any) {
            console.error('Error saving changes:', error);
            message.error(`保存失败: ${error.message}`);
        }
    };

    const generateOutline = async () => {
        if (!text.trim()) {
            message.error('请输入主题/灵感内容');
            return;
        }

        try {
            setIsGenerating(true);
            setError('');

            let artifactToUse: Artifact;

            if (hasUnsavedChanges || !sourceArtifact) {
                // Create or update user_input artifact
                const response = await fetch('/api/artifacts/user-input', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text.trim(),
                        sourceArtifactId: sourceArtifact?.id
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to create artifact: ${response.status}`);
                }

                artifactToUse = await response.json();
                setHasUnsavedChanges(false);
            } else {
                // Use existing artifact
                artifactToUse = sourceArtifact;
            }

            // Generate outline using the common interface
            const result = await apiService.generateOutline({
                sourceArtifactId: artifactToUse.id,
                totalEpisodes: totalEpisodes,
                episodeDuration: episodeDuration
            });

            // Navigate to the streaming outline page
            navigate(`/outlines/${result.sessionId}?transform=${result.transformId}`);

        } catch (error: any) {
            console.error('Error generating outline:', error);
            setError(`生成失败: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px'
            }}>
                <Space direction="vertical" align="center">
                    <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                    <Text style={{ color: '#fff' }}>加载中...</Text>
                </Space>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <Card
                style={{
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #404040'
                }}
                headStyle={{
                    backgroundColor: '#1f1f1f',
                    borderBottom: '1px solid #404040'
                }}
                bodyStyle={{ backgroundColor: '#2a2a2a' }}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Title level={2} style={{ color: '#fff', marginBottom: '8px' }}>
                            创建大纲
                        </Title>
                        <Text type="secondary" style={{ color: '#b0b0b0' }}>
                            输入故事主题和灵感，AI将为您生成详细的剧本大纲
                        </Text>
                    </div>

                    {error && (
                        <Alert
                            message="错误"
                            description={error}
                            type="error"
                            showIcon
                            style={{
                                backgroundColor: '#2d1b1b',
                                border: '1px solid #d32f2f',
                                color: '#fff'
                            }}
                        />
                    )}

                    <div>
                        <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                            主题/灵感 *
                        </Text>
                        <TextareaAutosize
                            value={text}
                            onChange={handleTextChange}
                            placeholder="请输入您的故事主题、灵感或想法..."
                            minRows={8}
                            maxRows={25}
                            style={{
                                width: '100%',
                                backgroundColor: '#1f1f1f',
                                border: '1px solid #404040',
                                borderRadius: '6px',
                                color: '#fff',
                                padding: '12px',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                resize: 'none',
                                outline: 'none'
                            }}
                        />
                        <Text type="secondary" style={{ fontSize: '12px', color: '#888', marginTop: '4px', display: 'block' }}>
                            详细描述您的故事设定、角色、情节等，内容越丰富生成的大纲越精确
                        </Text>
                    </div>

                    {/* Episode Configuration */}
                    <div>
                        <Text strong style={{ color: '#fff', marginBottom: '12px', display: 'block' }}>
                            剧集配置
                        </Text>
                        <Row gutter={16}>
                            <Col span={12}>
                                <div>
                                    <Text style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        总集数
                                    </Text>
                                    <InputNumber
                                        value={totalEpisodes}
                                        onChange={(value) => setTotalEpisodes(value || 10)}
                                        min={1}
                                        max={200}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#1f1f1f',
                                            borderColor: '#404040',
                                            color: '#fff'
                                        }}
                                        addonAfter="集"
                                    />
                                </div>
                            </Col>
                            <Col span={12}>
                                <div>
                                    <Text style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        每集时长
                                    </Text>
                                    <InputNumber
                                        value={episodeDuration}
                                        onChange={(value) => setEpisodeDuration(value || 3)}
                                        min={1}
                                        max={60}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#1f1f1f',
                                            borderColor: '#404040',
                                            color: '#fff'
                                        }}
                                        addonAfter="分钟"
                                    />
                                </div>
                            </Col>
                        </Row>
                        <Text type="secondary" style={{ fontSize: '12px', color: '#888', marginTop: '8px', display: 'block' }}>
                            建议短剧：6-12集，每集2-5分钟；中长剧：15-30集，每集8-15分钟
                        </Text>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid #404040',
                        paddingTop: '20px'
                    }}>
                        <Space>
                            {hasUnsavedChanges && (
                                <>
                                    <Text style={{ color: '#ff9800', fontSize: '12px' }}>
                                        有未保存的更改
                                    </Text>
                                    <Button
                                        icon={<SaveOutlined />}
                                        onClick={saveChanges}
                                        size="small"
                                    >
                                        保存
                                    </Button>
                                </>
                            )}
                        </Space>

                        <Button
                            type="primary"
                            size="large"
                            loading={isGenerating}
                            disabled={!text.trim() || isGenerating}
                            onClick={generateOutline}
                            icon={<FileTextOutlined />}
                        >
                            {isGenerating ? '生成中...' : '生成大纲'}
                        </Button>
                    </div>
                </Space>
            </Card>
        </div>
    );
}; 