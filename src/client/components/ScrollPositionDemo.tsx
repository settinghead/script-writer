import React, { useRef } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { useScrollPosition } from '../hooks/useScrollPosition';

const { Title, Text } = Typography;

/**
 * Demo component showing scroll position preservation functionality
 */
export const ScrollPositionDemo: React.FC = () => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const { triggerRestore, clearSavedPosition, saveScrollPosition } = useScrollPosition(
        scrollContainerRef,
        {
            key: 'scroll-demo',
            debug: true, // Enable debug logging
            restoreDelay: 200,
            maxRetries: 10,
            retryInterval: 300
        }
    );

    const scrollToPosition = (position: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = position;
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
                <Title level={4} style={{ color: '#fff', margin: 0 }}>
                    滚动位置保存演示
                </Title>
                <Space style={{ marginTop: '12px' }}>
                    <Button onClick={() => scrollToPosition(0)} size="small">
                        滚动到顶部
                    </Button>
                    <Button onClick={() => scrollToPosition(500)} size="small">
                        滚动到中间
                    </Button>
                    <Button onClick={() => scrollToPosition(1000)} size="small">
                        滚动到底部
                    </Button>
                    <Button onClick={triggerRestore} type="primary" size="small">
                        恢复滚动位置
                    </Button>
                    <Button onClick={saveScrollPosition} size="small">
                        手动保存位置
                    </Button>
                    <Button onClick={clearSavedPosition} danger size="small">
                        清除保存的位置
                    </Button>
                </Space>
                <div style={{ marginTop: '8px' }}>
                    <Text style={{ color: '#666', fontSize: '12px' }}>
                        滚动内容后刷新页面，位置会自动恢复。查看控制台以查看调试信息。
                    </Text>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '16px',
                    backgroundColor: '#1a1a1a'
                }}
            >
                {/* Generate a lot of content to make it scrollable */}
                {Array.from({ length: 50 }, (_, index) => (
                    <Card
                        key={index}
                        size="small"
                        style={{
                            marginBottom: '16px',
                            backgroundColor: '#262626',
                            border: '1px solid #434343'
                        }}
                        styles={{ body: { padding: '16px' } }}
                    >
                        <Title level={5} style={{ color: '#fff', margin: '0 0 8px 0' }}>
                            内容块 #{index + 1}
                        </Title>
                        <Text style={{ color: '#ccc' }}>
                            这是一个演示滚动位置保存功能的内容块。滚动页面后刷新浏览器，
                            滚动位置会自动恢复到之前的位置。这对于长内容页面非常有用，
                            特别是当内容是异步加载的时候。
                        </Text>
                        <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: '#666', fontSize: '12px' }}>
                                滚动位置: {index * 100}px
                            </Text>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}; 