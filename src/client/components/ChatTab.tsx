import React from 'react';
import { useChat } from '@ai-sdk/react';
import { Button, Input, Typography, Spin, Alert } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

const ChatTab: React.FC = () => {
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
        api: '/llm-api/chat/completions',
    });

    // Default model name
    const MODEL_NAME = 'deepseek-chat';

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        handleSubmit(e, {
            body: {
                model: MODEL_NAME,
            }
        });
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <Paragraph>
                与AI助手进行对话，获取创作建议和帮助。
            </Paragraph>

            {error && (
                <Alert
                    message="Error"
                    description={error.message}
                    type="error"
                    showIcon
                    style={{ marginBottom: '16px' }}
                />
            )}

            <div
                style={{
                    marginBottom: '24px',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #303030',
                    borderRadius: '8px',
                    padding: '12px'
                }}
            >
                {messages.length > 0 ? (
                    messages.map(message => (
                        <div
                            key={message.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: '12px',
                                width: '100%'
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: '80%',
                                    backgroundColor: message.role === 'user' ? '#1890ff' : '#2a2a2a',
                                    border: 'none',
                                    padding: '12px',
                                    borderRadius: '8px'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                    {message.role === 'user' ? (
                                        <UserOutlined style={{ marginRight: '8px' }} />
                                    ) : (
                                        <RobotOutlined style={{ marginRight: '8px' }} />
                                    )}
                                    <Text strong style={{ color: message.role === 'user' ? 'white' : '#d9d9d9' }}>
                                        {message.role === 'user' ? '你' : 'AI'}
                                    </Text>
                                </div>
                                <Text style={{
                                    whiteSpace: 'pre-wrap',
                                    color: message.role === 'user' ? 'white' : '#d9d9d9'
                                }}>
                                    {message.content}
                                </Text>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                        还没有消息。开始一个新的对话吧！
                    </div>
                )}
            </div>

            <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px' }}>
                <Input
                    placeholder="输入你的问题..."
                    value={input}
                    onChange={e => handleInputChange(e)}
                    disabled={isLoading}
                    style={{ flexGrow: 1 }}
                    suffix={isLoading && <Spin size="small" />}
                />
                <Button
                    type="primary"
                    htmlType="submit"
                    disabled={isLoading}
                    icon={<SendOutlined />}
                >

                </Button>
            </form>
        </div>
    );
};

export default ChatTab; 