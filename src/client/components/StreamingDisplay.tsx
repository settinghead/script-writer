import React from 'react';
import { Card, Progress, Typography, List, Tag, Spin, Alert } from 'antd';
import {
    FileTextOutlined,
    UserOutlined,
    StarOutlined,
    EnvironmentOutlined,
    BookOutlined,
    LoadingOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface StreamingDisplayProps {
    data: any;
    isStreaming: boolean;
    progress?: {
        stage: string;
        percentage?: number;
    } | null;
    error?: string | null;
    type?: 'outline' | 'brainstorm' | 'plot_outline' | 'generic';
}

const StreamingDisplay: React.FC<StreamingDisplayProps> = ({
    data,
    isStreaming,
    progress,
    error,
    type = 'generic'
}) => {
    if (error) {
        return (
            <Alert
                message="生成错误"
                description={error}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
            />
        );
    }

    if (!data && isStreaming) {
        return (
            <Card style={{ marginBottom: 16 }}>
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Spin
                        indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
                        size="large"
                    />
                    <div style={{ marginTop: 16 }}>
                        {progress && (
                            <>
                                <Text type="secondary">{progress.stage}</Text>
                                {progress.percentage !== undefined && (
                                    <Progress
                                        percent={progress.percentage}
                                        size="small"
                                        style={{ marginTop: 8, maxWidth: 300, margin: '8px auto 0' }}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </Card>
        );
    }

    if (!data) {
        return null;
    }

    // Render based on data type
    switch (type) {
        case 'outline':
            return <OutlineDisplay data={data} isStreaming={isStreaming} />;
        case 'brainstorm':
            return <BrainstormDisplay data={data} isStreaming={isStreaming} />;
        case 'plot_outline':
            return <PlotOutlineDisplay data={data} isStreaming={isStreaming} />;
        default:
            return <GenericDisplay data={data} isStreaming={isStreaming} />;
    }
};

// Outline-specific display component
const OutlineDisplay: React.FC<{ data: any; isStreaming: boolean }> = ({ data, isStreaming }) => {
    if (!data.sections) {
        return <GenericDisplay data={data} isStreaming={isStreaming} />;
    }

    return (
        <div style={{ marginBottom: 16 }}>
            {/* Progress indicator */}
            {data.completionPercentage !== undefined && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong>生成进度:</Text>
                        <Progress
                            percent={data.completionPercentage}
                            size="small"
                            style={{ flex: 1 }}
                            status={isStreaming ? 'active' : 'success'}
                        />
                        {isStreaming && <Spin size="small" />}
                    </div>
                </Card>
            )}

            {/* Outline sections */}
            {data.sections.map((section: any, index: number) => (
                <Card
                    key={section.key || index}
                    size="small"
                    style={{ marginBottom: 12 }}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{section.icon}</span>
                            <span>{section.label}</span>
                            {section.complete && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        </div>
                    }
                >
                    <OutlineSectionContent section={section} />
                </Card>
            ))}
        </div>
    );
};

// Outline section content renderer
const OutlineSectionContent: React.FC<{ section: any }> = ({ section }) => {
    if (section.isList && Array.isArray(section.content)) {
        return (
            <List
                size="small"
                dataSource={section.content}
                renderItem={(item: string, index: number) => (
                    <List.Item>
                        <Tag color="blue">{index + 1}</Tag>
                        <Text>{item}</Text>
                    </List.Item>
                )}
            />
        );
    }

    if (section.isCharacterList && Array.isArray(section.content)) {
        return (
            <List
                size="small"
                dataSource={section.content}
                renderItem={(character: any) => (
                    <List.Item>
                        <div>
                            <Text strong>{character.name}</Text>
                            <br />
                            <Text type="secondary">{character.description}</Text>
                        </div>
                    </List.Item>
                )}
            />
        );
    }

    if (section.isStructured && typeof section.content === 'object') {
        return (
            <div>
                {section.content.summary && (
                    <div style={{ marginBottom: 12 }}>
                        <Text strong>核心设定：</Text>
                        <br />
                        <Text>{section.content.summary}</Text>
                    </div>
                )}
                {section.content.scenes && section.content.scenes.length > 0 && (
                    <div>
                        <Text strong>关键场景：</Text>
                        <List
                            size="small"
                            dataSource={section.content.scenes}
                            renderItem={(scene: string, index: number) => (
                                <List.Item>
                                    <Text>• {scene}</Text>
                                </List.Item>
                            )}
                        />
                    </div>
                )}
            </div>
        );
    }

    if (section.isLongText) {
        return (
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {section.content}
            </Paragraph>
        );
    }

    return <Text>{section.content}</Text>;
};

// Brainstorm-specific display component
const BrainstormDisplay: React.FC<{ data: any; isStreaming: boolean }> = ({ data, isStreaming }) => {
    if (!data.ideas) {
        return <GenericDisplay data={data} isStreaming={isStreaming} />;
    }

    return (
        <div style={{ marginBottom: 16 }}>
            {/* Progress indicator */}
            {data.completionPercentage !== undefined && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong>生成进度:</Text>
                        <Progress
                            percent={data.completionPercentage}
                            size="small"
                            style={{ flex: 1 }}
                            status={isStreaming ? 'active' : 'success'}
                        />
                        {isStreaming && <Spin size="small" />}
                    </div>
                </Card>
            )}

            {/* Ideas list */}
            <List
                dataSource={data.ideas}
                renderItem={(idea: any, index: number) => (
                    <List.Item>
                        <Card
                            size="small"
                            style={{ width: '100%' }}
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tag color="blue">{index + 1}</Tag>
                                    <Text strong>{idea.title}</Text>
                                    {idea.complete && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                </div>
                            }
                        >
                            <Text>{idea.content}</Text>
                        </Card>
                    </List.Item>
                )}
            />
        </div>
    );
};

// Plot outline display component
const PlotOutlineDisplay: React.FC<{ data: any; isStreaming: boolean }> = ({ data, isStreaming }) => {
    return (
        <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BookOutlined />
                <Title level={4} style={{ margin: 0 }}>情节提要</Title>
                {data.complete && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                {isStreaming && <Spin size="small" />}
            </div>

            {data.mediaType && (
                <div style={{ marginBottom: 12 }}>
                    <Text strong>媒体类型：</Text>
                    <Tag>{data.mediaType}</Tag>
                </div>
            )}

            {data.platform && (
                <div style={{ marginBottom: 12 }}>
                    <Text strong>平台：</Text>
                    <Tag>{data.platform}</Tag>
                </div>
            )}

            {data.outline && (
                <div style={{ marginBottom: 12 }}>
                    <Text strong>情节大纲：</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                        {data.outline}
                    </Paragraph>
                </div>
            )}

            {data.analysis && (
                <div>
                    <Text strong>分析：</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                        {data.analysis}
                    </Paragraph>
                </div>
            )}
        </Card>
    );
};

// Generic display component for unknown data types
const GenericDisplay: React.FC<{ data: any; isStreaming: boolean }> = ({ data, isStreaming }) => {
    return (
        <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <FileTextOutlined />
                <Title level={4} style={{ margin: 0 }}>生成结果</Title>
                {isStreaming && <Spin size="small" />}
            </div>

            <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                fontSize: 12
            }}>
                {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
            </pre>
        </Card>
    );
};

export default StreamingDisplay; 