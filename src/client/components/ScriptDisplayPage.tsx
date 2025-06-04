import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, message, Spin, Breadcrumb, Space, Button } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons';
import { createEditor, Descendant } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import type { EpisodeScriptV1 } from '../../common/streaming/types';

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

    const [scriptData, setScriptData] = useState<EpisodeScriptV1 | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create a read-only Slate editor
    const editor = useMemo(() => withReact(createEditor()), []);

    useEffect(() => {
        loadScript();
    }, [episodeId, stageId]);

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
        if (!scriptData?.scriptContent) {
            return [
                {
                    type: 'paragraph',
                    children: [{ text: '剧本生成中...' }]
                }
            ] as Descendant[];
        }

        // Parse script content into structured format
        const lines = scriptData.scriptContent.split('\n');
        const nodes: Descendant[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                // Check if it's a character name (ALL CAPS followed by colon)
                if (/^[A-Z\u4e00-\u9fff\s]+:/.test(trimmedLine)) {
                    nodes.push({
                        type: 'character',
                        children: [{ text: trimmedLine }]
                    } as Descendant);
                }
                // Check if it's a scene heading (starts with common scene indicators)
                else if (/(场景|镜头|外景|内景|INT\.|EXT\.)/.test(trimmedLine)) {
                    nodes.push({
                        type: 'scene-heading',
                        children: [{ text: trimmedLine }]
                    } as Descendant);
                }
                // Check if it's an action line (parenthetical or action description)
                else if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
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

        return nodes.length > 0 ? nodes : [
            {
                type: 'paragraph',
                children: [{ text: '暂无内容' }]
            }
        ] as Descendant[];
    }, [scriptData?.scriptContent]);

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

    if (loading) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a'
            }}>
                <Space direction="vertical" align="center" size="large">
                    <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48, color: '#1890ff' }} />} />
                    <Text style={{ color: '#fff', fontSize: '16px' }}>
                        {error || '加载剧本中...'}
                    </Text>
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