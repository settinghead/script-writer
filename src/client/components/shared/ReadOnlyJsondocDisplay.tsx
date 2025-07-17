import React, { useMemo } from 'react';
import { Typography, Space, Card, Tag } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined, ThunderboltOutlined, BulbOutlined } from '@ant-design/icons';
import { TypedJsondoc } from '@/common/types';

const { Text } = Typography;

interface ReadOnlyJsondocDisplayProps {
    data: any;
    schemaType: TypedJsondoc['schema_type'];
}

/**
 * Generic component to display jsondoc data in read-only mode
 * Renders data as static text instead of editable fields
 */
export const ReadOnlyJsondocDisplay: React.FC<ReadOnlyJsondocDisplayProps> = ({ data, schemaType }) => {
    const parsedData = useMemo(() => {
        if (!data) return {};

        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch (error) {
            console.warn('Failed to parse jsondoc data:', error);
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



    // Render chronicles specific layout
    if (schemaType === 'chronicles') {
        return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {Array.isArray(parsedData.stages) && parsedData.stages.length > 0 ? (
                    parsedData.stages.map((stage: any, index: number) => (
                        <Card
                            key={index}
                            size="small"
                            style={{
                                backgroundColor: '#262626',
                                border: '1px solid #434343'
                            }}
                            styles={{ body: { padding: '20px' } }}
                            title={
                                <Text strong style={{ fontSize: '16px', color: '#fff' }}>
                                    第 {index + 1} 阶段：{stage.title || '未命名阶段'}
                                </Text>
                            }
                        >
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                {/* Stage Synopsis */}
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        📝 阶段概述
                                    </Text>
                                    {renderMultilineText(stage.stageSynopsis, '未设置阶段概述')}
                                </div>

                                {/* Event */}
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        🎬 关键事件
                                    </Text>
                                    {renderMultilineText(stage.event, '未设置关键事件')}
                                </div>

                                {/* Emotion Arcs */}
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        💭 情感弧线
                                    </Text>
                                    {Array.isArray(stage.emotionArcs) && stage.emotionArcs.length > 0 ? (
                                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                            {stage.emotionArcs.map((arc: any, arcIndex: number) => (
                                                <Card
                                                    key={arcIndex}
                                                    size="small"
                                                    style={{
                                                        backgroundColor: '#1a1a1a',
                                                        border: '1px solid #333'
                                                    }}
                                                    styles={{ body: { padding: '12px' } }}
                                                >
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <Text strong style={{ fontSize: '12px', color: '#aaa' }}>
                                                            涉及角色：
                                                        </Text>
                                                        <div style={{ marginTop: '4px' }}>
                                                            {renderArrayField(arc.characters, '无角色')}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Text strong style={{ fontSize: '12px', color: '#aaa' }}>
                                                            情感内容：
                                                        </Text>
                                                        <div style={{ marginTop: '4px' }}>
                                                            {renderMultilineText(arc.content, '未设置内容')}
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </Space>
                                    ) : (
                                        <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无情感弧线</Text>
                                    )}
                                </div>

                                {/* Relationship Developments */}
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        💕 关系发展
                                    </Text>
                                    {Array.isArray(stage.relationshipDevelopments) && stage.relationshipDevelopments.length > 0 ? (
                                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                            {stage.relationshipDevelopments.map((rel: any, relIndex: number) => (
                                                <Card
                                                    key={relIndex}
                                                    size="small"
                                                    style={{
                                                        backgroundColor: '#1a1a1a',
                                                        border: '1px solid #333'
                                                    }}
                                                    styles={{ body: { padding: '12px' } }}
                                                >
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <Text strong style={{ fontSize: '12px', color: '#aaa' }}>
                                                            涉及角色：
                                                        </Text>
                                                        <div style={{ marginTop: '4px' }}>
                                                            {renderArrayField(rel.characters, '无角色')}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Text strong style={{ fontSize: '12px', color: '#aaa' }}>
                                                            关系内容：
                                                        </Text>
                                                        <div style={{ marginTop: '4px' }}>
                                                            {renderMultilineText(rel.content, '未设置内容')}
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </Space>
                                    ) : (
                                        <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无关系发展</Text>
                                    )}
                                </div>

                                {/* Insights */}
                                <div>
                                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                        <BulbOutlined style={{ marginRight: '8px' }} />
                                        关键洞察
                                    </Text>
                                    {renderArrayField(stage.insights, '暂无关键洞察')}
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
                        styles={{ body: { padding: '40px' } }}
                    >
                        <Text style={{ color: '#666', fontSize: '16px' }}>
                            暂无时间顺序大纲内容
                        </Text>
                    </Card>
                )}
            </Space>
        );
    }

    // Render brainstorm idea specific layout
    if (schemaType === 'brainstorm_idea') {
        return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Title */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        <BulbOutlined style={{ marginRight: '8px' }} />
                        创意标题
                    </Text>
                    {renderTextField(parsedData.title, '未设置标题')}
                </div>

                {/* Body/Content */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                        📝 创意内容
                    </Text>
                    {renderMultilineText(parsedData.body, '未设置创意内容')}
                </div>
            </Space>
        );
    }

    // Render outline settings specific layout
    if (schemaType === 'outline_settings') {
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

    // Render episode planning specific layout
    if (schemaType === 'episode_planning') {
        return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Total Episodes */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                        📺 总集数
                    </Text>
                    <Text style={{ fontSize: '14px', color: '#fff' }}>
                        {parsedData.totalEpisodes || '未设置'}
                    </Text>
                </div>

                {/* Overall Strategy */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                        🎯 整体策略
                    </Text>
                    {renderMultilineText(parsedData.overallStrategy, '未设置整体策略')}
                </div>

                {/* Episode Groups */}
                <div>
                    <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                        📚 剧集规划
                    </Text>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {Array.isArray(parsedData.episodeGroups) && parsedData.episodeGroups.length > 0 ? (
                            parsedData.episodeGroups.map((group: any, index: number) => (
                                <Card
                                    key={index}
                                    size="small"
                                    style={{
                                        backgroundColor: '#262626',
                                        border: '1px solid #434343'
                                    }}
                                    styles={{ body: { padding: '20px' } }}
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Text strong style={{ fontSize: '16px', color: '#fff' }}>
                                                {group.groupTitle || `第 ${index + 1} 组`}
                                            </Text>
                                            <Tag color="blue" style={{ fontSize: '12px' }}>
                                                第 {group.episodes} 集
                                            </Tag>
                                        </div>
                                    }
                                >
                                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                        {/* Key Events */}
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                                🎬 关键事件
                                            </Text>
                                            {Array.isArray(group.keyEvents) && group.keyEvents.length > 0 ? (
                                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                                    {group.keyEvents.map((event: string, eventIndex: number) => (
                                                        <div key={eventIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                            <Text style={{ color: '#52c41a', fontSize: '12px', marginTop: '2px' }}>•</Text>
                                                            <Text style={{ color: '#fff', fontSize: '14px', flex: 1 }}>
                                                                {event}
                                                            </Text>
                                                        </div>
                                                    ))}
                                                </Space>
                                            ) : (
                                                <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无关键事件</Text>
                                            )}
                                        </div>

                                        {/* Hooks */}
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                                🪝 悬念钩子
                                            </Text>
                                            {Array.isArray(group.hooks) && group.hooks.length > 0 ? (
                                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                                    {group.hooks.map((hook: string, hookIndex: number) => (
                                                        <div key={hookIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                            <Text style={{ color: '#1890ff', fontSize: '12px', marginTop: '2px' }}>•</Text>
                                                            <Text style={{ color: '#fff', fontSize: '14px', flex: 1 }}>
                                                                {hook}
                                                            </Text>
                                                        </div>
                                                    ))}
                                                </Space>
                                            ) : (
                                                <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无悬念钩子</Text>
                                            )}
                                        </div>

                                        {/* Emotional Beats */}
                                        <div>
                                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                                💭 情感节拍
                                            </Text>
                                            {Array.isArray(group.emotionalBeats) && group.emotionalBeats.length > 0 ? (
                                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                                    {group.emotionalBeats.map((beat: string, beatIndex: number) => (
                                                        <div key={beatIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                            <Text style={{ color: '#f759ab', fontSize: '12px', marginTop: '2px' }}>•</Text>
                                                            <Text style={{ color: '#fff', fontSize: '14px', flex: 1 }}>
                                                                {beat}
                                                            </Text>
                                                        </div>
                                                    ))}
                                                </Space>
                                            ) : (
                                                <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无情感节拍</Text>
                                            )}
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
                                    暂无剧集规划
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