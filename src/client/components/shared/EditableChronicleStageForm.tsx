import React, { memo } from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import {
    YJSEmotionArcsArray,
    YJSRelationshipDevelopmentsArray,
    YJSArrayField,
    YJSTextField,
    YJSTextAreaField
} from './YJSField';

const { Title } = Typography;

interface EditableChronicleStageFormProps {
    stageIndex: number;
    title?: string;
}

const EditableChronicleStageForm: React.FC<EditableChronicleStageFormProps> = memo(({
    stageIndex,
    title = `阶段 ${stageIndex + 1}`
}) => {
    // Use relative paths since YJSArtifactProvider handles the basePath
    // If basePath is set to `stages[6]`, then `title` becomes `stages[6].title`

    return (
        <Card
            title={title}
            size="small"
            style={{ marginBottom: 16 }}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* 标题 */}
                <div>
                    <Title level={5} style={{ margin: 0, marginBottom: 8 }}>标题</Title>
                    <YJSTextField
                        path="title"
                        placeholder="阶段标题"
                    />
                </div>

                {/* 内容 */}
                <div>
                    <Title level={5} style={{ margin: 0, marginBottom: 8 }}>内容</Title>
                    <YJSTextAreaField
                        path="stageSynopsis"
                        placeholder="你的内容描述"
                        rows={4}
                    />
                </div>

                <Divider style={{ margin: '16px 0' }} />

                {/* 情感发展 */}
                <YJSEmotionArcsArray path="emotionArcs" />

                <Divider style={{ margin: '16px 0' }} />

                {/* 关系发展 */}
                <YJSRelationshipDevelopmentsArray path="relationshipDevelopments" />

                <Divider style={{ margin: '16px 0' }} />

                {/* 关键洞察 */}
                <div>
                    <Title level={5} style={{ margin: 0, marginBottom: 8 }}>关键洞察</Title>
                    <YJSArrayField
                        path="insights"
                        placeholder="添加洞察要点"
                        itemPlaceholder="输入洞察"
                    />
                </div>
            </Space>
        </Card>
    );
});

EditableChronicleStageForm.displayName = 'EditableChronicleStageForm';

export default EditableChronicleStageForm; 