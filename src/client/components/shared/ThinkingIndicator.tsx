import React, { useEffect, useState, useRef } from 'react';
import { Progress, Space, Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ThinkingIndicatorProps {
    isThinking: boolean;
    className?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
    isThinking,
    className = ''
}) => {
    const [progress, setProgress] = useState(0);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);

    useEffect(() => {
        if (isThinking) {
            // Reset and start progress
            setProgress(0);
            startTimeRef.current = Date.now();
            
            const updateProgress = () => {
                const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
                
                // Asymptotic function: approaches 95% but never reaches it
                // Formula: 95 * (1 - e^(-t/30)) 
                // This reaches ~63% in 30 seconds, ~86% in 60 seconds, ~95% in 90 seconds
                const targetProgress = 95 * (1 - Math.exp(-elapsedSeconds / 30));
                
                setProgress(Math.min(targetProgress, 94)); // Cap at 94% to never reach the target
                
                if (isThinking) {
                    animationFrameRef.current = requestAnimationFrame(updateProgress);
                }
            };
            
            updateProgress();
        } else {
            // Cancel animation when thinking stops
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            setProgress(0);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isThinking]);

    if (!isThinking) {
        return null;
    }

    return (
        <div className={className} style={{ 
            padding: '16px 24px', 
            background: '#1f1f1f', 
            borderRadius: '6px',
            border: '1px solid #333'
        }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space align="center">
                    <BulbOutlined 
                        style={{ 
                            color: '#1890ff', 
                            fontSize: '16px',
                            animation: 'pulse 2s infinite'
                        }} 
                    />
                    <Text style={{ color: '#d9d9d9', fontSize: '14px' }}>
                        深度构思中...
                    </Text>
                </Space>
                
                <Progress
                    percent={Math.round(progress)}
                    strokeColor={{
                        '0%': '#108ee9',
                        '100%': '#87d068',
                    }}
                    trailColor="#262626"
                    showInfo={false}
                    size="small"
                    style={{ margin: 0 }}
                />
            </Space>
            
            <style jsx>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}; 