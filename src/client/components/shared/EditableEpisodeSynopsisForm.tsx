
import React from 'react';
import { Space, Typography } from 'antd';
import { EyeOutlined, ThunderboltOutlined, FireOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { ElectricJsondoc } from '@/common/transform-jsondoc-types';
import { YJSTextField, YJSTextAreaField } from '../../transform-jsondoc-framework/components/YJSField';

const { Text } = Typography;

interface EditableEpisodeSynopsisFormProps {
    jsondoc: ElectricJsondoc;
}

const EditableEpisodeSynopsisForm: React.FC<EditableEpisodeSynopsisFormProps> = ({ jsondoc }) => {
    // This component now assumes it is rendered within a YJSJsondocProvider,
    // which is set up by the parent component (e.g., EpisodeSynopsisDisplay).
    // The provider gives context necessary for YJS fields to work.

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Episode Title */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <ClockCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        剧集标题
                    </Text>
                </div>
                <YJSTextField
                    path="title"
                    placeholder="输入剧集标题"
                />
            </div>

            {/* Opening Hook */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <EyeOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        开场钩子
                    </Text>
                </div>
                <YJSTextAreaField
                    path="openingHook"
                    placeholder="描述如何吸引观众注意力的开场设计"
                />
            </div>

            {/* Main Plot */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <ThunderboltOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        主要剧情
                    </Text>
                </div>
                <YJSTextAreaField
                    path="mainPlot"
                    placeholder="描述本集的核心故事情节和发展"
                />
            </div>

            {/* Emotional Climax */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <FireOutlined style={{ color: '#ff4d4f', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        情感高潮
                    </Text>
                </div>
                <YJSTextAreaField
                    path="emotionalClimax"
                    placeholder="描述本集的情感爆发点和高潮时刻"
                />
            </div>

            {/* Cliffhanger */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: '8px' }} />
                    <Text strong style={{ fontSize: '14px', color: '#fff' }}>
                        结尾悬念
                    </Text>
                </div>
                <YJSTextAreaField
                    path="cliffhanger"
                    placeholder="描述如何设置悬念，让观众期待下一集"
                />
            </div>
        </Space>
    );
};

export default EditableEpisodeSynopsisForm; 