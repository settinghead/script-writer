import React, { useState, useEffect } from 'react';
import { Card, Button, Space, InputNumber, Checkbox, Typography, message, Row, Col, Tag } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import TextareaAutosize from 'react-textarea-autosize';
import { apiService } from '../services/apiService';
import { BrainstormParamsV1 } from '../../common/types';
import PlatformSelection from './PlatformSelection';
import GenreSelectionPopup from './GenreSelectionPopup';

const { Text, Title } = Typography;

export const EpisodeGenerationForm: React.FC = () => {
    const [searchParams] = useSearchParams();
    const outlineId = searchParams.get('outlineId');
    const navigate = useNavigate();

    const [episodeCount, setEpisodeCount] = useState(10);
    const [episodeDuration, setEpisodeDuration] = useState(3);
    const [useModifiedOutline, setUseModifiedOutline] = useState(true);
    const [customRequirements, setCustomRequirements] = useState('');

    // 🔥 NEW: Cascaded parameters (inherited from outline/brainstorming)
    const [selectedPlatform, setSelectedPlatform] = useState<string>('通用');
    const [selectedGenrePaths, setSelectedGenrePaths] = useState<string[][]>([]);
    const [requirements, setRequirements] = useState<string>('');
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

    // Use TanStack Query to load cascaded parameters
    const { data: cascadedParams, isLoading } = useQuery({
        queryKey: ['cascaded-params', outlineId],
        queryFn: async () => {
            if (!outlineId) return null;

            // Find brainstorm_params for this specific outline session
            const response = await fetch(`/api/artifacts?type=brainstorm_params&sessionId=${outlineId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const brainstormArtifacts = await response.json();

                // Get the most recent related brainstorm params
                if (brainstormArtifacts.length > 0) {
                    const latestBrainstorm = brainstormArtifacts[0]; // Already sorted by created_at desc
                    return latestBrainstorm.data as BrainstormParamsV1;
                }
            }
            return null;
        },
        enabled: !!outlineId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });

    // Update state when cascaded parameters are loaded
    useEffect(() => {
        if (cascadedParams) {
            setSelectedPlatform(cascadedParams.platform || '通用');
            setSelectedGenrePaths(cascadedParams.genre_paths || []);
            setRequirements(cascadedParams.requirements || '');
        }
    }, [cascadedParams]);

    // Mutation for episode generation
    const generateMutation = useMutation({
        mutationFn: async (params: any) => {
            return apiService.generateEpisodes(params);
        },
        onSuccess: (result) => {
            navigate(`/episodes/${result.sessionId}?transform=${result.transformId}`);
        },
        onError: (error) => {
            console.error('Error generating episodes:', error);
            message.error('生成失败');
        }
    });

    const handleGenreSelectionConfirm = (selection: { paths: string[][] }) => {
        setSelectedGenrePaths(selection.paths);
        setGenrePopupVisible(false);
    };

    const buildGenreDisplayElements = (): React.ReactElement[] => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            return (
                <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                    {genreText}
                </Tag>
            );
        });
    };

    const handleGenerate = async () => {
        if (!outlineId) {
            message.error('缺少大纲ID');
            return;
        }

        // 🔥 NEW: Include cascaded parameters in episode generation
        generateMutation.mutate({
            outlineSessionId: outlineId,
            episode_count: episodeCount,
            episode_duration: episodeDuration,
            generation_strategy: 'sequential',
            custom_requirements: customRequirements,
            use_modified_outline: useModifiedOutline,
            // Include cascaded parameters
            cascadedParams: {
                platform: selectedPlatform,
                genre_paths: selectedGenrePaths,
                requirements: requirements
            }
        });
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <Text style={{ color: '#fff' }}>加载参数中...</Text>
            </div>
        );
    }

    return (
        <div style={{
            width: '900px',
            maxWidth: "100%",
            margin: '0 auto',
            padding: '20px',
            minHeight: 'calc(100vh - 160px)',
            backgroundColor: '#0a0a0a'
        }}>
            <Card
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #404040',
                    borderRadius: '12px'
                }}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Title level={2} style={{ color: '#fff', marginBottom: '8px' }}>
                            生成剧集
                        </Title>
                        <Text type="secondary" style={{ color: '#b0b0b0' }}>
                            基于大纲生成详细的分集剧情
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
                            制作规格 (继承自大纲阶段，可修改)
                        </Text>

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
                                        原始要求
                                    </Text>
                                    <TextareaAutosize
                                        value={requirements}
                                        onChange={(e) => setRequirements(e.target.value)}
                                        placeholder="原始故事要求..."
                                        minRows={2}
                                        maxRows={6}
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

                    {/* Episode Generation Settings */}
                    <div>
                        <Text strong style={{ color: '#fff', marginBottom: '16px', display: 'block' }}>
                            剧集生成设置
                        </Text>

                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={12}>
                                <div>
                                    <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        剧集数量
                                    </Text>
                                    <InputNumber
                                        value={episodeCount}
                                        onChange={(value) => setEpisodeCount(value || 1)}
                                        min={1}
                                        max={100}
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
                                    <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        每集时长（分钟）
                                    </Text>
                                    <InputNumber
                                        value={episodeDuration}
                                        onChange={(value) => setEpisodeDuration(value || 1)}
                                        min={1}
                                        max={30}
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
                    </div>

                    <div>
                        <Checkbox
                            checked={useModifiedOutline}
                            onChange={(e) => setUseModifiedOutline(e.target.checked)}
                            style={{ color: '#fff' }}
                        >
                            使用修改后的大纲（如果未修改则使用原始大纲）
                        </Checkbox>
                    </div>

                    <div>
                        <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                            额外要求（可选）
                        </Text>
                        <TextareaAutosize
                            value={customRequirements}
                            onChange={(e) => setCustomRequirements(e.target.value)}
                            placeholder="请输入对剧集生成的特殊要求..."
                            minRows={3}
                            style={{
                                width: '100%',
                                backgroundColor: '#1f1f1f',
                                border: '1px solid #404040',
                                borderRadius: '6px',
                                color: '#fff',
                                padding: '8px 12px',
                                fontSize: '14px',
                                lineHeight: '1.5715',
                                resize: 'none',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <Button
                        type="primary"
                        onClick={handleGenerate}
                        loading={generateMutation.isPending}
                        disabled={!outlineId}
                        style={{
                            width: '100%',
                            height: '40px',
                            background: '#52c41a',
                            borderColor: '#52c41a'
                        }}
                    >
                        开始生成每集大纲
                    </Button>
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

export default EpisodeGenerationForm; 