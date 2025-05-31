import React from 'react';
import { Button, Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { IdeaCard } from './shared/streaming';
import { IdeaWithTitle } from '../services/implementations/BrainstormingStreamingService';

const { Text } = Typography;

interface DynamicBrainstormingResultsProps {
    ideas: IdeaWithTitle[];
    onIdeaSelect: (idea: string) => void;
    isStreaming?: boolean;
    isConnecting?: boolean;
    onStop?: () => void;
    onRegenerate?: () => void;
    error?: Error | null;
    selectedIdeaIndex?: number | null;
    canRegenerate?: boolean;
}

export const DynamicBrainstormingResults: React.FC<DynamicBrainstormingResultsProps> = ({
    ideas,
    onIdeaSelect,
    isStreaming = false,
    isConnecting = false,
    onStop,
    onRegenerate,
    error,
    selectedIdeaIndex = null,
    canRegenerate = true
}) => {
    // Determine streaming status
    const streamingStatus = isConnecting ? 'idle' : isStreaming ? 'streaming' : 'completed';

    // Handle idea selection
    const handleIdeaClick = React.useCallback((idea: IdeaWithTitle, index: number) => {
        const ideaText = `${idea.title}: ${idea.body}`;
        onIdeaSelect(ideaText);
    }, [onIdeaSelect]);

    return (
        <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #303030',
            marginBottom: '24px'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                    💡 故事灵感
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>
                    {isConnecting ? '连接中...' : isStreaming ? '正在生成中...' : '选择一个灵感继续'}
                </Text>
            </div>

            {/* Error display */}
            {error && (
                <div style={{ 
                    padding: '12px', 
                    marginBottom: '16px',
                    backgroundColor: '#2d1b1b',
                    border: '1px solid #d32f2f',
                    borderRadius: '6px',
                    color: '#fff'
                }}>
                    <Text style={{ color: '#ff6b6b' }}>生成失败: {error.message}</Text>
                </div>
            )}

            {/* Ideas Display */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '12px',
                overflowY: 'auto'
            }}>
                {ideas.map((idea, index) => (
                    <IdeaCard
                        key={`${idea.title}-${idea.body?.substring(0, 20)}-${index}`}
                        value={idea}
                        path={`[${index}]`}
                        isSelected={selectedIdeaIndex === index}
                        onSelect={() => handleIdeaClick(idea, index)}
                    />
                ))}
                
                {/* Show streaming indicator */}
                {isStreaming && (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#666',
                        gridColumn: '1 / -1'
                    }}>
                        <div style={{ animation: 'pulse 1.5s infinite' }}>
                            正在生成更多灵感...
                        </div>
                    </div>
                )}
            </div>

            {/* Regenerate button */}
            {canRegenerate && ideas.length > 0 && !isStreaming && !isConnecting && onRegenerate && (
                <Button
                    type="default"
                    icon={<BulbOutlined />}
                    onClick={onRegenerate}
                    style={{
                        width: '100%',
                        height: '40px',
                        background: '#434343',
                        borderColor: '#434343',
                        color: '#d9d9d9',
                        marginTop: '16px'
                    }}
                >
                    重新生成
                </Button>
            )}
        </div>
    );
};

export default DynamicBrainstormingResults; 