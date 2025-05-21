import React from 'react';
import { useChat } from '@ai-sdk/react';
import { Button, Input, Typography, Spin, Alert, Space } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ChatPanelProps {
    onScriptEdit?: (content: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onScriptEdit }) => {
    const { messages, input, setInput, handleSubmit, isLoading, error } = useChat({
        api: '/llm-api/chat/completions',
    });

    // Default model name
    const MODEL_NAME = 'deepseek-chat';

    const handleLocalInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const attemptSubmit = (form: HTMLFormElement | null) => {
        if (!isLoading && input.trim() && form) {
            const syntheticEvent = new Event('submit', { cancelable: true, bubbles: true }) as unknown as React.FormEvent<HTMLFormElement>;
            Object.defineProperty(syntheticEvent, 'target', { writable: false, value: form });
            handleSubmit(syntheticEvent, {
                body: {
                    model: MODEL_NAME,
                }
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            attemptSubmit(e.currentTarget.closest('form'));
        }
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        attemptSubmit(e.currentTarget);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px' }}>
            <Paragraph style={{ fontSize: '12px', margin: '0 0 8px 0' }}>
                与AI助手进行对话，获取创作建议和帮助。
            </Paragraph>

            {error && (
                <Alert
                    message="Error"
                    description={error.message}
                    type="error"
                    showIcon
                    style={{ marginBottom: '8px', fontSize: '12px' }}
                />
            )}

            <div
                style={{
                    flexGrow: 1,
                    marginBottom: '12px',
                    overflowY: 'auto',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #303030',
                    borderRadius: '8px',
                    padding: '8px'
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
                                marginBottom: '8px',
                                width: '100%'
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: '80%',
                                    backgroundColor: message.role === 'user' ? '#1890ff' : '#2a2a2a',
                                    border: 'none',
                                    padding: '8px',
                                    borderRadius: '8px'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                    {message.role === 'user' ? (
                                        <UserOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                                    ) : (
                                        <RobotOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                                    )}
                                    <Text strong style={{ color: message.role === 'user' ? 'white' : '#d9d9d9', fontSize: '12px' }}>
                                        {message.role === 'user' ? '你' : 'AI'}
                                    </Text>
                                </div>
                                <Text style={{
                                    whiteSpace: 'pre-wrap',
                                    color: message.role === 'user' ? 'white' : '#d9d9d9',
                                    fontSize: '12px'
                                }}>
                                    {message.content}
                                </Text>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: '20px', fontSize: '12px' }}>
                        还没有消息。开始一个新的对话吧！
                    </div>
                )}
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Space.Compact style={{ display: 'flex', width: '100%' }}>
                    <TextArea
                        placeholder="输入你的问题... (Ctrl+Enter 或 Shift+Enter 发送)"
                        value={input}
                        onChange={handleLocalInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        autoSize={{ minRows: 1, maxRows: 5 }}
                        style={{
                            flexGrow: 1,
                            resize: 'none',
                        }}
                    />
                    <Button
                        type="primary"
                        htmlType="submit"
                        disabled={isLoading || !input.trim()}
                        icon={<SendOutlined />}
                        style={{
                            height: 'auto',
                            alignSelf: 'stretch'
                        }}
                    />
                </Space.Compact>
            </form>
        </div>
    );
};

export default ChatPanel; 