import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Typography, message, Spin, Breadcrumb, Space, Button, Alert, Collapse, Input, Tag } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, LoadingOutlined, ExportOutlined, PlayCircleOutlined, StopOutlined, EditOutlined } from '@ant-design/icons';
import { createEditor, Descendant } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import type { EpisodeScriptV1 } from '../../common/streaming/types';
import { useLLMStreaming } from '../hooks/useLLMStreaming';
import { ScriptStreamingService, StreamingScript } from '../services/implementations/ScriptStreamingService';
import { useEpisodeContext } from '../contexts/EpisodeContext';
import { OutlineExportModal } from './shared/OutlineExportModal';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface ScriptNode {
    type: string;
    children: ScriptNode[];
    text?: string;
}

export const ScriptDisplayPage: React.FC = () => {
    const { scriptId, stageId, episodeId } = useParams<{
        scriptId: string;
        stageId: string;
        episodeId: string;
    }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { actions } = useEpisodeContext();

    // Get transformId from navigation state
    const { transformId: navigationTransformId, sessionId } = (location.state as any) || {};

    const [scriptData, setScriptData] = useState<EpisodeScriptV1 | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Local transform ID state that can override navigation state for regeneration
    const [currentTransformId, setCurrentTransformId] = useState<string | undefined>(navigationTransformId);
    
    // Export modal state
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    // Script generation parameters state
    const [scriptParametersCollapsed, setScriptParametersCollapsed] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editedUserRequirements, setEditedUserRequirements] = useState('');
    const [episodeSynopsis, setEpisodeSynopsis] = useState('');
    const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const [maxPollAttempts] = useState(10); // Maximum 30 seconds of polling
    const [pollTimeoutId, setPollTimeoutId] = useState<NodeJS.Timeout | null>(null);

    // Create streaming service
    const streamingService = useMemo(() => new ScriptStreamingService(), []);

    // Use streaming hook to monitor generation progress
    const { 
        status: streamingStatus,
        items: streamingItems,
        isStreaming, 
        isComplete, 
        error: streamingError 
    } = useLLMStreaming(streamingService, { transformId: currentTransformId });

    // Create a read-only Slate editor
    const editor = useMemo(() => withReact(createEditor()), []);

    useEffect(() => {
        // Reset poll count when episode/stage changes
        setPollCount(0);
        if (pollTimeoutId) {
            clearTimeout(pollTimeoutId);
            setPollTimeoutId(null);
        }

        // Only try to load script when generation is complete
        if (isComplete && !scriptData) {
            console.log('[ScriptDisplayPage] Loading script after completion');
            loadScript();
        }
        // If no transformId, try to load script directly (for existing scripts)
        else if (!currentTransformId && !scriptData && !loading && !isStreaming) {
            console.log('[ScriptDisplayPage] Loading script without transformId');
            loadScript();
        }
    }, [episodeId, stageId, isComplete, currentTransformId]); // Removed scriptData and loading from dependencies to prevent loops

    // Use streaming script data if available
    const currentScriptContent = useMemo(() => {
        console.log('[ScriptDisplayPage] Computing current script content:', {
            streamingItemsLength: streamingItems?.length || 0,
            isStreaming,
            hasScriptData: !!scriptData,
            streamingStatus,
            firstStreamingItem: streamingItems?.[0] ? {
                episodeNumber: streamingItems[0].episodeNumber,
                scriptContentLength: streamingItems[0].scriptContent?.length || 0,
                scriptContentPreview: streamingItems[0].scriptContent?.substring(0, 50) || 'no content',
                scenesCount: streamingItems[0].scenes?.length || 0
            } : null
        });

        // Helper function to convert scenes array to script text
        const convertScenesToText = (scenes: any[]): string => {
            if (!scenes || scenes.length === 0) return '';
            
            return scenes.map(scene => {
                let sceneText = `【第${scene.sceneNumber}场：${scene.location}·${scene.timeOfDay}】\n\n`;
                
                if (scene.action) {
                    sceneText += `（${scene.action}）\n\n`;
                }
                
                if (scene.dialogue && scene.dialogue.length > 0) {
                    scene.dialogue.forEach((line: any) => {
                        sceneText += `${line.character}：${line.line}\n`;
                        if (line.direction) {
                            sceneText += `（${line.direction}）\n`;
                        }
                        sceneText += '\n';
                    });
                }
                
                return sceneText.trim();
            }).join('\n\n');
        };

        // 🔥 PRIORITY: If we're in streaming mode (actively streaming or have streaming transform), prioritize streaming content
        if (currentTransformId && (isStreaming || streamingStatus === 'streaming' || streamingItems?.length > 0)) {
            console.log('[ScriptDisplayPage] In streaming mode - prioritizing streaming content');
            
            if (streamingItems && streamingItems.length > 0) {
                // Use latest streaming item
                const latestScript = streamingItems[streamingItems.length - 1] as StreamingScript;
                let scriptContent = latestScript.scriptContent || '';
                
                if (!scriptContent || scriptContent.length < 10) {
                    scriptContent = convertScenesToText(latestScript.scenes || []);
                }
                
                console.log('[ScriptDisplayPage] Using streaming content:', {
                    contentLength: scriptContent.length,
                    contentPreview: scriptContent.substring(0, 100) || 'no content',
                    isStreaming
                });
                return scriptContent;
            } else {
                // Streaming mode but no items yet - show loading message
                console.log('[ScriptDisplayPage] Streaming mode but no items yet');
                return '剧本生成中...';
            }
        }
        
        // 🔥 FALLBACK: Only use loaded script data if not in streaming mode
        if (scriptData) {
            let loadedContent = scriptData.scriptContent || '';
            
            // Convert from scenes if scriptContent is empty or placeholder
            if (!loadedContent || loadedContent.length < 10 || 
                loadedContent.includes('完整剧本文本') || loadedContent.includes('剧本内容')) {
                console.log('[ScriptDisplayPage] Loaded scriptContent is placeholder, converting from scenes');
                loadedContent = convertScenesToText(scriptData.scenes || []);
            }
            
            console.log('[ScriptDisplayPage] Using loaded content:', {
                contentLength: loadedContent.length,
                contentPreview: loadedContent.substring(0, 100) || 'no content'
            });
            return loadedContent;
        }
        
        // No content available
        console.log('[ScriptDisplayPage] No content available');
        return '';
    }, [streamingItems, scriptData, isStreaming, currentTransformId, streamingStatus]);

    // Update loading state when streaming content becomes available
    useEffect(() => {
        console.log('[ScriptDisplayPage] Loading state effect:', {
            streamingItemsLength: streamingItems?.length || 0,
            loading,
            currentContentLength: currentScriptContent.length
        });

        if (streamingItems && streamingItems.length > 0 && loading) {
            console.log('[ScriptDisplayPage] Setting loading to false due to streaming content');
            setLoading(false);
            setError(null);
        }
    }, [streamingItems, loading, currentScriptContent]);

    // Update episode script status when streaming completes
    useEffect(() => {
        if (isComplete && streamingItems && streamingItems.length > 0 && stageId && episodeId) {
            console.log('[ScriptDisplayPage] Script generation completed, updating status');
            actions.updateEpisodeScriptStatus(stageId, parseInt(episodeId), true);
        }
    }, [isComplete, streamingItems, stageId, episodeId, actions]);

    // Auto-collapse script parameters when generation starts or script is available
    useEffect(() => {
        // Auto-collapse when streaming starts
        if (isStreaming && !scriptParametersCollapsed) {
            setScriptParametersCollapsed(true);
        }
        // Auto-collapse when script is loaded (only once)
        else if ((scriptData || streamingItems?.length) && !scriptParametersCollapsed && !hasAutoCollapsed) {
            setScriptParametersCollapsed(true);
            setHasAutoCollapsed(true);
        }
    }, [isStreaming, scriptData, streamingItems?.length, scriptParametersCollapsed, hasAutoCollapsed]);

    // Load episode synopsis for script generation context
    useEffect(() => {
        const loadEpisodeSynopsis = async () => {
            if (!stageId || !episodeId) return;

            try {
                const response = await fetch(`/api/episodes/stages/${stageId}/episodes/${episodeId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const episode = await response.json();
                    setEpisodeSynopsis(episode.synopsis || episode.briefSummary || '');
                }
            } catch (error) {
                console.warn('Could not load episode synopsis:', error);
            }
        };

        loadEpisodeSynopsis();
    }, [stageId, episodeId]);

    // Load script when component mounts or route parameters change
    useEffect(() => {
        if (stageId && episodeId) {
            console.log('[ScriptDisplayPage] Component mounted or params changed, loading script');
            setPollCount(0); // Reset poll count
            loadScript();
        }
    }, [stageId, episodeId]);

    // Update currentTransformId when navigation state changes
    useEffect(() => {
        setCurrentTransformId(navigationTransformId);
    }, [navigationTransformId]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (pollTimeoutId) {
                console.log('[ScriptDisplayPage] Cleaning up poll timeout');
                clearTimeout(pollTimeoutId);
            }
        };
    }, [pollTimeoutId]);

    const loadScript = async () => {
        if (!episodeId || !stageId) return;

        // Prevent excessive polling
        if (pollCount >= maxPollAttempts) {
            console.log('[ScriptDisplayPage] Maximum poll attempts reached, stopping');
            setError('剧本加载超时，请检查生成状态');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            console.log(`[ScriptDisplayPage] Loading script attempt ${pollCount + 1}/${maxPollAttempts}`);

            const response = await fetch(`/api/scripts/${episodeId}/${stageId}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Script not found, check if generation is in progress
                    setPollCount(prev => prev + 1);
                    setError('剧本生成中，请稍候...');
                    
                    // Only continue polling if we haven't reached the limit
                    if (pollCount + 1 < maxPollAttempts) {
                        console.log(`[ScriptDisplayPage] Script not found, polling again in 3s (attempt ${pollCount + 1})`);
                        const timeoutId = setTimeout(loadScript, 3000);
                        setPollTimeoutId(timeoutId);
                    } else {
                        console.log('[ScriptDisplayPage] Reached max poll attempts');
                        setError('剧本生成可能仍在进行中，请稍后手动刷新页面');
                    }
                    return;
                }
                throw new Error('加载剧本失败');
            }

            const script = await response.json();
            setScriptData(script);
            setPollCount(0); // Reset poll count on success
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
                setPollTimeoutId(null);
            }
            console.log('[ScriptDisplayPage] Script loaded successfully');
        } catch (err) {
            console.error('Error loading script:', err);
            setError(err instanceof Error ? err.message : '加载失败');
        } finally {
            setLoading(false);
        }
    };

    // Convert script content to Slate format
    const slateValue: Descendant[] = useMemo(() => {
        console.log('[ScriptDisplayPage] Computing slate value:', {
            contentLength: currentScriptContent.length,
            isStreaming,
            streamingStatus,
            contentPreview: currentScriptContent.substring(0, 100) || 'empty'
        });

        if (!currentScriptContent || currentScriptContent.length < 10) {
            const message = (isStreaming || streamingStatus === 'streaming') ? '剧本生成中...' : '暂无内容';
            console.log('[ScriptDisplayPage] No content, showing message:', message);
            return [
                {
                    type: 'paragraph',
                    children: [{ text: message }]
                }
            ] as Descendant[];
        }

        // Parse script content into structured format
        const lines = currentScriptContent.split('\n');
        const nodes: Descendant[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                // Check if it's a scene heading (Chinese script format)
                if (/【.*】/.test(trimmedLine)) {
                    nodes.push({
                        type: 'scene-heading',
                        children: [{ text: trimmedLine }]
                    } as Descendant);
                }
                // Check if it's a character name (Chinese name followed by colon or action in parentheses)
                else if (/^[\u4e00-\u9fff\w\s]+[:：]/.test(trimmedLine)) {
                    nodes.push({
                        type: 'character',
                        children: [{ text: trimmedLine }]
                    } as Descendant);
                }
                // Check if it's an action line (parenthetical)
                else if (trimmedLine.startsWith('(') || trimmedLine.startsWith('（')) {
                    nodes.push({
                        type: 'action',
                        children: [{ text: trimmedLine }]
                    } as Descendant);
                }
                // Regular dialogue or description
                else {
                    nodes.push({
                        type: 'paragraph',
                        children: [{ text: trimmedLine }]
                    } as Descendant);
                }
            } else {
                // Empty line for spacing
                nodes.push({
                    type: 'paragraph',
                    children: [{ text: '' }]
                } as Descendant);
            }
        }

        console.log('[ScriptDisplayPage] Created', nodes.length, 'slate nodes');
        return nodes.length > 0 ? nodes : [
            {
                type: 'paragraph',
                children: [{ text: '暂无内容' }]
            }
        ] as Descendant[];
    }, [currentScriptContent, isStreaming]);

    // Render different element types
    const renderElement = (props: any) => {
        const { attributes, children, element } = props;
        
        switch (element.type) {
            case 'character':
                return (
                    <div {...attributes} style={{ 
                        fontWeight: 'bold', 
                        color: '#52c41a',
                        marginTop: '16px',
                        marginBottom: '4px',
                        fontSize: '16px'
                    }}>
                        {children}
                    </div>
                );
            case 'scene-heading':
                return (
                    <div {...attributes} style={{
                        fontWeight: 'bold',
                        color: '#1890ff',
                        marginTop: '24px',
                        marginBottom: '8px',
                        fontSize: '18px',
                        textTransform: 'uppercase'
                    }}>
                        {children}
                    </div>
                );
            case 'action':
                return (
                    <div {...attributes} style={{
                        fontStyle: 'italic',
                        color: '#888',
                        marginLeft: '20px',
                        marginBottom: '8px'
                    }}>
                        {children}
                    </div>
                );
            default:
                return (
                    <div {...attributes} style={{
                        marginBottom: '8px',
                        lineHeight: '1.6'
                    }}>
                        {children}
                    </div>
                );
        }
    };

    const renderLeaf = (props: any) => {
        return <span {...props.attributes}>{props.children}</span>;
    };

    const handleExportScript = () => {
        const contentToExport = currentScriptContent;
        if (!contentToExport) {
            message.warning('暂无可导出的剧本内容');
            return;
        }

        // Format script for export
        const episodeNumber = scriptData?.episodeNumber || parseInt(episodeId || '0');
        const exportData = [
            '================================================',
            `第 ${episodeNumber} 集剧本`,
            '================================================',
            '',
            '📋 剧本信息：',
            `• 字数：${scriptData?.wordCount || '计算中'}`,
            `• 预估时长：${scriptData?.estimatedDuration || '计算中'} 分钟`,
            `• 生成时间：${scriptData?.generatedAt ? new Date(scriptData.generatedAt).toLocaleString() : '未知'}`,
            '',
            '📝 剧本内容：',
            '================================================',
            '',
            contentToExport,
            '',
            '================================================',
            `导出时间：${new Date().toLocaleString()}`,
            '================================================'
        ].join('\n');

        setExportText(exportData);
        setIsExportModalVisible(true);
    };

    const handleRegenerateScript = async () => {
        if (!stageId || !episodeId) return;

        try {
            // Start script generation
            const response = await fetch(`/api/scripts/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    episodeId: episodeId,
                    stageId: stageId,
                    userRequirements: editedUserRequirements.trim() || undefined
                })
            });

            if (!response.ok) {
                throw new Error('生成剧本失败');
            }

            const result = await response.json();
            
            // Clear old script data and connect to new streaming
            setScriptData(null);
            setError(null);
            setLoading(false);
            
            // Connect to the new streaming transform by updating the transform ID
            setCurrentTransformId(result.transformId);
            
            message.success('剧本重新生成已开始');
        } catch (error) {
            console.error('Error regenerating script:', error);
            message.error('重新生成剧本失败');
        }
    };

    const handleSaveParameters = () => {
        setEditMode(false);
        message.success('参数已保存');
    };

    const breadcrumbItems = [
        {
            title: (
                <Button 
                    type="link" 
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(`/scripts/${scriptId}/stages/${stageId}/episodes/${episodeId}`)}
                    style={{ color: '#1890ff', padding: 0 }}
                >
                    返回剧集
                </Button>
            )
        },
        {
            title: '剧本'
        }
    ];

    // Show loading states - only show loading screen if we're still loading and have no content
    const shouldShowLoadingScreen = (loading && !scriptData && (!streamingItems || streamingItems.length === 0)) || 
                                   (isStreaming && (!streamingItems || streamingItems.length === 0));

    console.log('[ScriptDisplayPage] Loading screen decision:', {
        loading,
        hasScriptData: !!scriptData,
        isStreaming,
        streamingItemsLength: streamingItems?.length || 0,
        shouldShowLoadingScreen,
        hasError: !!error || !!streamingError
    });

    if (shouldShowLoadingScreen) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a'
            }}>
                <Space direction="vertical" align="center" size="large" style={{ textAlign: 'center' }}>
                    <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48, color: '#1890ff' }} />} />
                    <Text style={{ color: '#fff', fontSize: '16px' }}>
                        {isStreaming ? '剧本生成中...' : (error || '加载剧本中...')}
                    </Text>
                    {isStreaming && (
                        <div style={{ maxWidth: '400px' }}>
                            <Text style={{ color: '#888', fontSize: '14px' }}>
                                正在根据剧集大纲生成详细剧本内容，请稍候...
                            </Text>
                        </div>
                    )}
                    {(streamingError || error) && (
                        <Alert
                            message="生成失败"
                            description={streamingError || error}
                            type="error"
                            style={{ maxWidth: '400px' }}
                        />
                    )}
                </Space>
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
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                {/* Breadcrumb Navigation */}
                <div style={{ marginBottom: '20px' }}>
                    <Breadcrumb 
                        items={breadcrumbItems}
                        style={{ 
                            color: '#fff',
                            fontSize: '14px'
                        }}
                    />
                </div>

                {/* Collapsible Script Generation Parameters */}
                <Collapse
                    activeKey={scriptParametersCollapsed ? [] : ['script-params']}
                    onChange={(keys) => {
                        setScriptParametersCollapsed(!keys.includes('script-params'));
                        // Mark that user has manually interacted, preventing auto-collapse interference
                        if (!hasAutoCollapsed) {
                            setHasAutoCollapsed(true);
                        }
                    }}
                    style={{ marginBottom: '20px' }}
                    size="large"
                >
                    <Panel 
                        header={`第${episodeId}集剧本生成参数`} 
                        key="script-params"
                        extra={
                            <Space size="small">
                                {scriptData && (
                                    <Tag color="green">已生成剧本</Tag>
                                )}
                                {isStreaming && (
                                    <Tag color="processing">生成中</Tag>
                                )}
                            </Space>
                        }
                    >
                        {/* Episode Synopsis Context */}
                        {episodeSynopsis && (
                            <div style={{ marginBottom: '20px' }}>
                                <Title level={5} style={{ color: '#fff' }}>剧集简介</Title>
                                <Paragraph style={{ color: '#ccc', backgroundColor: '#262626', padding: '12px', borderRadius: '6px' }}>
                                    {episodeSynopsis}
                                </Paragraph>
                            </div>
                        )}

                        {/* Generation Parameters */}
                        <div style={{ marginBottom: '20px' }}>
                            <Title level={5} style={{ color: '#fff' }}>生成参数</Title>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div>
                                    <Text strong style={{ color: '#fff' }}>特殊要求: </Text>
                                    {editMode ? (
                                        <TextArea
                                            rows={3}
                                            placeholder="输入对剧本生成的特殊要求..."
                                            value={editedUserRequirements}
                                            onChange={e => setEditedUserRequirements(e.target.value)}
                                            style={{
                                                backgroundColor: '#1f1f1f',
                                                borderColor: '#404040',
                                                color: '#fff'
                                            }}
                                        />
                                    ) : (
                                        <Text style={{ color: '#ccc' }}>
                                            {editedUserRequirements || '无特殊要求'}
                                        </Text>
                                    )}
                                </div>
                            </Space>
                        </div>

                        {/* Action Buttons */}
                        <Space>
                            {editMode ? (
                                <>
                                    <Button type="primary" onClick={handleSaveParameters}>
                                        保存参数
                                    </Button>
                                    <Button onClick={() => setEditMode(false)}>
                                        取消
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    icon={<EditOutlined />}
                                    onClick={() => setEditMode(true)}
                                >
                                    编辑参数
                                </Button>
                            )}

                            {!isStreaming ? (
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={handleRegenerateScript}
                                    disabled={editMode}
                                >
                                    {scriptData || currentScriptContent ? '重新生成剧本' : '生成剧本'}
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    danger
                                    icon={<StopOutlined />}
                                    disabled={true}
                                >
                                    停止生成
                                </Button>
                            )}
                        </Space>
                    </Panel>
                </Collapse>

                {/* Script Header */}
                {scriptData && (
                    <Card
                        style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #404040',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                            <Space direction="vertical" size="small" style={{ flex: 1 }}>
                                <Title level={4} style={{ color: '#fff', marginBottom: '8px' }}>
                                    <FileTextOutlined style={{ marginRight: '8px' }} />
                                    第 {scriptData.episodeNumber} 集剧本
                                </Title>
                                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                    <div>
                                        <Text style={{ color: '#888' }}>字数：</Text>
                                        <Text style={{ color: '#fff' }}>{scriptData.wordCount || '计算中'}</Text>
                                    </div>
                                    <div>
                                        <Text style={{ color: '#888' }}>预估时长：</Text>
                                        <Text style={{ color: '#fff' }}>{scriptData.estimatedDuration || '计算中'} 分钟</Text>
                                    </div>
                                    <div>
                                        <Text style={{ color: '#888' }}>生成时间：</Text>
                                        <Text style={{ color: '#fff' }}>
                                            {scriptData.generatedAt ? new Date(scriptData.generatedAt).toLocaleString() : '未知'}
                                        </Text>
                                    </div>
                                </div>
                            </Space>
                            <Button
                                icon={<ExportOutlined />}
                                onClick={handleExportScript}
                                style={{ marginLeft: '16px' }}
                            >
                                导出剧本
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Streaming Progress Indicator */}
                {(isStreaming || streamingStatus === 'streaming') && (
                    <Card
                        style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #404040',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                            <Space direction="vertical" size="small" style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <LoadingOutlined style={{ color: '#1890ff' }} />
                                    <Text style={{ color: '#fff' }}>剧本生成中...</Text>
                                </div>
                                <div style={{ color: '#888', fontSize: '14px' }}>
                                    正在根据剧集大纲生成详细剧本内容，请稍候...
                                </div>
                                {streamingItems && streamingItems.length > 0 && (
                                    <div style={{ color: '#888', fontSize: '12px' }}>
                                        已生成内容：{currentScriptContent.length} 字符
                                    </div>
                                )}
                            </Space>
                            {currentScriptContent && currentScriptContent.length > 0 && (
                                <Button
                                    icon={<ExportOutlined />}
                                    onClick={handleExportScript}
                                    style={{ marginLeft: '16px' }}
                                    size="small"
                                >
                                    导出当前内容
                                </Button>
                            )}
                        </div>
                    </Card>
                )}

                {/* Script Content */}
                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #404040',
                        borderRadius: '12px',
                        minHeight: '600px'
                    }}
                >
                    <div style={{
                        padding: '20px',
                        backgroundColor: '#1f1f1f',
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#fff',
                        whiteSpace: 'pre-wrap',
                        minHeight: '500px'
                    }}>
                        <Slate 
                            editor={editor} 
                            initialValue={slateValue}
                            onChange={() => {}} // Read-only
                        >
                            <Editable
                                readOnly={true}
                                renderElement={renderElement}
                                renderLeaf={renderLeaf}
                                style={{
                                    outline: 'none',
                                    minHeight: '500px'
                                }}
                            />
                        </Slate>
                    </div>
                </Card>
            </div>

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                exportText={exportText}
                title="剧本导出"
            />
        </div>
    );
};