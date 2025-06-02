import React, { useState } from 'react';
import { Card, Button, Space, InputNumber, Checkbox, Typography, message } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TextareaAutosize from 'react-textarea-autosize';
import { apiService } from '../services/apiService';

const { Text } = Typography;

export const EpisodeGenerationForm: React.FC = () => {
    const [searchParams] = useSearchParams();
    const outlineId = searchParams.get('outlineId');
    const navigate = useNavigate();

    const [episodeCount, setEpisodeCount] = useState(10);
    const [episodeDuration, setEpisodeDuration] = useState(3);
    const [useModifiedOutline, setUseModifiedOutline] = useState(true);
    const [customRequirements, setCustomRequirements] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!outlineId) {
            message.error('缺少大纲ID');
            return;
        }

        try {
            setIsGenerating(true);

            const result = await apiService.generateEpisodes({
                outlineSessionId: outlineId,
                episode_count: episodeCount,
                episode_duration: episodeDuration,
                generation_strategy: 'sequential',
                custom_requirements: customRequirements,
                use_modified_outline: useModifiedOutline
            });

            navigate(`/episodes/${result.sessionId}?transform=${result.transformId}`);
        } catch (error) {
            console.error('Error generating episodes:', error);
            message.error('生成失败');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: '20px',
            minHeight: '100vh',
            backgroundColor: '#0a0a0a'
        }}>
            <Card
                title="生成剧集"
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #303030'
                }}
                headStyle={{
                    backgroundColor: '#1a1a1a',
                    borderBottom: '1px solid #303030',
                    color: '#fff'
                }}
                bodyStyle={{
                    backgroundColor: '#1a1a1a',
                    color: '#fff'
                }}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
                        />
                    </div>

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
                        />
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
                        loading={isGenerating}
                        disabled={!outlineId}
                        style={{
                            width: '100%',
                            height: '40px',
                            background: '#52c41a',
                            borderColor: '#52c41a'
                        }}
                    >
                        开始生成剧集
                    </Button>
                </Space>
            </Card>
        </div>
    );
};

export default EpisodeGenerationForm; 