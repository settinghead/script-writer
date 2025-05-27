import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Typography, Spin, Alert, Card, Divider } from 'antd';
import { ArrowLeftOutlined, SendOutlined, FileTextOutlined } from '@ant-design/icons';
import StoryInspirationEditor from './StoryInspirationEditor';

const { Title, Text, Paragraph } = Typography;

interface OutlineData {
    title: string;
    genre: string;
    sellingPoints: string;
    setting: string;
    synopsis: string;
}

interface OutlineSessionData {
    sessionId: string;
    ideationSessionId: string;
    status: 'active' | 'completed';
    userInput?: string;
    outline?: OutlineData;
    createdAt: string;
}

const OutlineTab: React.FC = () => {
    const { id: outlineId } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // URL parameters
    const artifactId = searchParams.get('artifact_id');

    // State management
    const [currentUserInput, setCurrentUserInput] = useState('');
    const [currentArtifactId, setCurrentArtifactId] = useState<string | null>(artifactId);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSession, setIsLoadingSession] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [outlineSession, setOutlineSession] = useState<OutlineSessionData | null>(null);

    // Determine if we're in creation mode or viewing mode
    const isCreationMode = !outlineId && artifactId;
    const isViewingMode = !!outlineId;

    // Load existing outline session if in viewing mode
    useEffect(() => {
        if (isViewingMode && outlineId) {
            loadOutlineSession(outlineId);
        }
    }, [outlineId, isViewingMode]);

    const loadOutlineSession = async (sessionId: string) => {
        setIsLoadingSession(true);
        setError(null);

        try {
            const response = await fetch(`/api/outlines/${sessionId}`);

            if (!response.ok) {
                throw new Error(`Failed to load outline session: ${response.status}`);
            }

            const data = await response.json();
            setOutlineSession(data);
            setCurrentUserInput(data.userInput || '');

        } catch (err) {
            console.error('Error loading outline session:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoadingSession(false);
        }
    };

    const handleStoryInspirationValueChange = useCallback((value: string) => {
        setCurrentUserInput(value);
    }, []);

    const handleArtifactChange = useCallback((newArtifactId: string | null) => {
        console.log('OutlineTab: Artifact ID changed from', currentArtifactId, 'to', newArtifactId);
        setCurrentArtifactId(newArtifactId);

        // Update URL with new artifact ID
        if (newArtifactId) {
            const newSearchParams = new URLSearchParams();
            newSearchParams.set('artifact_id', newArtifactId);
            navigate(`/new-outline?${newSearchParams.toString()}`, { replace: true });
        } else {
            // Clear artifact_id from URL if null
            navigate('/new-outline', { replace: true });
        }
    }, [navigate, currentArtifactId]);

    const handleGenerateOutline = async () => {
        if (!currentArtifactId) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/outlines/from-artifact/${currentArtifactId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to generate outline: ${response.status}`);
            }

            const result = await response.json();

            if (result.outlineSessionId) {
                // Navigate to the completed outline page
                navigate(`/outlines/${result.outlineSessionId}`);
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (err) {
            console.error('Error generating outline:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToIdeation = () => {
        if (isCreationMode && currentArtifactId) {
            // Navigate back to ideation with artifact ID
            navigate(`/ideation?artifact_id=${currentArtifactId}`);
        } else if (isViewingMode && outlineSession) {
            navigate(`/ideation/${outlineSession.ideationSessionId}`);
        } else {
            navigate('/ideations');
        }
    };

    const renderOutlineComponents = () => {
        if (!outlineSession?.outline) {
            return null;
        }

        const { title, genre, sellingPoints, setting, synopsis } = outlineSession.outline;

        const components = [
            { label: '剧名', value: title, icon: '🎬' },
            { label: '题材类型', value: genre, icon: '🎭' },
            { label: '项目卖点/爽点', value: sellingPoints, icon: '⭐' },
            { label: '故事设定', value: setting, icon: '🌍' },
            { label: '故事梗概', value: synopsis, icon: '📖' }
        ];

        return (
            <div style={{ marginTop: '24px' }}>
                <Title level={4} style={{ color: '#d9d9d9', marginBottom: '24px' }}>
                    故事大纲
                </Title>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {components.map((component, index) => (
                        <Card
                            key={index}
                            size="small"
                            style={{
                                background: '#1a1a1a',
                                border: '1px solid #303030',
                                borderRadius: '8px'
                            }}
                            bodyStyle={{ padding: '16px' }}
                        >
                            <div style={{ marginBottom: '8px' }}>
                                <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                                    {component.icon} {component.label}
                                </Text>
                            </div>
                            <Paragraph style={{
                                margin: 0,
                                color: '#bfbfbf',
                                lineHeight: '1.6',
                                fontSize: '14px'
                            }}>
                                {component.value}
                            </Paragraph>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };

    if (isLoadingSession) {
        return (
            <div style={{ padding: '20px', maxWidth: '800px', width: "100%", margin: '0 auto', overflow: "auto" }}>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '16px', color: '#d9d9d9' }}>加载大纲中...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '800px', width: "100%", margin: '0 auto', overflow: "auto" }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBackToIdeation}
                        type="text"
                        style={{ color: '#1890ff' }}
                    >
                        返回
                    </Button>
                    <Title level={4} style={{ margin: 0 }}>
                        {isCreationMode ? '设计故事大纲' : '故事大纲详情'}
                    </Title>
                </div>
            </div>

            <Paragraph style={{ color: '#bfbfbf', marginBottom: '24px' }}>
                {isCreationMode
                    ? '基于你的故事灵感，AI将生成完整的故事大纲，包含剧名、题材类型、项目卖点、故事设定和故事梗概。'
                    : '这是根据故事灵感生成的完整大纲，包含了故事的核心要素。'
                }
            </Paragraph>

            {/* Story Inspiration Section */}
            {isCreationMode ? (
                <StoryInspirationEditor
                    currentArtifactId={currentArtifactId || undefined}
                    onValueChange={handleStoryInspirationValueChange}
                    onArtifactChange={handleArtifactChange}
                    readOnly={isViewingMode}
                    placeholder="编辑你的故事灵感，然后生成大纲"
                />
            ) : (
                <div style={{ marginBottom: '24px' }}>
                    <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '16px' }}>
                        故事灵感
                    </Text>
                    <div style={{
                        padding: '16px',
                        background: '#1a1a1a',
                        border: '1px solid #434343',
                        borderRadius: '8px',
                        color: '#bfbfbf'
                    }}>
                        {outlineSession?.userInput || '无故事灵感数据'}
                    </div>
                </div>
            )}

            {/* Generate Button (Creation Mode Only) */}
            {isCreationMode && currentUserInput.trim() && currentArtifactId && (
                <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={handleGenerateOutline}
                    loading={isLoading}
                    size="large"
                    style={{
                        marginBottom: '24px',
                        height: '44px',
                        fontSize: '16px',
                        fontWeight: '500',
                        background: '#52c41a',
                        borderColor: '#52c41a'
                    }}
                >
                    {isLoading ? '生成大纲中...' : '生成故事大纲'}
                </Button>
            )}

            {/* Error Display */}
            {error && (
                <Alert
                    message="生成失败"
                    description={error.message}
                    type="error"
                    showIcon
                    style={{ marginBottom: '16px' }}
                />
            )}

            {/* Loading State */}
            {isLoading && (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    border: '1px solid #303030',
                    borderRadius: '8px',
                    backgroundColor: '#141414'
                }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '16px', color: '#d9d9d9' }}>
                        AI正在分析你的故事灵感，生成详细大纲...
                    </div>
                </div>
            )}

            {/* Outline Components (Viewing Mode) */}
            {isViewingMode && outlineSession && renderOutlineComponents()}

            {/* Status Info */}
            {isViewingMode && outlineSession && (
                <div style={{ marginTop: '32px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #303030' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        大纲状态: {outlineSession.status === 'completed' ? '已完成' : '进行中'} |
                        创建时间: {new Date(outlineSession.createdAt).toLocaleString('zh-CN')}
                    </Text>
                </div>
            )}
        </div>
    );
};

export default OutlineTab; 