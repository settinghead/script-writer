import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Input, Select, Button, Typography, Card, Space, Tag, InputNumber } from 'antd';
import { PlusOutlined, DeleteOutlined, RightOutlined } from '@ant-design/icons';
import { useYJSField } from '../contexts/YJSJsondocContext';
import { YJSSlateArrayOfStringField } from './YJSSlateArrayField';

const { TextArea } = Input;
const { Text } = Typography;

const DEFAULT_FONT_SIZE = 15;
// Text Field Component
export const YJSTextField = React.memo(({ path, placeholder, fontSize = DEFAULT_FONT_SIZE }: { path: string; placeholder?: string, fontSize?: number }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateValue(e.target.value);
    }, [updateValue]);

    if (!isInitialized) return null;

    return (
        <Input
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder}
            style={{ fontSize: fontSize }}
        />
    );
});

// TextArea Field Component
export const YJSTextAreaField = React.memo(({ path, placeholder, fontSize = DEFAULT_FONT_SIZE }: {
    path: string;
    placeholder?: string;
    maxRows?: number;
    fontSize?: number;
}) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateValue(e.target.value);
    }, [updateValue]);

    if (!isInitialized) return null;

    return (
        <TextArea
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder}
            autoSize={true}
            style={{ fontSize: fontSize }}
        />
    );
});

// Array Field Component (for complex objects)
export const YJSArrayField = React.memo(({ path, placeholder, itemPlaceholder, fontSize = DEFAULT_FONT_SIZE }: {
    path: string;
    placeholder?: string;
    itemPlaceholder?: string;
    fontSize?: number;
}) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const arrayValue = useMemo(() => {
        if (!Array.isArray(value)) return [];
        return value;
    }, [value]);

    const handleItemChange = useCallback((index: number, newValue: string) => {
        const newArray = [...arrayValue];
        newArray[index] = newValue;
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleAddItem = useCallback(() => {
        const newArray = [...arrayValue, ''];
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleRemoveItem = useCallback((index: number) => {
        const newArray = arrayValue.filter((_, i) => i !== index);
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    if (!isInitialized) return null;

    return (
        <div>
            {arrayValue.map((item, index) => (
                <div key={index} style={{ display: 'flex', marginBottom: 8, alignItems: 'center' }}>
                    <Input
                        value={item || ''}
                        onChange={(e) => handleItemChange(index, e.target.value)}
                        placeholder={itemPlaceholder}
                        style={{ flex: 1, marginRight: 8, fontSize: fontSize }}
                    />
                    <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveItem(index)}
                        size="small"
                    />
                </div>
            ))}
            <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                style={{ width: '100%' }}
            >
                {placeholder || '添加项目'}
            </Button>
        </div>
    );
});



// Multi-Select Field Component
export const YJSMultiSelect = React.memo(({ path, options, placeholder, fontSize = DEFAULT_FONT_SIZE }: {
    path: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    fontSize?: number;
}) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const arrayValue = useMemo(() => {
        if (!Array.isArray(value)) return [];
        return value;
    }, [value]);

    const handleChange = useCallback((newValue: string[]) => {
        updateValue(newValue);
    }, [updateValue]);

    if (!isInitialized) return null;

    return (
        <Select
            mode="multiple"
            value={arrayValue}
            onChange={handleChange}
            options={options}
            placeholder={placeholder}
            style={{ width: '100%', fontSize: fontSize }}
        />
    );
});

// Emotion Arcs Array Component
export const YJSEmotionArcsArray = React.memo(({ path, fontSize = DEFAULT_FONT_SIZE }: { path: string, fontSize?: number }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const arrayValue = useMemo(() => {
        if (!Array.isArray(value)) return [];
        return value;
    }, [value]);

    const handleItemChange = useCallback((index: number, field: string, newValue: any) => {
        const newArray = [...arrayValue];
        if (!newArray[index]) {
            newArray[index] = {};
        }
        newArray[index] = { ...newArray[index], [field]: newValue };
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleAddItem = useCallback(() => {
        const newArray = [...arrayValue, { characters: [], content: '' }];
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleRemoveItem = useCallback((index: number) => {
        const newArray = arrayValue.filter((_, i) => i !== index);
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    if (!isInitialized) return null;

    return (
        <div>
            {arrayValue.map((item, index) => (
                <div key={index} style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text strong>情感发展 {index + 1}</Text>
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveItem(index)}
                            size="small"
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>描述：</Text>
                        <TextArea
                            value={item?.content || ''}
                            onChange={(e) => handleItemChange(index, 'content', e.target.value)}
                            placeholder="描述这个阶段的情感发展..."
                            autoSize={{ minRows: 2, }}
                            style={{ marginTop: 4, fontSize: fontSize }}
                        />
                    </div>

                    <div>
                        <Text>涉及角色：</Text>
                        <Select
                            mode="multiple"
                            value={item?.characters || []}
                            onChange={(newValue) => handleItemChange(index, 'characters', newValue)}
                            placeholder="选择涉及的角色"
                            style={{ width: '100%', marginTop: 4 }}
                            options={[
                                { value: '林小满', label: '林小满' },
                                { value: '顾沉舟', label: '顾沉舟' },
                                { value: '南宫玥', label: '南宫玥' },
                                { value: '沈曼', label: '沈曼' },
                                { value: '其他', label: '其他' }
                            ]}
                        />
                    </div>
                </div>
            ))}

            <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                style={{ width: '100%' }}
            >
                添加情感发展
            </Button>
        </div>
    );
});

// Relationship Developments Array Component
export const YJSRelationshipDevelopmentsArray = React.memo(({ path, fontSize = DEFAULT_FONT_SIZE }: { path: string, fontSize?: number }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const arrayValue = useMemo(() => {
        if (!Array.isArray(value)) return [];
        return value;
    }, [value]);

    const handleItemChange = useCallback((index: number, field: string, newValue: any) => {
        const newArray = [...arrayValue];
        if (!newArray[index]) {
            newArray[index] = {};
        }
        newArray[index] = { ...newArray[index], [field]: newValue };
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleAddItem = useCallback(() => {
        const newArray = [...arrayValue, { characters: [], content: '' }];
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleRemoveItem = useCallback((index: number) => {
        const newArray = arrayValue.filter((_, i) => i !== index);
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    if (!isInitialized) return null;

    return (
        <div>
            {arrayValue.map((item, index) => (
                <div key={index} style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text strong>关系发展 {index + 1}</Text>
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveItem(index)}
                            size="small"
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>涉及角色：</Text>
                        <Select
                            mode="multiple"
                            value={item?.characters || []}
                            onChange={(newValue) => handleItemChange(index, 'characters', newValue)}
                            placeholder="选择涉及的角色"
                            style={{ width: '100%', marginTop: 4 }}
                            options={[
                                { value: '林小满', label: '林小满' },
                                { value: '顾沉舟', label: '顾沉舟' },
                                { value: '南宫玥', label: '南宫玥' },
                                { value: '沈曼', label: '沈曼' },
                                { value: '其他', label: '其他' }
                            ]}
                        />
                    </div>

                    <div>
                        <Text>发展过程：</Text>
                        <TextArea
                            value={item?.content || ''}
                            onChange={(e) => handleItemChange(index, 'content', e.target.value)}
                            placeholder="描述关系如何发展..."
                            autoSize={{ minRows: 2, }}
                            style={{ marginTop: 4, fontSize: fontSize }}
                        />
                    </div>
                </div>
            ))}

            <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                style={{ width: '100%' }}
            >
                添加关系发展
            </Button>
        </div>
    );
});

YJSTextField.displayName = 'YJSTextField';
YJSTextAreaField.displayName = 'YJSTextAreaField';
YJSArrayField.displayName = 'YJSArrayField';
YJSMultiSelect.displayName = 'YJSMultiSelect';
YJSEmotionArcsArray.displayName = 'YJSEmotionArcsArray';
YJSRelationshipDevelopmentsArray.displayName = 'YJSRelationshipDevelopmentsArray';

// Character Array Component
export const YJSCharacterArray = React.memo(({ path, fontSize = DEFAULT_FONT_SIZE }: { path: string, fontSize?: number }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const arrayValue = useMemo(() => {
        if (!Array.isArray(value)) return [];
        return value;
    }, [value]);

    const handleItemChange = useCallback((index: number, field: string, newValue: any) => {
        const newArray = [...arrayValue];
        if (!newArray[index]) {
            newArray[index] = {
                name: '',
                type: 'supporting',
                age: '',
                gender: '',
                occupation: '',
                description: '',
                personality_traits: [],
                character_arc: ''
            };
        }
        newArray[index] = { ...newArray[index], [field]: newValue };
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleAddItem = useCallback(() => {
        const newArray = [...arrayValue, {
            name: '',
            type: 'supporting',
            age: '',
            gender: '',
            occupation: '',
            description: '',
            personality_traits: [],
            character_arc: ''
        }];
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleRemoveItem = useCallback((index: number) => {
        const newArray = arrayValue.filter((_, i) => i !== index);
        updateValue(newArray);
    }, [arrayValue, updateValue]);



    if (!isInitialized) return null;

    return (
        <div>
            {arrayValue.map((character, index) => (
                <Card
                    key={index}
                    size="small"
                    style={{
                        backgroundColor: '#262626',
                        border: '1px solid #434343',
                        marginBottom: '16px'
                    }}
                    styles={{ body: { padding: '16px' } }}
                    extra={
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            size="small"
                            onClick={() => handleRemoveItem(index)}
                            style={{ color: '#ff4d4f' }}
                        />
                    }
                >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>姓名：</Text>
                            <Input
                                value={character?.name || ''}
                                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                placeholder="角色姓名"
                            />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>类型：</Text>
                            <Input
                                value={character?.type || ''}
                                onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                                placeholder="角色类型"
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>基本信息：</Text>
                            <div>
                                <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>年龄：</Text>
                                <Input
                                    value={character?.age || ''}
                                    onChange={(e) => handleItemChange(index, 'age', e.target.value)}
                                    placeholder="年龄"
                                />
                            </div>
                            <div>
                                <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>性别：</Text>
                                <Input
                                    value={character?.gender || ''}
                                    onChange={(e) => handleItemChange(index, 'gender', e.target.value)}
                                    placeholder="性别"
                                />
                            </div>
                            <div>
                                <Text strong style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '2px' }}>职业：</Text>
                                <Input
                                    value={character?.occupation || ''}
                                    onChange={(e) => handleItemChange(index, 'occupation', e.target.value)}
                                    placeholder="职业"
                                />
                            </div>
                        </div>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>角色描述：</Text>
                            <TextArea
                                value={character?.description || ''}
                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                placeholder="角色描述"
                                autoSize={{ minRows: 2, }}
                                style={{ fontSize: fontSize }}
                            />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>性格特点：</Text>
                            <YJSSlateArrayOfStringField
                                path={`${path}[${index}].personality_traits`}
                                placeholder="每行一个性格特点..."
                                fontSize={fontSize}
                            />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>成长轨迹：</Text>
                            <TextArea
                                value={character?.character_arc || ''}
                                onChange={(e) => handleItemChange(index, 'character_arc', e.target.value)}
                                placeholder="成长轨迹"
                                autoSize={{ minRows: 2, }}
                            />
                        </div>
                    </Space>
                </Card>
            ))}

            {arrayValue.length === 0 && (
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
                        暂无角色，点击下方"添加角色"按钮开始创建
                    </Text>
                </Card>
            )}

            <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                style={{ width: '100%', marginTop: '8px' }}
            >
                添加角色
            </Button>
        </div>
    );
});

// Inline Array Field Component for use within character forms
const YJSArrayFieldInline = React.memo(({ value, onChange, placeholder, fontSize = DEFAULT_FONT_SIZE }: {
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    fontSize?: number;
}) => {
    const handleTextAreaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        onChange(newValue);
    }, [onChange]);

    const textAreaValue = useMemo(() => {
        return Array.isArray(value) ? value.join('\n') : '';
    }, [value]);

    return (
        <TextArea
            value={textAreaValue}
            onChange={handleTextAreaChange}
            placeholder={placeholder}
            autoSize={{ minRows: 2, }}
            style={{ resize: 'vertical', fontSize: fontSize }}
        />
    );
});

// Number Input Field Component
export const YJSNumberField = React.memo(({ path, min, max, placeholder, fontSize = DEFAULT_FONT_SIZE }: {
    path: string;
    min?: number;
    max?: number;
    placeholder?: string;
    fontSize?: number;
}) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const handleChange = useCallback((newValue: number | null) => {
        updateValue(newValue);
    }, [updateValue]);

    if (!isInitialized) return null;

    return (
        <InputNumber
            min={min}
            max={max}
            value={value}
            onChange={handleChange}
            style={{
                width: '100%',
                background: '#141414',
                borderColor: '#434343',
                color: '#d9d9d9',
                fontSize: fontSize
            }}
            size="large"
            placeholder={placeholder}
        />
    );
});

YJSCharacterArray.displayName = 'YJSCharacterArray';
YJSArrayFieldInline.displayName = 'YJSArrayFieldInline';
YJSNumberField.displayName = 'YJSNumberField';

// Episode Groups Array Component
export const YJSEpisodeGroupsArray = React.memo(({ path, fontSize = DEFAULT_FONT_SIZE }: { path: string, fontSize?: number }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const arrayValue = useMemo(() => {
        if (!Array.isArray(value)) return [];
        return value;
    }, [value]);

    const handleItemChange = useCallback((index: number, field: string, newValue: any) => {
        const newArray = [...arrayValue];
        if (!newArray[index]) {
            newArray[index] = {
                groupTitle: '',
                episodes: '',
                plotDescription: '',
                keyEvents: [],
                hooks: [],
                emotionalBeats: []
            };
        }
        newArray[index] = { ...newArray[index], [field]: newValue };
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleAddItem = useCallback(() => {
        const newArray = [...arrayValue, {
            groupTitle: '',
            episodes: '',
            plotDescription: '',
            keyEvents: [],
            hooks: [],
            emotionalBeats: []
        }];
        updateValue(newArray);
    }, [arrayValue, updateValue]);

    const handleRemoveItem = useCallback((index: number) => {
        const newArray = arrayValue.filter((_, i) => i !== index);
        updateValue(newArray);
    }, [arrayValue, updateValue]);



    if (!isInitialized) return null;

    return (
        <div>
            {arrayValue.map((group, index) => (
                <div key={index} style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text strong>阶段 {index + 1}</Text>
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveItem(index)}
                            size="small"
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>阶段标题：</Text>
                        <Input
                            value={group?.groupTitle || ''}
                            onChange={(e) => handleItemChange(index, 'groupTitle', e.target.value)}
                            placeholder="输入阶段标题"
                            style={{ marginTop: 4, fontSize: fontSize }}
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>集数范围：</Text>
                        <Input
                            value={group?.episodes || ''}
                            onChange={(e) => handleItemChange(index, 'episodes', e.target.value)}
                            placeholder="例如：1-3"
                            style={{ marginTop: 4, fontSize: fontSize }}
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>剧情描述：</Text>
                        <Input.TextArea
                            value={group?.plotDescription || ''}
                            onChange={(e) => handleItemChange(index, 'plotDescription', e.target.value)}
                            placeholder="描述该阶段的主要剧情发展..."
                            style={{ marginTop: 4, fontSize: fontSize }}
                            autoSize={{ minRows: 2, maxRows: 4 }}
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>关键事件：</Text>
                        <YJSSlateArrayOfStringField
                            path={`${path}[${index}].keyEvents`}
                            placeholder="每行一个关键事件..."
                            fontSize={fontSize}
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <Text>悬念钩子：</Text>
                        <YJSSlateArrayOfStringField
                            path={`${path}[${index}].hooks`}
                            placeholder="每行一个悬念钩子..."
                            fontSize={fontSize}
                        />
                    </div>

                    <div>
                        <Text>情感节拍：</Text>
                        <YJSSlateArrayOfStringField
                            path={`${path}[${index}].emotionalBeats`}
                            placeholder="每行一个情感节拍..."
                            fontSize={fontSize}
                        />
                    </div>
                </div>
            ))}
            <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                style={{ width: '100%' }}
            >
                添加阶段
            </Button>
        </div>
    );
});

YJSEpisodeGroupsArray.displayName = 'YJSEpisodeGroupsArray'; 