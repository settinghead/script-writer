import React, { useState, useCallback, useMemo } from 'react';
import { Button, Typography, Alert, message } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title, Text } = Typography;

const ChroniclesGenerationAction: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const projectData = useProjectData();

    // Find the latest outline settings artifact
    const latestOutlineSettings = useMemo(() => {
        if (!Array.isArray(projectData.artifacts)) return null;

        const outlineSettingsArtifacts = projectData.artifacts.filter((artifact: any) =>
            artifact.schema_type === 'outline_settings_schema' || artifact.type === 'outline_settings'
        );

        if (outlineSettingsArtifacts.length === 0) return null;

        // Sort by creation time and get the latest
        outlineSettingsArtifacts.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return outlineSettingsArtifacts[0];
    }, [projectData.artifacts]);

    // Handle chronicles generation
    const handleGenerateChronicles = useCallback(async () => {
        if (!latestOutlineSettings) {
            message.error('未找到剧本框架');
            return;
        }

        setIsGenerating(true);
        try {
            // Call the chronicles generation API via chat
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectId,
                    message: `请基于剧本框架生成时间顺序大纲。源剧本框架ID: ${latestOutlineSettings.id}`
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to generate chronicles: ${response.status}`);
            }

            // The response will be handled by the streaming framework
            message.success('时间顺序大纲生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating chronicles:', error);
            const errorMessage = `生成时间顺序大纲失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [latestOutlineSettings, projectId, onSuccess, onError]);

    // Show error if no outline settings found
    if (!latestOutlineSettings) {
        return (
            <Alert
                message="需要先生成剧本框架"
                description="请先完成剧本框架，然后再生成时间顺序大纲"
                type="warning"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    // Get outline settings data for display
    const outlineData = useMemo(() => {
        if (!latestOutlineSettings?.data) return null;
        try {
            return typeof latestOutlineSettings.data === 'string'
                ? JSON.parse(latestOutlineSettings.data)
                : latestOutlineSettings.data;
        } catch (error) {
            console.warn('Failed to parse outline settings data:', error);
            return null;
        }
    }, [latestOutlineSettings]);

    return (
        <div style={{ padding: '24px' }}>
            <Title level={4} style={{ marginBottom: '24px', color: '#fff', textAlign: 'center' }}>
                <HistoryOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                生成时间顺序大纲
            </Title>

            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {/* Show outline settings info */}
                <div style={{
                    background: '#2a2a2a',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    border: '1px solid #434343'
                }}>
                    <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                        基于剧本框架:
                    </Text>
                    <Text style={{ color: '#ccc', fontSize: '14px' }}>
                        {outlineData?.title || '剧本框架'}
                    </Text>
                    {outlineData?.genre && (
                        <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: '#aaa', fontSize: '12px' }}>
                                类型: {outlineData.genre}
                            </Text>
                        </div>
                    )}
                    {outlineData?.characters && outlineData.characters.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: '#aaa', fontSize: '12px' }}>
                                角色数量: {outlineData.characters.length}
                            </Text>
                        </div>
                    )}
                </div>

                {/* Action description */}
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                    <Text style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6' }}>
                        将基于现有的剧本框架（人物角色、故事背景、商业定位等）生成详细的时间顺序大纲，
                        包括历史背景事件、前因后果、主要故事线等按时间顺序排列的完整故事结构。
                    </Text>
                </div>

                {/* Generate button */}
                <div style={{ textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        loading={isGenerating}
                        onClick={handleGenerateChronicles}
                        style={{
                            width: '200px',
                            height: '48px',
                            fontSize: '16px',
                            borderRadius: '8px'
                        }}
                    >
                        {isGenerating ? '生成中...' : '生成时间顺序大纲'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ChroniclesGenerationAction; 