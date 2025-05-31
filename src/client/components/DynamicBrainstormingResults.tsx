import React from 'react';
import { Button, Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { DynamicStreamingUI, brainstormFieldRegistry, IdeaCard } from './shared/streaming';
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

    // Handle field edit (for ideas, this would allow editing idea content)
    const handleFieldEdit = (path: string, value: any) => {
        console.log('Field edit requested:', path, value);
        // This could be implemented to allow editing ideas
        // For now, we'll just log it
    };

    // Handle idea selection
    const handleIdeaClick = React.useCallback((idea: IdeaWithTitle, index: number) => {
        const ideaText = `${idea.title}: ${idea.body}`;
        onIdeaSelect(ideaText);
    }, [onIdeaSelect]);

    // Create enhanced registry with selection handlers
    const enhancedRegistry = React.useMemo(() => {
        return brainstormFieldRegistry.map(def => {
            if (def.path === '[*]') {
                // Add selection handler to idea cards
                return {
                    ...def,
                    component: ({ value, isPartial, ...props }: any) => {
                        const ideaIndex = ideas.findIndex(idea => 
                            idea.title === value?.title && idea.body === value?.body
                        );
                        const isSelected = selectedIdeaIndex === ideaIndex;
                        
                        return (
                            <IdeaCard
                                value={value}
                                isPartial={isPartial}
                                isSelected={isSelected}
                                onSelect={() => handleIdeaClick(value, ideaIndex)}
                                {...props}
                            />
                        );
                    }
                };
            }
            return def;
        });
    }, [ideas, selectedIdeaIndex, handleIdeaClick]);

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

            {/* Dynamic streaming UI */}
            <DynamicStreamingUI
                fieldRegistry={enhancedRegistry}
                streamingData={ideas.length > 0 ? [ideas] : []}
                streamingStatus={streamingStatus}
                onStopStreaming={onStop}
                onFieldEdit={handleFieldEdit}
                className="brainstorming-results"
            />

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