import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Input, Select, Button, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useYJSField } from '../../contexts/YJSArtifactContext';

const { TextArea } = Input;
const { Text } = Typography;

// Text Field Component
export const YJSTextField = React.memo(({ path, placeholder }: { path: string; placeholder?: string }) => {
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
        />
    );
});

// TextArea Field Component
export const YJSTextAreaField = React.memo(({ path, placeholder, rows = 4 }: {
    path: string;
    placeholder?: string;
    rows?: number;
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
            rows={rows}
        />
    );
});

// Array Field Component
export const YJSArrayField = React.memo(({ path, placeholder, itemPlaceholder }: {
    path: string;
    placeholder?: string;
    itemPlaceholder?: string;
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
                        style={{ flex: 1, marginRight: 8 }}
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
export const YJSMultiSelect = React.memo(({ path, options, placeholder }: {
    path: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
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
            style={{ width: '100%' }}
        />
    );
});

// Emotion Arcs Array Component
export const YJSEmotionArcsArray = React.memo(({ path }: { path: string }) => {
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
                            rows={3}
                            style={{ marginTop: 4 }}
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
export const YJSRelationshipDevelopmentsArray = React.memo(({ path }: { path: string }) => {
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
                            rows={3}
                            style={{ marginTop: 4 }}
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