import React, { useState, useEffect } from 'react';
import { Typography, Button, Spin, Alert, Progress } from 'antd';
import { StopOutlined, BulbOutlined } from '@ant-design/icons';
import { ThinkingIndicator } from './shared/ThinkingIndicator';
import { IdeaWithTitle } from '../services/implementations/BrainstormingStreamingService';

const { Text } = Typography;

interface BrainstormingResultsProps {
    ideas: IdeaWithTitle[];
    onIdeaSelect: (idea: string) => void;
    isStreaming?: boolean;
    isConnecting?: boolean;
    isThinking?: boolean;
    onStop?: () => void;
    onRegenerate?: () => void;
    error?: Error | null;
    selectedIdeaIndex?: number | null;
    canRegenerate?: boolean;
}

const BrainstormingResults: React.FC<BrainstormingResultsProps> = ({
    ideas,
    onIdeaSelect,
    isStreaming = false,
    isConnecting = false,
    isThinking = false,
    onStop,
    onRegenerate,
    error,
    selectedIdeaIndex = null,
    canRegenerate = true
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isSelectingIdea, setIsSelectingIdea] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleIdeaSelection = (index: number) => {
        if (isSelectingIdea) return;

        setIsSelectingIdea(true);
        const idea = ideas[index];
        const ideaText = `${idea.title}: ${idea.body}`;

        // Add a small delay to allow the selection animation to be visible
        setTimeout(() => {
            onIdeaSelect(ideaText);
            setIsSelectingIdea(false);
        }, 300);
    };

    return (
        <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #303030',
            marginBottom: '24px'
        }}>
            <style>
                {`
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes selectPulse {
                    0% { transform: scale(1.02); box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2); }
                    50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(24, 144, 255, 0.4); }
                    100% { transform: scale(1.02); box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2); }
                }
                `}
            </style>

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
                <Alert
                    message="生成失败"
                    description={error.message}
                    type="error"
                    style={{ marginBottom: '16px' }}
                />
            )}

            {/* Thinking indicator */}
            {isThinking && (
                <ThinkingIndicator
                    isThinking={isThinking}
                    className="mb-4"
                />
            )}

            {/* Streaming progress for non-thinking mode */}
            {!isThinking && (isStreaming || isConnecting) && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <Text style={{ color: '#1890ff' }}>
                            {isConnecting ? '连接到正在进行的任务...' : '正在生成故事灵感...'}
                        </Text>
                        {onStop && (
                            <Button
                                size="small"
                                icon={<StopOutlined />}
                                onClick={onStop}
                                style={{
                                    background: '#ff4d4f',
                                    borderColor: '#ff4d4f',
                                    color: 'white'
                                }}
                            >
                                停止
                            </Button>
                        )}
                    </div>
                    <Progress percent={30} showInfo={false} strokeColor="#1890ff" />
                </div>
            )}

            {/* Display ideas */}
            {ideas.length > 0 && (
                <div style={{
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px'
                }}>
                    {ideas.map((idea, index) => (
                        <div
                            key={index}
                            onClick={() => handleIdeaSelection(index)}
                            style={{
                                padding: '12px',
                                background: selectedIdeaIndex === index ? '#1890ff20' : '#262626',
                                border: selectedIdeaIndex === index ? '1px solid #1890ff' : '1px solid #404040',
                                borderRadius: '6px',
                                cursor: isSelectingIdea ? 'wait' : 'pointer',
                                transition: 'all 0.3s ease-in-out',
                                animation: `fadeIn 0.5s ease-in${selectedIdeaIndex === index && isSelectingIdea ? ', selectPulse 0.6s ease-in-out' : ''}`,
                                minHeight: '80px',
                                display: 'flex',
                                flexDirection: 'column',
                                transform: selectedIdeaIndex === index ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: selectedIdeaIndex === index ? '0 4px 12px rgba(24, 144, 255, 0.2)' : 'none',
                                pointerEvents: isSelectingIdea ? 'none' : 'auto',
                                opacity: isSelectingIdea && selectedIdeaIndex !== index ? 0.5 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (selectedIdeaIndex !== index && !isSelectingIdea) {
                                    e.currentTarget.style.background = '#333333';
                                    e.currentTarget.style.transform = 'scale(1.01)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedIdeaIndex !== index && !isSelectingIdea) {
                                    e.currentTarget.style.background = '#262626';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }
                            }}
                        >
                            <Text strong style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px' }}>
                                {idea.title}
                            </Text>
                            <Text style={{ color: '#bfbfbf', fontSize: '13px', lineHeight: '1.4', flex: 1 }}>
                                {idea.body}
                            </Text>
                        </div>
                    ))}

                    {/* Show blinking cursor while streaming */}
                    {isStreaming && (
                        <div style={{
                            padding: '8px',
                            color: '#666',
                            fontSize: '14px',
                            gridColumn: '1 / -1',
                            textAlign: 'center'
                        }}>
                            <span style={{ animation: 'blink 1s infinite' }}>▋</span>
                        </div>
                    )}
                </div>
            )}

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
                        color: '#d9d9d9'
                    }}
                >
                    重新生成
                </Button>
            )}
        </div>
    );
};

export default BrainstormingResults; 