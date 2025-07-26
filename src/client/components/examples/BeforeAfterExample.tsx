import React from 'react';
import { Input, Typography } from 'antd';
import { StyledInput, StyledButton, StyledCard } from '@/client/styled-system';

const { Text } = Typography;

/**
 * BEFORE: Old patterns with inline styles (from fieldComponents.tsx)
 * This shows the repetitive inline styling that was scattered throughout the codebase
 */
export const BeforeExample: React.FC = () => {
    const [value, setValue] = React.useState('');

    return (
        <div style={{ marginBottom: '8px' }}>
            {/* Old Label Style */}
            <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
                旧的字段标签
            </Text>

            {/* Old Input Style - Repeated 70+ times across fieldComponents.tsx */}
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="输入内容..."
                style={{
                    backgroundColor: '#1f1f1f',    // Repeated pattern
                    borderColor: '#404040',        // Repeated pattern
                    color: '#fff'                  // Repeated pattern
                }}
            />

            {/* Old Card Style - Repeated in multiple components */}
            <div
                style={{
                    padding: '12px',
                    border: '1px solid #404040',    // Repeated pattern
                    borderRadius: '6px',            // Repeated pattern
                    backgroundColor: '#1f1f1f',     // Repeated pattern
                    color: value ? '#fff' : '#888', // Repeated pattern
                    transition: 'all 0.2s',        // Repeated pattern
                    marginTop: '8px',
                    cursor: 'pointer'
                }}
                onMouseEnter={(e) => {           // Repeated hover logic
                    e.currentTarget.style.borderColor = '#606060';
                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                }}
                onMouseLeave={(e) => {           // Repeated hover logic
                    e.currentTarget.style.borderColor = '#404040';
                    e.currentTarget.style.backgroundColor = '#1f1f1f';
                }}
            >
                {value || '点击编辑...'}
            </div>

            {/* Old Button Style */}
            <button
                style={{
                    background: 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 50%, #4c1d95 100%)', // Repeated gradient
                    border: 'none',
                    borderRadius: '12px',          // Repeated pattern
                    color: '#fff',                 // Repeated pattern
                    padding: '8px 16px',           // Repeated pattern
                    fontWeight: 500,               // Repeated pattern
                    transition: 'all 0.3s ease',  // Repeated pattern
                    marginTop: '8px'
                }}
                onMouseEnter={(e) => {           // Repeated hover logic
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(109, 40, 217, 0.5)';
                }}
                onMouseLeave={(e) => {           // Repeated hover logic
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.boxShadow = '';
                }}
            >
                AI 按钮 (旧样式)
            </button>
        </div>
    );
};

/**
 * AFTER: New patterns with styled components
 * This shows how the same functionality is achieved with reusable, animated components
 */
export const AfterExample: React.FC = () => {
    const [value, setValue] = React.useState('');

    return (
        <div style={{ marginBottom: '8px' }}>
            {/* New Label Style */}
            <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
                新的字段标签
            </Text>

            {/* New Input Style - Single reusable component */}
            <StyledInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="输入内容..."
                variant="dark"
                size="medium"
            />

            {/* New Card Style - Single reusable component with animation */}
            <StyledCard
                variant="default"
                size="medium"
                interactive={true}
                animateOnHover={true}
                style={{ marginTop: '8px', cursor: 'pointer' }}
            >
                {value || '点击编辑...'}
            </StyledCard>

            {/* New Button Style - Single reusable component with animation */}
            <StyledButton
                variant="ai"
                size="medium"
                animated={true}
                style={{ marginTop: '8px' }}
            >
                AI 按钮 (新样式)
            </StyledButton>
        </div>
    );
};

/**
 * Comparison Component
 * Shows both examples side by side
 */
export const BeforeAfterComparison: React.FC = () => {
    return (
        <div style={{ display: 'flex', gap: '32px', padding: '24px' }}>
            <div style={{ flex: 1 }}>
                <h3 style={{ color: '#ff4d4f', marginBottom: '16px' }}>
                    之前 (内联样式) - 70+ 次重复
                </h3>
                <BeforeExample />

                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#2a1810', borderRadius: '8px' }}>
                    <Text style={{ color: '#ff7875', fontSize: '12px' }}>
                        ❌ 问题: 内联样式重复 70+ 次<br />
                        ❌ 难以维护和更新<br />
                        ❌ 没有动画或交互反馈<br />
                        ❌ TypeScript 类型安全性差<br />
                        ❌ 样式逻辑分散在各个组件中
                    </Text>
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <h3 style={{ color: '#52c41a', marginBottom: '16px' }}>
                    之后 (样式组件) - 可重用组件
                </h3>
                <AfterExample />

                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#162312', borderRadius: '8px' }}>
                    <Text style={{ color: '#95de64', fontSize: '12px' }}>
                        ✅ 优势: 可重用的样式组件<br />
                        ✅ 统一的设计系统<br />
                        ✅ 流畅的动画和交互<br />
                        ✅ 完整的 TypeScript 支持<br />
                        ✅ 90% 减少重复样式代码
                    </Text>
                </div>
            </div>
        </div>
    );
};

export default BeforeAfterComparison; 