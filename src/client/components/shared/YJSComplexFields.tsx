import React from 'react';
import { Typography } from 'antd';
import { YJSTextField, YJSTextAreaField, YJSArrayField, YJSEmotionArcsArray, YJSRelationshipDevelopmentsArray } from '../../transform-artifact-framework/components/YJSField';

const { Title, Text } = Typography;

export const YJSComplexFields = React.memo(() => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Basic Fields */}
            <div>
                <Title level={4}>基本信息</Title>
                <div style={{ marginBottom: 16 }}>
                    <Text strong>标题：</Text>
                    <YJSTextField path="title" placeholder="输入标题" />
                </div>
                <div style={{ marginBottom: 16 }}>
                    <Text strong>描述：</Text>
                    <YJSTextAreaField path="description" placeholder="输入描述" rows={3} />
                </div>
            </div>

            {/* Core Themes */}
            <div>
                <Title level={4}>核心主题</Title>
                <YJSArrayField path="coreThemes" placeholder="添加核心主题" itemPlaceholder="输入主题" />
            </div>

            {/* Emotion Arcs */}
            <div>
                <Title level={4}>情感发展</Title>
                <YJSEmotionArcsArray path="emotionArcs" />
            </div>

            {/* Relationship Developments */}
            <div>
                <Title level={4}>关系发展</Title>
                <YJSRelationshipDevelopmentsArray path="relationshipDevelopments" />
            </div>

            {/* Insights */}
            <div>
                <Title level={4}>洞察要点</Title>
                <YJSArrayField path="insights" placeholder="添加洞察要点" itemPlaceholder="输入洞察" />
            </div>
        </div>
    );
});

YJSComplexFields.displayName = 'YJSComplexFields';

// Read-only display components for backward compatibility
export const ReadOnlyEmotionArcs = React.memo(({ emotionArcs }: { emotionArcs: any[] }) => {
    if (!emotionArcs || emotionArcs.length === 0) {
        return <div style={{ color: '#999', fontStyle: 'italic' }}>暂无情感发展</div>;
    }

    return (
        <div>
            {emotionArcs.map((arc, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                    <Text strong>{arc.characters?.join(', ')}: </Text>
                    <Text>{arc.description || arc.development || arc.content}</Text>
                </div>
            ))}
        </div>
    );
});

export const ReadOnlyRelationshipDevelopments = React.memo(({ relationshipDevelopments }: { relationshipDevelopments: any[] }) => {
    if (!relationshipDevelopments || relationshipDevelopments.length === 0) {
        return <div style={{ color: '#999', fontStyle: 'italic' }}>暂无关系发展</div>;
    }

    return (
        <div>
            {relationshipDevelopments.map((rel, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                    <Text strong>{rel.characters?.join(', ')}: </Text>
                    <Text>{rel.development || rel.content}</Text>
                </div>
            ))}
        </div>
    );
});

export const ReadOnlyInsights = React.memo(({ insights }: { insights: string[] }) => {
    if (!insights || insights.length === 0) {
        return <div style={{ color: '#999', fontStyle: 'italic' }}>暂无关键洞察</div>;
    }

    return (
        <div>
            {insights.map((insight, index) => (
                <div key={index} style={{ marginBottom: 4 }}>
                    <Text>• {insight}</Text>
                </div>
            ))}
        </div>
    );
});

ReadOnlyEmotionArcs.displayName = 'ReadOnlyEmotionArcs';
ReadOnlyRelationshipDevelopments.displayName = 'ReadOnlyRelationshipDevelopments';
ReadOnlyInsights.displayName = 'ReadOnlyInsights'; 