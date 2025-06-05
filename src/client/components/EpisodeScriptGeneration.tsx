import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, Typography, message, InputNumber, Checkbox, Alert } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import TextareaAutosize from 'react-textarea-autosize';
import { useEpisodeContext } from '../contexts/EpisodeContext';
import type { EpisodeSynopsisV1 } from '../../common/types';

const { Title, Text } = Typography;

export const EpisodeScriptGeneration: React.FC = () => {
    const { scriptId, stageId, episodeId } = useParams<{ 
        scriptId: string; 
        stageId: string; 
        episodeId: string; 
    }>();
    const navigate = useNavigate();
    const { state, actions } = useEpisodeContext();

    // Form state
    const [scriptLength, setScriptLength] = useState<number>(2000);
    const [includeDialogue, setIncludeDialogue] = useState(true);
    const [includeActionLines, setIncludeActionLines] = useState(true);
    const [includeSceneDescriptions, setIncludeSceneDescriptions] = useState(true);
    const [customRequirements, setCustomRequirements] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Find episode data
    const currentStage = state.stages.find(stage => stage.artifactId === stageId);
    const stageEpisodeData = stageId ? state.stageEpisodeData[stageId] : undefined;
    const currentEpisode = stageEpisodeData?.episodes?.find(
        ep => ep.episodeNumber.toString() === episodeId
    );

    // Initialize data if needed
    useEffect(() => {
        if (scriptId && scriptId !== state.scriptId) {
            actions.setScriptId(scriptId);
            actions.loadStages(scriptId);
        }
    }, [scriptId, state.scriptId, actions]);

    // Set selected stage and episode
    useEffect(() => {
        if (stageId && stageId !== state.selectedStageId) {
            actions.setSelectedStage(stageId);
        }
        if (episodeId && episodeId !== state.selectedEpisodeId) {
            actions.setSelectedEpisode(episodeId);
        }
    }, [stageId, episodeId, state.selectedStageId, state.selectedEpisodeId, actions]);

    const handleGenerateScript = async () => {
        if (!scriptId || !stageId || !episodeId || !currentEpisode) {
            message.error('缺少必要参数');
            return;
        }

        try {
            setIsGenerating(true);

            // Call script generation API
            const response = await fetch('/api/scripts/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    episodeId,
                    stageId,
                    userRequirements: customRequirements || undefined
                })
            });

            if (!response.ok) {
                throw new Error('生成失败');
            }

            const result = await response.json();
            console.log('Script generation started:', result);
            
            message.success('剧本生成已开始，正在跳转到剧本页面...');
            
            // Navigate to script display page with transformId in state
            navigate(`/projects/${scriptId}/stages/${stageId}/episodes/${episodeId}/script`, {
                state: { 
                    transformId: result.transformId,
                    sessionId: result.sessionId 
                }
            });

        } catch (error) {
            console.error('Error generating script:', error);
            message.error('生成失败');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!scriptId || !stageId || !episodeId) {
        return (
            <Alert
                message="参数错误"
                description="缺少必要的路由参数"
                type="error"
                style={{ margin: '20px' }}
            />
        );
    }

    if (!currentEpisode) {
        return (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#fff'
            }}>
                <Text>加载剧集数据中...</Text>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '20px',
            backgroundColor: '#0a0a0a'
        }}>
                <div style={{
                    maxWidth: '900px',
                    margin: '0 auto'
                }}>
                    {/* Episode Info Card */}
                    <Card
                        style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #404040',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}
                    >
                        <Title level={5} style={{ color: '#fff', marginBottom: '12px' }}>
                            剧集信息
                        </Title>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <div>
                                <Text strong style={{ color: '#fff' }}>标题：</Text>
                                <Text style={{ color: '#d9d9d9' }}>{currentEpisode.title || '无标题'}</Text>
                            </div>
                            <div>
                                <Text strong style={{ color: '#fff' }}>简介：</Text>
                                <Text style={{ color: '#d9d9d9' }}>{currentEpisode.briefSummary}</Text>
                            </div>
                            {currentEpisode.keyEvents && currentEpisode.keyEvents.length > 0 && (
                                <div>
                                    <Text strong style={{ color: '#fff' }}>关键事件：</Text>
                                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                        {currentEpisode.keyEvents.map((event, index) => (
                                            <li key={index} style={{ color: '#d9d9d9' }}>{event}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {currentEpisode.hooks && (
                                <div>
                                    <Text strong style={{ color: '#fff' }}>结尾悬念：</Text>
                                    <Text style={{ color: '#d9d9d9' }}>{currentEpisode.hooks}</Text>
                                </div>
                            )}
                        </Space>
                    </Card>

                    {/* Script Generation Form */}
                    <Card
                        style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #404040',
                            borderRadius: '12px'
                        }}
                    >
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <div style={{ textAlign: 'center' }}>
                                <Title level={3} style={{ color: '#fff', marginBottom: '8px' }}>
                                    生成剧本
                                </Title>
                                <Text type="secondary" style={{ color: '#b0b0b0' }}>
                                    基于剧集大纲生成详细的剧本内容
                                </Text>
                            </div>

                            {/* Script Parameters */}
                            <div>
                                <Text strong style={{ color: '#fff', marginBottom: '16px', display: 'block' }}>
                                    剧本规格
                                </Text>
                                
                                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                    <div>
                                        <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                                            剧本长度（字数）
                                        </Text>
                                        <InputNumber
                                            value={scriptLength}
                                            onChange={(value) => setScriptLength(value || 2000)}
                                            min={500}
                                            max={10000}
                                            step={100}
                                            style={{
                                                width: '200px',
                                                backgroundColor: '#1f1f1f',
                                                borderColor: '#404040',
                                                color: '#fff'
                                            }}
                                            suffix="字"
                                        />
                                        <Text type="secondary" style={{ fontSize: '12px', color: '#888', marginLeft: '12px' }}>
                                            建议：短剧 1500-3000字，长剧 3000-6000字
                                        </Text>
                                    </div>

                                    <div>
                                        <Text strong style={{ color: '#fff', display: 'block', marginBottom: '12px' }}>
                                            包含内容
                                        </Text>
                                        <Space direction="vertical" size="small">
                                            <Checkbox
                                                checked={includeDialogue}
                                                onChange={(e) => setIncludeDialogue(e.target.checked)}
                                                style={{ color: '#fff' }}
                                            >
                                                对话内容（建议必选）
                                            </Checkbox>
                                            <Checkbox
                                                checked={includeActionLines}
                                                onChange={(e) => setIncludeActionLines(e.target.checked)}
                                                style={{ color: '#fff' }}
                                            >
                                                动作描述
                                            </Checkbox>
                                            <Checkbox
                                                checked={includeSceneDescriptions}
                                                onChange={(e) => setIncludeSceneDescriptions(e.target.checked)}
                                                style={{ color: '#fff' }}
                                            >
                                                场景描述
                                            </Checkbox>
                                        </Space>
                                    </div>
                                </Space>
                            </div>

                            {/* Custom Requirements */}
                            <div>
                                <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                                    额外要求（可选）
                                </Text>
                                <TextareaAutosize
                                    value={customRequirements}
                                    onChange={(e) => setCustomRequirements(e.target.value)}
                                    placeholder="请输入对剧本生成的特殊要求，如特定的风格、情感表达方式等..."
                                    minRows={3}
                                    maxRows={6}
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

                            {/* Generate Button */}
                            <Button
                                type="primary"
                                onClick={handleGenerateScript}
                                loading={isGenerating}
                                disabled={!includeDialogue && !includeActionLines && !includeSceneDescriptions}
                                icon={<FileTextOutlined />}
                                style={{
                                    width: '100%',
                                    height: '40px',
                                    background: '#52c41a',
                                    borderColor: '#52c41a'
                                }}
                            >
                                {isGenerating ? '生成中...' : '生成剧本'}
                            </Button>

                            {(!includeDialogue && !includeActionLines && !includeSceneDescriptions) && (
                                <Alert
                                    message="请至少选择一种包含内容"
                                    type="warning"
                                    showIcon
                                    style={{
                                        backgroundColor: '#2d2a1f',
                                        border: '1px solid #d4a948',
                                        color: '#fff'
                                    }}
                                />
                            )}
                        </Space>
                    </Card>
                </div>
            </div>
    );
};