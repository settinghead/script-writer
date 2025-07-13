import React, { memo } from 'react';
import { Card, Typography, Space, Button, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
    YJSTextField,
    YJSTextAreaField,
    YJSArrayField,
    YJSEmotionArcsArray,
    YJSRelationshipDevelopmentsArray
} from '../../transform-jsondoc-framework/components/YJSField';
import { YJSSlateArrayOfStringField } from '../../transform-jsondoc-framework/components/YJSSlateArrayField';
import { useYJSField } from '../../transform-jsondoc-framework/contexts/YJSJsondocContext';

const { Title, Text } = Typography;

interface EditableChroniclesFormProps {
    // No props needed - gets data from YJSJsondocContext
}

const EditableChroniclesForm: React.FC<EditableChroniclesFormProps> = memo(() => {
    const { value: stages, updateValue: setStages } = useYJSField('stages');

    const addStage = () => {
        const newStage = {
            title: '',
            stageSynopsis: '',
            event: '',
            emotionArcs: [],
            relationshipDevelopments: [],
            insights: []
        };
        setStages([...(stages || []), newStage]);
    };

    const removeStage = (index: number) => {
        if (!stages) return;
        const newStages = stages.filter((_: any, i: number) => i !== index);
        setStages(newStages);
    };

    const moveStage = (index: number, direction: 'up' | 'down') => {
        if (!stages) return;
        const newStages = [...stages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex >= 0 && targetIndex < newStages.length) {
            [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
            setStages(newStages);
        }
    };

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={3} style={{ margin: 0, color: '#fff' }}>
                        时间顺序大纲编辑
                    </Title>
                    <Text type="secondary">
                        编辑完整的故事发展阶段（共 {stages?.length || 0} 个阶段）
                    </Text>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={addStage}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                    添加阶段
                </Button>
            </div>

            {/* Stages */}
            {stages?.map((stage: any, index: number) => (
                <Card
                    key={index}
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>阶段 {index + 1}</span>
                            <Space>
                                <Button
                                    size="small"
                                    icon={<ArrowUpOutlined />}
                                    onClick={() => moveStage(index, 'up')}
                                    disabled={index === 0}
                                    style={{ fontSize: '12px' }}
                                />
                                <Button
                                    size="small"
                                    icon={<ArrowDownOutlined />}
                                    onClick={() => moveStage(index, 'down')}
                                    disabled={index === (stages?.length || 0) - 1}
                                    style={{ fontSize: '12px' }}
                                />
                                <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => removeStage(index)}
                                    style={{ fontSize: '12px' }}
                                />
                            </Space>
                        </div>
                    }
                    style={{
                        backgroundColor: '#1f1f1f',
                        border: '1px solid #434343',
                        borderRadius: '8px'
                    }}
                    styles={{ body: { padding: '20px' } }}
                >
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* 标题 */}
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                阶段标题
                            </Text>
                            <YJSTextField
                                path={`stages[${index}].title`}
                                placeholder="阶段标题"
                            />
                        </div>

                        {/* 概述 */}
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                阶段概述
                            </Text>
                            <YJSTextAreaField
                                path={`stages[${index}].stageSynopsis`}
                                placeholder="阶段概述描述"
                                rows={4}
                            />
                        </div>

                        {/* 核心事件 */}
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                核心事件
                            </Text>
                            <YJSTextAreaField
                                path={`stages[${index}].event`}
                                placeholder="关键事件描述"
                                rows={3}
                            />
                        </div>

                        <Divider style={{ margin: '16px 0' }} />

                        {/* 情感发展 */}
                        <YJSEmotionArcsArray path={`stages[${index}].emotionArcs`} />

                        <Divider style={{ margin: '16px 0' }} />

                        {/* 关系发展 */}
                        <YJSRelationshipDevelopmentsArray path={`stages[${index}].relationshipDevelopments`} />

                        <Divider style={{ margin: '16px 0' }} />

                        {/* 关键洞察 */}
                        <div>
                            <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                                关键洞察
                            </Text>
                            <YJSSlateArrayOfStringField
                                path={`stages[${index}].insights`}
                                placeholder="输入关键洞察..."
                            />
                        </div>
                    </Space>
                </Card>
            ))}

            {/* Add first stage if no stages exist */}
            {(!stages || stages.length === 0) && (
                <Card
                    style={{
                        backgroundColor: '#1f1f1f',
                        border: '1px dashed #434343',
                        borderRadius: '8px',
                        textAlign: 'center',
                        padding: '40px 20px'
                    }}
                >
                    <div style={{ color: '#666', marginBottom: '16px' }}>
                        还没有创建任何阶段
                    </div>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={addStage}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    >
                        创建第一个阶段
                    </Button>
                </Card>
            )}
        </Space>
    );
});

EditableChroniclesForm.displayName = 'EditableChroniclesForm';

export default EditableChroniclesForm; 