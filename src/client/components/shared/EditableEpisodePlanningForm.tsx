import React from 'react';
import { Form, Typography, Card, Space, Tag } from 'antd';
import { YJSTextField, YJSTextAreaField, YJSEpisodeGroupsArray } from '../../transform-jsondoc-framework/components/YJSField';

const { Title, Text } = Typography;

interface EditableEpisodePlanningFormProps {
    // No props needed - gets data from YJSJsondocContext
}

const EditableEpisodePlanningForm: React.FC<EditableEpisodePlanningFormProps> = () => {
    return (
        <Form layout="vertical">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Basic Info */}
                <Card size="small" title="基本信息">
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Form.Item label="总集数">
                            <YJSTextField
                                path="totalEpisodes"
                                placeholder="总集数"
                            />
                        </Form.Item>

                        <Form.Item label="整体策略">
                            <YJSTextAreaField
                                path="overallStrategy"
                                rows={4}
                                placeholder="描述整体分集策略，如非线性叙事、情感节奏等"
                            />
                        </Form.Item>
                    </Space>
                </Card>

                {/* Episode Groups */}
                <Card size="small" title="分集分组">
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text type="secondary">
                            每个分组代表几集的内容安排，包含关键事件、悬念钩子和情感节拍
                        </Text>

                        <Form.Item label="分组详情">
                            <YJSEpisodeGroupsArray
                                path="episodeGroups"
                            />
                        </Form.Item>
                    </Space>
                </Card>

                {/* Tips */}
                <Card size="small" title="编辑提示" type="inner">
                    <Space direction="vertical">
                        <Text>
                            <Tag color="blue">脉冲式节奏</Tag>
                            每集都应该有情感高潮和悬念，适合2分钟短视频
                        </Text>
                        <Text>
                            <Tag color="purple">非线性叙事</Tag>
                            可以打破时间顺序，用闪回等技巧增强戏剧效果
                        </Text>
                        <Text>
                            <Tag color="green">钩子设计</Tag>
                            每集开头要有强烈钩子，结尾要有悬念吸引下一集
                        </Text>
                    </Space>
                </Card>
            </Space>
        </Form>
    );
};

export default EditableEpisodePlanningForm; 