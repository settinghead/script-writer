import React from 'react';
import { Space, Typography } from 'antd';
import { FileTextOutlined, ClockCircleOutlined, NumberOutlined } from '@ant-design/icons';
import { ElectricJsondoc } from '@/common/transform-jsondoc-types';
import { YJSTextField, YJSTextAreaField, YJSNumberField } from '../../transform-jsondoc-framework/components/YJSField';

const { Text } = Typography;

interface EditableEpisodeScriptFormProps {
    jsondoc: ElectricJsondoc;
}

const EditableEpisodeScriptForm: React.FC<EditableEpisodeScriptFormProps> = ({ jsondoc }) => {
    // This component now assumes it is rendered within a YJSJsondocProvider,
    // which is set up by the parent component (e.g., EpisodeContentDisplay).
    // The provider gives context necessary for YJS fields to work.

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Episode Title */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <NumberOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        剧集标题
                    </Text>
                </div>
                <YJSTextField
                    path="title"
                    placeholder="输入剧集标题"
                />
            </div>

            {/* Script Content */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <FileTextOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        剧本内容
                    </Text>
                </div>
                <YJSTextAreaField
                    path="scriptContent"
                    placeholder="输入完整的剧本内容，包含场景、对话、动作指导"
                />
            </div>

            {/* Estimated Duration */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <ClockCircleOutlined style={{ color: '#faad14', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        预估时长（分钟）
                    </Text>
                </div>
                <YJSNumberField
                    path="estimatedDuration"
                    placeholder="预估时长"
                />
            </div>
        </Space>
    );
};

export default EditableEpisodeScriptForm; 