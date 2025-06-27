import React, { useMemo } from 'react';
import { Card, Typography, Spin, Alert } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';

const { Title, Paragraph } = Typography;

interface RawAgentContextProps {
    projectId: string;
}

const RawAgentContext: React.FC<RawAgentContextProps> = ({ projectId }) => {
    const {
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs,
        isLoading,
        isError,
        error
    } = useProjectData();

    // Generate the agent context using the common function
    const agentContext = useMemo(() => {
        if (isLoading || !artifacts.length) {
            return null;
        }

        return prepareAgentPromptContext({
            artifacts,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        });
    }, [artifacts, transforms, humanTransforms, transformInputs, transformOutputs, isLoading]);

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (isError) {
        return (
            <Alert
                message="加载失败"
                description={error?.message || '无法加载代理上下文数据'}
                type="error"
                showIcon
                style={{ margin: '16px' }}
            />
        );
    }

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '16px',
            background: '#0a0a0a'
        }}>
            <Card
                title={
                    <Title level={4} style={{ margin: 0, color: '#fff' }}>
                        代理上下文 (Agent Context)
                    </Title>
                }
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #333'
                }}
                headStyle={{
                    background: '#262626',
                    borderBottom: '1px solid #333'
                }}
                bodyStyle={{
                    background: '#1a1a1a',
                    color: '#fff'
                }}
            >
                <div style={{
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: '#0a0a0a',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid #333',
                    maxHeight: 'calc(100vh - 200px)',
                    overflow: 'auto'
                }}>
                    {agentContext || '正在生成上下文...'}
                </div>

                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#0f1419',
                    borderRadius: '4px',
                    border: '1px solid #333'
                }}>
                    <Paragraph style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#888',
                        fontStyle: 'italic'
                    }}>
                        💡 这是发送给LLM的完整上下文信息，包含当前项目的所有有效故事创意。
                        代理会基于这些信息来理解项目状态并执行相应的操作。
                    </Paragraph>
                </div>
            </Card>
        </div>
    );
};

export default RawAgentContext; 