import React from 'react';
import { Form, Typography, Card, Space, Tag } from 'antd';
import { YJSTextField, YJSTextAreaField, YJSArrayField } from '../../transform-jsondoc-framework/components/YJSField';
import { YJSJsondocProvider } from '../../transform-jsondoc-framework/contexts/YJSJsondocContext';

const { Title, Text } = Typography;

interface EditableEpisodePlanningFormProps {
    jsondocId: string;
}

const EditableEpisodePlanningForm: React.FC<EditableEpisodePlanningFormProps> = ({ jsondocId }) => {
    return (
        <YJSJsondocProvider jsondocId={jsondocId}>
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
                                <YJSArrayField
                                    path="episodeGroups"
                                    placeholder="每行一个分组的JSON数据，格式：{&quot;groupTitle&quot;: &quot;标题&quot;, &quot;episodes&quot;: &quot;1-3&quot;, &quot;keyEvents&quot;: [...], &quot;hooks&quot;: [...], &quot;emotionalBeats&quot;: [...]}"
                                />
                            </Form.Item>

                            <div style={{ marginTop: '16px' }}>
                                <Text strong>示例格式：</Text>
                                <pre style={{
                                    background: '#f5f5f5',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    marginTop: '8px'
                                }}>
                                    {`{
  "groupTitle": "开场吸引阶段",
  "episodes": "1-3",
  "keyEvents": ["女主入职", "初遇男主", "误会产生"],
  "hooks": ["身份悬念", "关系误会", "职场冲突"],
  "emotionalBeats": ["紧张", "好奇", "困惑"]
}`}
                                </pre>
                            </div>
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
        </YJSJsondocProvider>
    );
};

export default EditableEpisodePlanningForm; 