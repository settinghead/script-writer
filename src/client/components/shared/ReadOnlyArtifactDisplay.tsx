import React, { useMemo } from 'react';
import { Typography, Space, Card, Tag } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, ThunderboltOutlined, BulbOutlined } from '@ant-design/icons';
import { ReadOnlyEmotionArcs, ReadOnlyRelationshipDevelopments, ReadOnlyInsights } from './YJSComplexFields';

const { Text } = Typography;

interface ReadOnlyArtifactDisplayProps {
    data: any;
    schemaType: string;
}

/**
 * Generic component to display artifact data in read-only mode
 * Renders data as static text instead of editable fields
 */
export const ReadOnlyArtifactDisplay: React.FC<ReadOnlyArtifactDisplayProps> = ({ data, schemaType }) => {
    const parsedData = useMemo(() => {
        if (!data) return {};

        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch (error) {
            console.warn('Failed to parse artifact data:', error);
            return {};
        }
    }, [data]);

    // Helper function to render array fields as tags or text
    const renderArrayField = (items: any[], emptyText: string = '暂无') => {
        if (!Array.isArray(items) || items.length === 0) {
            return <Text style={{ color: '#666', fontStyle: 'italic' }}>{emptyText}</Text>;
        }

        return (
            <Space wrap>
                {items.map((item, index) => (
                    <Tag key={index} style={{ margin: '2px' }}>
                        {typeof item === 'string' ? item : JSON.stringify(item)}
                    </Tag>
                ))}
            </Space>
        );
    };

    // Helper function to render text field
    const renderTextField = (value: any, emptyText: string = '暂无') => {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            return <Text style={{ color: '#666', fontStyle: 'italic' }}>{emptyText}</Text>;
        }
        return <Text style={{ color: '#fff' }}>{String(value)}</Text>;
    };

    // Helper function to render multiline text
    const renderMultilineText = (value: any, emptyText: string = '暂无') => {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            return <Text style={{ color: '#666', fontStyle: 'italic' }}>{emptyText}</Text>;
        }
        return (
            <Text style={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                {String(value)}
            </Text>
        );
    };

    // Render chronicle stage specific layout
    if (schemaType === 'chronicle_stage_schema') {
        return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Stage Title */}
                <div>
                    {renderTextField(parsedData.title, '未设置阶段标题')}
                </div>

                {/* Stage Synopsis */}
                <div>
                    {renderMultilineText(parsedData.stageSynopsis, '未设置阶段概述')}
                </div>

                {/* Core Event */}
                <div>
                    <Space align="center" style={{ marginBottom: '8px' }}>
                        <ThunderboltOutlined style={{ color: '#faad14' }} />
                        <Text strong style={{ color: '#faad14' }}>核心事件</Text>
                    </Space>
                    <div style={{ paddingLeft: '20px' }}>
                        {renderMultilineText(parsedData.event, '未设置核心事件')}
                    </div>
                </div>

                {/* Emotion Arcs */}
                <div>
                    <Space align="center" style={{ marginBottom: '8px' }}>
                        <HeartOutlined style={{ color: '#f759ab' }} />
                        <Text strong style={{ color: '#f759ab' }}>情感发展</Text>
                    </Space>
                    <ReadOnlyEmotionArcs emotionArcs={parsedData.emotionArcs || []} />
                </div>

                {/* Relationship Developments */}
                <div>
                    <Space align="center" style={{ marginBottom: '8px' }}>
                        <TeamOutlined style={{ color: '#52c41a' }} />
                        <Text strong style={{ color: '#52c41a' }}>关系发展</Text>
                    </Space>
                    <ReadOnlyRelationshipDevelopments relationshipDevelopments={parsedData.relationshipDevelopments || []} />
                </div>

                {/* Key Insights */}
                <div>
                    <Space align="center" style={{ marginBottom: '8px' }}>
                        <BulbOutlined style={{ color: '#fadb14' }} />
                        <Text strong style={{ color: '#fadb14' }}>关键洞察</Text>
                    </Space>
                    <ReadOnlyInsights insights={parsedData.insights || []} />
                </div>
            </Space>
        );
    }

    // Render outline settings specific layout
    if (schemaType === 'outline_settings_schema') {
        return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Basic Information */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        📊 基本信息
                    </Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                剧本标题：
                            </Text>
                            {renderTextField(parsedData.title, '未设置标题')}
                        </div>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                剧本类型：
                            </Text>
                            {renderTextField(parsedData.genre, '未设置类型')}
                        </div>
                    </div>
                </div>

                {/* Target Audience */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <UserOutlined style={{ marginRight: '8px' }} />
                        目标观众
                    </Text>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                            目标群体：
                        </Text>
                        {renderTextField(parsedData.target_audience?.demographic, '未设置目标群体')}
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                            核心主题：
                        </Text>
                        {renderArrayField(parsedData.target_audience?.core_themes, '未设置核心主题')}
                    </div>
                </div>

                {/* Selling Points */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <HeartOutlined style={{ marginRight: '8px' }} />
                        卖点
                    </Text>
                    {renderArrayField(parsedData.selling_points, '未设置卖点')}
                </div>

                {/* Satisfaction Points */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <StarOutlined style={{ marginRight: '8px' }} />
                        爽点
                    </Text>
                    {renderArrayField(parsedData.satisfaction_points, '未设置爽点')}
                </div>

                {/* Setting */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <EnvironmentOutlined style={{ marginRight: '8px' }} />
                        故事设定
                    </Text>
                    <div style={{ marginBottom: '12px' }}>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                            核心设定：
                        </Text>
                        {renderMultilineText(parsedData.setting?.core_setting_summary, '未设置核心设定')}
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                            关键场景：
                        </Text>
                        {renderArrayField(parsedData.setting?.key_scenes, '未设置关键场景')}
                    </div>
                </div>

                {/* Characters */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <TeamOutlined style={{ marginRight: '8px' }} />
                        角色设定
                    </Text>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {Array.isArray(parsedData.characters) && parsedData.characters.length > 0 ? (
                            parsedData.characters.map((character: any, index: number) => (
                                <Card
                                    key={index}
                                    size="small"
                                    style={{
                                        backgroundColor: '#262626',
                                        border: '1px solid #434343'
                                    }}
                                    styles={{ body: { padding: '16px' } }}
                                >
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                姓名：
                                            </Text>
                                            {renderTextField(character.name, '未设置姓名')}
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                类型：
                                            </Text>
                                            {renderTextField(character.type, '未设置类型')}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                基本信息：
                                            </Text>
                                            <div>
                                                <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>
                                                    年龄：
                                                </Text>
                                                {renderTextField(character.age, '未设置')}
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>
                                                    性别：
                                                </Text>
                                                {renderTextField(character.gender, '未设置')}
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>
                                                    职业：
                                                </Text>
                                                {renderTextField(character.occupation, '未设置')}
                                            </div>
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                角色描述：
                                            </Text>
                                            {renderMultilineText(character.description, '未设置角色描述')}
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                性格特点：
                                            </Text>
                                            {renderArrayField(character.personality_traits, '未设置性格特点')}
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                成长轨迹：
                                            </Text>
                                            {renderMultilineText(character.character_arc, '未设置成长轨迹')}
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>
                                                关键场景：
                                            </Text>
                                            {renderArrayField(character.key_scenes, '未设置关键场景')}
                                        </div>
                                    </Space>
                                </Card>
                            ))
                        ) : (
                            <Card
                                size="small"
                                style={{
                                    backgroundColor: '#1a1a1a',
                                    border: '1px dashed #434343',
                                    textAlign: 'center'
                                }}
                                styles={{ body: { padding: '24px' } }}
                            >
                                <Text style={{ color: '#666', fontSize: '14px' }}>
                                    暂无角色设定
                                </Text>
                            </Card>
                        )}
                    </Space>
                </div>
            </Space>
        );
    }

    // Generic fallback for other schema types
    return (
        <div style={{ padding: '16px' }}>
            <Text style={{ color: '#666', fontStyle: 'italic' }}>
                暂不支持 {schemaType} 类型的只读显示
            </Text>
            <pre style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                {JSON.stringify(parsedData, null, 2)}
            </pre>
        </div>
    );
}; 