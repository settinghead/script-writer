import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Typography, message, Spin, Breadcrumb, Space, Button, Alert } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons';
import { createEditor, Descendant } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import type { EpisodeScriptV1 } from '../../common/streaming/types';
import { useLLMStreaming } from '../hooks/useLLMStreaming';
import { ScriptStreamingService, StreamingScript } from '../services/implementations/ScriptStreamingService';
import { useEpisodeContext } from '../contexts/EpisodeContext';

const { Title, Text } = Typography;

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
    const { transformId, sessionId } = (location.state as any) || {};

    const [scriptData, setScriptData] = useState<EpisodeScriptV1 | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create streaming service
    const streamingService = useMemo(() => new ScriptStreamingService(), []);

    // Use streaming hook to monitor generation progress
    const { 
        status: streamingStatus,
        items: streamingItems,
        isStreaming, 
        isComplete, 
        error: streamingError 
    } = useLLMStreaming(streamingService, { transformId });

    // Create a read-only Slate editor
    const editor = useMemo(() => withReact(createEditor()), []);

    useEffect(() => {
        // Only try to load script when generation is complete
        if (isComplete && !scriptData) {
            loadScript();
        }
        // If no transformId, try to load script directly (for existing scripts)
        else if (!transformId) {
            loadScript();
        }
    }, [episodeId, stageId, isComplete, transformId, scriptData]);

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

        // If we have streaming items, use the latest one
        if (streamingItems && streamingItems.length > 0) {
            const latestScript = streamingItems[streamingItems.length - 1] as StreamingScript;
            let scriptContent = latestScript.scriptContent || '';
            
            // 🔥 NEW: Show streaming content even if partial/placeholder during streaming
            if (isStreaming) {
                // During streaming, show whatever content we have, even if it's partial
                console.log('[ScriptDisplayPage] Streaming mode - showing partial content');
                if (scriptContent && scriptContent.length > 0) {
                    // Show the partial scriptContent as-is during streaming
                    return scriptContent;
                }
                // If no scriptContent yet, try scenes fallback
                scriptContent = convertScenesToText(latestScript.scenes || []);
                if (scriptContent && scriptContent.length > 0) {
                    return scriptContent;
                }
                // Show loading message if no content yet
                return '剧本生成中...';
            } else {
                // 🔥 FALLBACK: Only after streaming is complete, convert from scenes if needed
                if (!scriptContent || scriptContent.length < 10 || 
                    scriptContent.includes('完整剧本文本') || scriptContent.includes('剧本内容')) {
                    console.log('[ScriptDisplayPage] scriptContent is placeholder, converting from scenes');
                    scriptContent = convertScenesToText(latestScript.scenes || []);
                }
            }
            
            console.log('[ScriptDisplayPage] Using streaming content:', {
                contentLength: scriptContent.length,
                contentPreview: scriptContent.substring(0, 100) || 'no content',
                isStreaming,
                usedFallback: !isStreaming && scriptContent !== latestScript.scriptContent
            });
            return scriptContent;
        }
        
        // Otherwise use loaded script data
        let loadedContent = scriptData?.scriptContent || '';
        
        // 🔥 FALLBACK: If loaded scriptContent is empty or placeholder, convert from scenes
        if (scriptData && (!loadedContent || loadedContent.length < 10 || 
            loadedContent.includes('完整剧本文本') || loadedContent.includes('剧本内容'))) {
            console.log('[ScriptDisplayPage] Loaded scriptContent is placeholder, converting from scenes');
            loadedContent = convertScenesToText(scriptData.scenes || []);
        }
        
        console.log('[ScriptDisplayPage] Using loaded content:', {
            contentLength: loadedContent.length,
            contentPreview: loadedContent.substring(0, 100) || 'no content'
        });
        return loadedContent;
    }, [streamingItems, scriptData, isStreaming]);

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

    const loadScript = async () => {
        if (!episodeId || !stageId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/scripts/${episodeId}/${stageId}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Script not found, check if generation is in progress
                    setError('剧本生成中，请稍候...');
                    // Poll for completion
                    setTimeout(loadScript, 3000);
                    return;
                }
                throw new Error('加载剧本失败');
            }

            const script = await response.json();
            setScriptData(script);
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
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
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
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
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
        </div>
    );
};