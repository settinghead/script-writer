import React, { useMemo, useCallback } from 'react';
import { Card, Typography, Space, Button, Select, List, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, HeartOutlined, TeamOutlined, BulbOutlined } from '@ant-design/icons';
import { useYJSArtifactContext } from '../../contexts/YJSArtifactContext';
import { YJSTextField, YJSTextAreaField, YJSArrayField } from './YJSField';

const { Text } = Typography;

// Types for complex structures
interface EmotionArc {
    characters: string[];
    content: string;
}

interface RelationshipDevelopment {
    characters: string[];
    content: string;
}

// Multi-select component for character selection using JSON path
interface YJSMultiSelectProps {
    path: string;
    options: { label: string; value: string }[];
    placeholder?: string;
    disabled?: boolean;
}

export const YJSMultiSelect: React.FC<YJSMultiSelectProps> = React.memo(({
    path,
    options,
    placeholder = "选择选项",
    disabled = false
}) => {
    const { getField, setField, isLoading } = useYJSArtifactContext();

    const currentValue = getField(path) || [];

    const handleChange = useCallback((newValue: string[]) => {
        setField(path, newValue);
    }, [path, setField]);

    return (
        <Select
            mode="multiple"
            placeholder={placeholder}
            value={currentValue}
            onChange={handleChange}
            disabled={disabled || isLoading}
            style={{ width: '100%' }}
            options={options}
        />
    );
});

// Single emotion arc editor using atomic JSON paths
interface YJSEmotionArcProps {
    basePath: string; // e.g., "emotionArcs[0]"
    availableCharacters: string[];
    onRemove?: () => void;
    showRemoveButton?: boolean;
}

export const YJSEmotionArc: React.FC<YJSEmotionArcProps> = React.memo(({
    basePath,
    availableCharacters,
    onRemove,
    showRemoveButton = true
}) => {
    const characterOptions = useMemo(() =>
        availableCharacters.map(char => ({ label: char, value: char })),
        [availableCharacters]
    );

    return (
        <div style={{
            marginBottom: '12px',
            padding: '12px',
            border: '1px solid #434343',
            borderRadius: '6px',
            backgroundColor: '#1a1a1a'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <Text strong style={{ color: '#f759ab' }}>
                    <HeartOutlined style={{ marginRight: '4px' }} />
                    情感发展
                </Text>
                {showRemoveButton && onRemove && (
                    <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={onRemove}
                        style={{ color: '#ff4d4f' }}
                    />
                )}
            </div>

            <div style={{ marginBottom: '8px' }}>
                <Text style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    涉及角色:
                </Text>
                <YJSMultiSelect
                    path={`${basePath}.characters`}
                    options={characterOptions}
                    placeholder="选择角色"
                />
            </div>

            <div>
                <Text style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    情感发展内容:
                </Text>
                <YJSTextAreaField
                    path={`${basePath}.content`}
                    placeholder="描述角色的情感发展变化"
                    rows={2}
                />
            </div>
        </div>
    );
});

// Single relationship development editor using atomic JSON paths
interface YJSRelationshipDevelopmentProps {
    basePath: string; // e.g., "relationshipDevelopments[0]"
    availableCharacters: string[];
    onRemove?: () => void;
    showRemoveButton?: boolean;
}

export const YJSRelationshipDevelopment: React.FC<YJSRelationshipDevelopmentProps> = React.memo(({
    basePath,
    availableCharacters,
    onRemove,
    showRemoveButton = true
}) => {
    const characterOptions = useMemo(() =>
        availableCharacters.map(char => ({ label: char, value: char })),
        [availableCharacters]
    );

    return (
        <div style={{
            marginBottom: '12px',
            padding: '12px',
            border: '1px solid #434343',
            borderRadius: '6px',
            backgroundColor: '#1a1a1a'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <Text strong style={{ color: '#52c41a' }}>
                    <TeamOutlined style={{ marginRight: '4px' }} />
                    关系发展
                </Text>
                {showRemoveButton && onRemove && (
                    <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={onRemove}
                        style={{ color: '#ff4d4f' }}
                    />
                )}
            </div>

            <div style={{ marginBottom: '8px' }}>
                <Text style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    涉及角色:
                </Text>
                <YJSMultiSelect
                    path={`${basePath}.characters`}
                    options={characterOptions}
                    placeholder="选择角色"
                />
            </div>

            <div>
                <Text style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    关系发展内容:
                </Text>
                <YJSTextAreaField
                    path={`${basePath}.content`}
                    placeholder="描述角色之间的关系发展变化"
                    rows={2}
                />
            </div>
        </div>
    );
});

// Array manager for emotion arcs
interface YJSEmotionArcsArrayProps {
    basePath: string; // e.g., "emotionArcs"
    availableCharacters: string[];
}

export const YJSEmotionArcsArray: React.FC<YJSEmotionArcsArrayProps> = React.memo(({
    basePath,
    availableCharacters
}) => {
    const { getField, setField, isLoading } = useYJSArtifactContext();

    const currentArray = getField(basePath) || [];

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const addEmotionArc = useCallback(() => {
        const newArc = {
            characters: [],
            content: ''
        };
        const updatedArray = [...currentArray, newArc];
        setField(basePath, updatedArray);
    }, [basePath, currentArray, setField]);

    const removeEmotionArc = useCallback((index: number) => {
        const updatedArray = currentArray.filter((_: any, i: number) => i !== index);
        setField(basePath, updatedArray);
    }, [basePath, currentArray, setField]);

    // Memoize the rendered emotion arcs to prevent unnecessary re-renders
    const renderedEmotionArcs = useMemo(() => {
        return Array.isArray(currentArray) && currentArray.length > 0 ? (
            currentArray.map((arc: EmotionArc, index: number) => (
                <YJSEmotionArc
                    key={`${basePath}[${index}]`}
                    basePath={`${basePath}[${index}]`}
                    availableCharacters={availableCharacters}
                    onRemove={() => removeEmotionArc(index)}
                    showRemoveButton={currentArray.length > 1}
                />
            ))
        ) : (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                border: '1px dashed #434343',
                borderRadius: '6px',
                backgroundColor: '#0d0d0d'
            }}>
                <Text style={{ color: '#666', fontSize: '14px' }}>
                    暂无情感发展，点击"添加情感发展"开始创建
                </Text>
            </div>
        );
    }, [currentArray, basePath, availableCharacters, removeEmotionArc]);

    // If still loading, show loading state (AFTER all hooks)
    if (isLoading) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <Space align="center">
                        <HeartOutlined style={{ color: '#f759ab' }} />
                        <Text strong style={{ color: '#f759ab' }}>情感发展</Text>
                    </Space>
                    <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        disabled
                        style={{ borderColor: '#f759ab', color: '#f759ab' }}
                    >
                        加载中...
                    </Button>
                </div>
                <div style={{ paddingLeft: '20px' }}>
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        border: '1px dashed #434343',
                        borderRadius: '6px',
                        backgroundColor: '#0d0d0d'
                    }}>
                        <Text style={{ color: '#666', fontSize: '14px' }}>
                            加载中...
                        </Text>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Space align="center">
                    <HeartOutlined style={{ color: '#f759ab' }} />
                    <Text strong style={{ color: '#f759ab' }}>情感发展</Text>
                </Space>
                <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={addEmotionArc}
                    style={{ borderColor: '#f759ab', color: '#f759ab' }}
                >
                    添加情感发展
                </Button>
            </div>

            <div style={{ paddingLeft: '20px' }}>
                {renderedEmotionArcs}
            </div>
        </div>
    );
});

// Array manager for relationship developments
interface YJSRelationshipDevelopmentsArrayProps {
    basePath: string; // e.g., "relationshipDevelopments"
    availableCharacters: string[];
}

export const YJSRelationshipDevelopmentsArray: React.FC<YJSRelationshipDevelopmentsArrayProps> = React.memo(({
    basePath,
    availableCharacters
}) => {
    const { getField, setField, isLoading } = useYJSArtifactContext();

    const relationshipDevelopments = getField(basePath) || [];

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const addRelationshipDevelopment = useCallback(() => {
        const newDevelopment: RelationshipDevelopment = { characters: [], content: '' };
        const updatedDevelopments = [...relationshipDevelopments, newDevelopment];
        setField(basePath, updatedDevelopments);
    }, [basePath, relationshipDevelopments, setField]);

    const removeRelationshipDevelopment = useCallback((index: number) => {
        const updatedDevelopments = relationshipDevelopments.filter((_: any, i: number) => i !== index);
        setField(basePath, updatedDevelopments);
    }, [basePath, relationshipDevelopments, setField]);

    // If still loading, show loading state (AFTER all hooks)
    if (isLoading) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <Space align="center">
                        <TeamOutlined style={{ color: '#52c41a' }} />
                        <Text strong style={{ color: '#52c41a' }}>关系发展</Text>
                    </Space>
                    <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        disabled
                        style={{ borderColor: '#52c41a', color: '#52c41a' }}
                    >
                        加载中...
                    </Button>
                </div>
                <div style={{ paddingLeft: '20px' }}>
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        border: '1px dashed #434343',
                        borderRadius: '6px',
                        backgroundColor: '#0d0d0d'
                    }}>
                        <Text style={{ color: '#666', fontSize: '14px' }}>
                            加载中...
                        </Text>
                    </div>
                </div>
            </div>
        );
    }



    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Space align="center">
                    <TeamOutlined style={{ color: '#52c41a' }} />
                    <Text strong style={{ color: '#52c41a' }}>关系发展</Text>
                </Space>
                <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={addRelationshipDevelopment}
                    style={{ borderColor: '#52c41a', color: '#52c41a' }}
                >
                    添加关系发展
                </Button>
            </div>

            <div style={{ paddingLeft: '20px' }}>
                {Array.isArray(relationshipDevelopments) && relationshipDevelopments.length > 0 ? (
                    relationshipDevelopments.map((development: RelationshipDevelopment, index: number) => (
                        <YJSRelationshipDevelopment
                            key={`${basePath}[${index}]`}
                            basePath={`${basePath}[${index}]`}
                            availableCharacters={availableCharacters}
                            onRemove={() => removeRelationshipDevelopment(index)}
                            showRemoveButton={relationshipDevelopments.length > 1}
                        />
                    ))
                ) : (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        border: '1px dashed #434343',
                        borderRadius: '6px',
                        backgroundColor: '#0d0d0d'
                    }}>
                        <Text style={{ color: '#666', fontSize: '14px' }}>
                            暂无关系发展，点击"添加关系发展"开始创建
                        </Text>
                    </div>
                )}
            </div>
        </div>
    );
});

// Read-only display components for complex structures
interface ReadOnlyEmotionArcsProps {
    emotionArcs: EmotionArc[];
}

export const ReadOnlyEmotionArcs: React.FC<ReadOnlyEmotionArcsProps> = ({ emotionArcs }) => {
    if (!emotionArcs || emotionArcs.length === 0) {
        return (
            <div style={{ paddingLeft: '20px' }}>
                <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无情感发展</Text>
            </div>
        );
    }

    return (
        <div style={{ paddingLeft: '20px' }}>
            <List
                size="small"
                dataSource={emotionArcs}
                renderItem={(arc, index) => (
                    <List.Item style={{ padding: '8px 0', border: 'none' }}>
                        <div style={{ width: '100%' }}>
                            <Space wrap style={{ marginBottom: '4px' }}>
                                {arc.characters?.map((character, charIndex) => (
                                    <Tag key={charIndex} color="magenta">
                                        {character}
                                    </Tag>
                                ))}
                            </Space>
                            <Text style={{ color: '#fff', fontSize: '14px' }}>
                                {arc.content}
                            </Text>
                        </div>
                    </List.Item>
                )}
            />
        </div>
    );
};

interface ReadOnlyRelationshipDevelopmentsProps {
    relationshipDevelopments: RelationshipDevelopment[];
}

export const ReadOnlyRelationshipDevelopments: React.FC<ReadOnlyRelationshipDevelopmentsProps> = ({
    relationshipDevelopments
}) => {
    if (!relationshipDevelopments || relationshipDevelopments.length === 0) {
        return (
            <div style={{ paddingLeft: '20px' }}>
                <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无关系发展</Text>
            </div>
        );
    }

    return (
        <div style={{ paddingLeft: '20px' }}>
            <List
                size="small"
                dataSource={relationshipDevelopments}
                renderItem={(development, index) => (
                    <List.Item style={{ padding: '8px 0', border: 'none' }}>
                        <div style={{ width: '100%' }}>
                            <Space wrap style={{ marginBottom: '4px' }}>
                                {development.characters?.map((character, charIndex) => (
                                    <Tag key={charIndex} color="green">
                                        {character}
                                    </Tag>
                                ))}
                            </Space>
                            <Text style={{ color: '#fff', fontSize: '14px' }}>
                                {development.content}
                            </Text>
                        </div>
                    </List.Item>
                )}
            />
        </div>
    );
};

// Read-only insights list (array of strings)
interface ReadOnlyInsightsProps {
    insights: string[];
}

export const ReadOnlyInsights: React.FC<ReadOnlyInsightsProps> = ({ insights }) => {
    if (!insights || insights.length === 0) {
        return (
            <div style={{ paddingLeft: '20px' }}>
                <Text style={{ color: '#666', fontStyle: 'italic' }}>暂无关键洞察</Text>
            </div>
        );
    }

    return (
        <div style={{ paddingLeft: '20px' }}>
            <List
                size="small"
                dataSource={insights}
                renderItem={(insight, index) => (
                    <List.Item style={{ padding: '4px 0', border: 'none' }}>
                        <Text style={{ color: '#fff', fontSize: '14px' }}>
                            • {insight}
                        </Text>
                    </List.Item>
                )}
            />
        </div>
    );
}; 