import React, { useState, useCallback, useMemo } from 'react';
import { Button, Typography, Alert, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title, Text } = Typography;

const EpisodeGenerationAction: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const projectData = useProjectData();

    // Find the latest chronicles artifact
    const latestChronicles = useMemo(() => {
        if (!Array.isArray(projectData.artifacts)) return null;

        const chroniclesArtifacts = projectData.artifacts.filter((artifact: any) =>
            artifact.schema_type === 'chronicles_schema' || artifact.type === 'chronicles'
        );

        if (chroniclesArtifacts.length === 0) return null;

        // Sort by creation time and get the latest
        chroniclesArtifacts.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return chroniclesArtifacts[0];
    }, [projectData.artifacts]);

    // Handle episode generation
    const handleGenerateEpisodes = useCallback(async () => {
        if (!latestChronicles) {
            message.error('未找到时间顺序大纲');
            return;
        }

        setIsGenerating(true);
        try {
            // Call the episode generation API via chat
            const response = await fetch(`/api/chat/${projectId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                credentials: 'include',
                body: JSON.stringify({
                    content: `请基于时间顺序大纲生成分集剧本。源时间顺序大纲ID: ${latestChronicles.id}`,
                    metadata: {}
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to generate episodes: ${response.status}`);
            }

            // The response will be handled by the streaming framework
            message.success('分集剧本生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episodes:', error);
            const errorMessage = `生成分集剧本失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [latestChronicles, projectId, onSuccess, onError]);

    // Show error if no chronicles found
    if (!latestChronicles) {
        return (
            <Alert
                message="需要先生成时间顺序大纲"
                description="请先完成时间顺序大纲，然后再生成分集剧本"
                type="warning"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    // Get chronicles data for display
    const chroniclesData = useMemo(() => {
        if (!latestChronicles?.data) return null;
        try {
            return typeof latestChronicles.data === 'string'
                ? JSON.parse(latestChronicles.data)
                : latestChronicles.data;
        } catch (error) {
            console.warn('Failed to parse chronicles data:', error);
            return null;
        }
    }, [latestChronicles]);

    return (
        <div >


            <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                {/* Show chronicles info */}
                <div style={{
                    background: '#2a2a2a',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #434343'
                }}>
                    <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                        基于时间顺序大纲:
                    </Text>
                    <Text style={{ color: '#ccc', fontSize: '14px' }}>
                        {chroniclesData?.title || '时间顺序大纲'}
                    </Text>
                    {chroniclesData?.stages && chroniclesData.stages.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: '#aaa', fontSize: '12px' }}>
                                阶段数量: {chroniclesData.stages.length}
                            </Text>
                        </div>
                    )}
                    {chroniclesData?.totalEpisodes && (
                        <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: '#aaa', fontSize: '12px' }}>
                                预计集数: {chroniclesData.totalEpisodes}
                            </Text>
                        </div>
                    )}
                </div>


                {/* Generate button */}
                <div style={{ textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        loading={isGenerating}
                        onClick={handleGenerateEpisodes}
                        style={{
                            width: '200px',
                            height: '48px',
                            fontSize: '16px',
                            borderRadius: '8px'
                        }}
                    >
                        {isGenerating ? '生成中...' : '生成分集剧本'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EpisodeGenerationAction; 