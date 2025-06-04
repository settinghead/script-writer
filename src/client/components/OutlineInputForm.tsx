import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Typography, Alert, Space, message, InputNumber, Row, Col, Select } from 'antd';
import { SaveOutlined, FileTextOutlined } from '@ant-design/icons';
import TextareaAutosize from 'react-textarea-autosize';
import { apiService } from '../services/apiService';
import { Artifact, getArtifactTextContent, BrainstormParamsV1 } from '../../common/types';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';

const { Title, Text } = Typography;

export const OutlineInputForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const artifact_id = searchParams.get('artifact_id');

    const [text, setText] = useState('');
    const [totalEpisodes, setTotalEpisodes] = useState<number>(60);
    const [episodeDuration, setEpisodeDuration] = useState<number>(2);

    // 🔥 NEW: Cascaded parameters
    const [selectedPlatform, setSelectedPlatform] = useState<string>('通用');
    const [selectedGenrePaths, setSelectedGenrePaths] = useState<string[][]>([]);
    const [genreProportions, setGenreProportions] = useState<number[]>([]);
    const [requirements, setRequirements] = useState<string>('');
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

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

    const loadArtifact = async (id: string) => {
        try {
            setIsLoading(true);
            setError('');

            const response = await fetch(`/api/artifacts/${id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to load artifact: ${response.status}`);
            }

            const artifact: Artifact = await response.json();
            setSourceArtifact(artifact);

            const textContent = getArtifactTextContent(artifact);
            setText(textContent);

            // 🔥 NEW: Load cascaded parameters from brainstorming if available
            await loadCascadedParameters(artifact);

        } catch (error: any) {
            console.error('Error loading artifact:', error);
            setError(`加载失败: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 🔥 NEW: Load cascaded parameters from related brainstorming artifacts  
    const loadCascadedParameters = async (artifact: Artifact) => {
        console.log('🔍 Loading cascaded parameters for artifact:', artifact.id, artifact.type);
        try {
            // Find brainstorm_params in the lineage of this specific artifact
            const url = `/api/artifacts?type=brainstorm_params&sourceArtifactId=${artifact.id}`;
            console.log('🔍 Making API call:', url);

            const response = await fetch(url, {
                credentials: 'include'
            });

            console.log('🔍 API response status:', response.status);

            if (response.ok) {
                const brainstormArtifacts = await response.json();
                console.log('🔍 Found brainstorm artifacts:', brainstormArtifacts.length, brainstormArtifacts);

                // Get the most recent related brainstorm params
                if (brainstormArtifacts.length > 0) {
                    const latestBrainstorm = brainstormArtifacts[0]; // Already sorted by created_at desc
                    const brainstormData = latestBrainstorm.data as BrainstormParamsV1;

                    console.log('🔍 Setting cascaded parameters:', {
                        platform: brainstormData.platform || '通用',
                        genre_paths: brainstormData.genre_paths || [],
                        genre_proportions: brainstormData.genre_proportions || [],
                        requirements: brainstormData.requirements || ''
                    });

                    setSelectedPlatform(brainstormData.platform || '通用');
                    setSelectedGenrePaths(brainstormData.genre_paths || []);
                    setGenreProportions(brainstormData.genre_proportions || []);
                    setRequirements(brainstormData.requirements || '');
                } else {
                    console.log('🔍 No brainstorm artifacts found, using defaults');
                }
            } else {
                const errorText = await response.text();
                console.error('🔍 API call failed:', response.status, errorText);
            }
        } catch (error) {
            console.error('🔍 Error loading cascaded parameters:', error);
            // This is expected when creating outline from scratch
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        setHasUnsavedChanges(true);
    };

    const handleGenreSelectionConfirm = (selection: { paths: string[][]; proportions: number[] }) => {
        setSelectedGenrePaths(selection.paths);
        setGenreProportions(selection.proportions);
        setGenrePopupVisible(false);
        setHasUnsavedChanges(true);
    };

    const buildGenreDisplayElements = (): (React.ReactElement | string)[] => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            const proportion = genreProportions[index];
            const proportionText = proportion ? ` (${proportion}%)` : '';

            return (
                <span key={index} style={{ marginRight: '8px', marginBottom: '4px', display: 'inline-block' }}>
                    {genreText}{proportionText}
                    {index < selectedGenrePaths.length - 1 && ', '}
                </span>
            );
        });
    };

    const saveChanges = async () => {
        if (!text.trim()) {
            message.error('请输入主题/灵感内容');
            return;
        }

        try {
            setIsLoading(true);
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
                throw new Error(`Failed to save artifact: ${response.status}`);
            }

            const newArtifact = await response.json();
            setSourceArtifact(newArtifact);
            setHasUnsavedChanges(false);
            message.success('保存成功');

        } catch (error: any) {
            console.error('Error saving:', error);
            message.error(`保存失败: ${error.message}`);
        } finally {
            setIsLoading(false);
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

            // 🔥 NEW: Generate outline with cascaded parameters
            const result = await apiService.generateOutline({
                sourceArtifactId: artifactToUse.id,
                totalEpisodes: totalEpisodes,
                episodeDuration: episodeDuration,
                // Include cascaded parameters
                cascadedParams: {
                    platform: selectedPlatform,
                    genre_paths: selectedGenrePaths,
                    genre_proportions: genreProportions,
                    requirements: requirements
                }
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <Text style={{ color: '#fff' }}>加载中...</Text>
            </div>
        );
    }

    return (
        <div style={{
            width: '900px',
            maxWidth: "100%",
            margin: '0 auto',
            overflowY: 'auto',
            padding: '20px'
        }}>
            <Card style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #404040',
                borderRadius: '12px'
            }}>
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

                    {/* 🔥 NEW: Cascaded Parameters Section */}
                    <div style={{
                        backgroundColor: '#262626',
                        border: '1px solid #404040',
                        borderRadius: '8px',
                        padding: '16px'
                    }}>
                        <Text strong style={{ color: '#fff', marginBottom: '16px', display: 'block' }}>
                            制作规格 (继承自灵感阶段，可修改)
                        </Text>
                        {/* Debug info */}
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                            Debug: Platform={selectedPlatform}, Genres={selectedGenrePaths.length}, Requirements={requirements.length}
                        </div>

                        <Row gutter={[16, 16]}>
                            {/* Platform Selection */}
                            <Col xs={24} sm={12}>
                                <div>
                                    <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        目标平台
                                    </Text>
                                    <PlatformSelection
                                        selectedPlatform={selectedPlatform}
                                        onPlatformChange={setSelectedPlatform}
                                    />
                                </div>
                            </Col>

                            {/* Genre Selection */}
                            <Col xs={24} sm={12}>
                                <div>
                                    <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        故事类型
                                    </Text>
                                    <div
                                        onClick={() => setGenrePopupVisible(true)}
                                        style={{
                                            border: '1px solid #404040',
                                            borderRadius: '6px',
                                            padding: '8px 12px',
                                            minHeight: '32px',
                                            cursor: 'pointer',
                                            background: '#1f1f1f',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#404040'}
                                    >
                                        {selectedGenrePaths.length > 0 ? (
                                            <span style={{ color: '#d9d9d9', cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    {buildGenreDisplayElements()}
                                                </div>
                                            </span>
                                        ) : (
                                            <span style={{ color: '#666', cursor: 'pointer' }}>
                                                点击选择故事类型 (可多选, 最多3个)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Col>

                            {/* Requirements */}
                            <Col span={24}>
                                <div>
                                    <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        特殊要求
                                    </Text>
                                    <TextareaAutosize
                                        value={requirements}
                                        onChange={(e) => {
                                            setRequirements(e.target.value);
                                            setHasUnsavedChanges(true);
                                        }}
                                        placeholder="请输入对故事的特殊要求..."
                                        minRows={3}
                                        maxRows={8}
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
                                </div>
                            </Col>
                        </Row>
                    </div>

                    {/* Episode Configuration */}
                    <div>
                        <Text strong style={{ color: '#fff', marginBottom: '16px', display: 'block' }}>
                            剧集配置
                        </Text>
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <div>
                                    <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        总集数
                                    </Text>
                                    <InputNumber
                                        value={totalEpisodes}
                                        onChange={(value) => setTotalEpisodes(value || 60)}
                                        min={6}
                                        max={200}
                                        step={1}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#1f1f1f',
                                            borderColor: '#404040',
                                            color: '#fff'
                                        }}
                                        suffix="集"
                                    />
                                </div>
                            </Col>
                            <Col xs={24} sm={12}>
                                <div>
                                    <Text strong style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                        每集时长
                                    </Text>
                                    <InputNumber
                                        value={episodeDuration}
                                        onChange={(value) => setEpisodeDuration(value || 2)}
                                        min={1}
                                        max={30}
                                        step={1}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#1f1f1f',
                                            borderColor: '#404040',
                                            color: '#fff'
                                        }}
                                        suffix="分钟"
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

            <GenreSelectionPopup
                visible={genrePopupVisible}
                onClose={() => setGenrePopupVisible(false)}
                onSelect={handleGenreSelectionConfirm}
                currentSelectionPaths={selectedGenrePaths}
            />
        </div>
    );
}; 