import React from 'react';
import { Space, Typography } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, BulbOutlined } from '@ant-design/icons';
import { YJSTextField, YJSTextAreaField, YJSArrayField } from './YJSField';
import { YJSEmotionArcsArray, YJSRelationshipDevelopmentsArray } from './YJSComplexFields';

const { Text } = Typography;

interface EditableChronicleStageFormProps {
    availableCharacters: string[];
}

/**
 * YJS-enabled editable form component for chronicle stages
 * This component is designed to be used within a YJSArtifactProvider
 * Uses atomic JSON path editing for complex nested structures
 */
export const EditableChronicleStageForm: React.FC<EditableChronicleStageFormProps> = React.memo(({
    availableCharacters
}) => {

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Stage Title */}
            <div>
                <YJSTextField
                    path="title"
                    placeholder="阶段标题"
                    className="stage-title-field"
                />
            </div>

            {/* Stage Synopsis */}
            <div>
                <YJSTextAreaField
                    path="stageSynopsis"
                    placeholder="阶段概述"
                    rows={3}
                    className="stage-synopsis-field"
                />
            </div>

            {/* Core Event */}
            <div>
                <Space align="center" style={{ marginBottom: '8px' }}>
                    <ThunderboltOutlined style={{ color: '#faad14' }} />
                    <Text strong style={{ color: '#faad14' }}>核心事件</Text>
                </Space>

                <div style={{ paddingLeft: '20px' }}>
                    <YJSTextAreaField
                        path="event"
                        placeholder="核心事件描述"
                        rows={2}
                        className="stage-event-field"
                    />
                </div>
            </div>

            {/* Emotion Arcs - Complex nested structure with atomic editing */}
            <YJSEmotionArcsArray
                basePath="emotionArcs"
                availableCharacters={availableCharacters}
            />

            {/* Relationship Developments - Complex nested structure with atomic editing */}
            <YJSRelationshipDevelopmentsArray
                basePath="relationshipDevelopments"
                availableCharacters={availableCharacters}
            />

            {/* Key Insights - Array of strings (textarea mode) */}
            <div>
                <Space align="center" style={{ marginBottom: '8px' }}>
                    <BulbOutlined style={{ color: '#fadb14' }} />
                    <Text strong style={{ color: '#fadb14' }}>关键洞察</Text>
                </Space>

                <div style={{ paddingLeft: '20px' }}>
                    <YJSArrayField
                        path="insights"
                        placeholder="每行一个关键洞察..."
                    />
                </div>
            </div>
        </Space>
    );
}); 