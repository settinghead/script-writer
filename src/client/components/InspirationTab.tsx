import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, Spin, Alert } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';

// Use a hardcoded template instead of importing from a file
// The content is directly copied from src/client/inspiration.txt
const inspirationTemplate = `情节提要 Plot Outline guidelines：\`\`\`1. 情节具体且明确：精确具体地明确故事的核心情节、主要事件和角色的关键行动。2.每个主要角色的动机清晰，知道"为什么角色为什么要做某些事情"3. 有明确的冲突或目标4.故事完整，叙事闭环5. 去除笼统的概括语句。不使用任何修辞手法。只描述事件，不描述其他\`\`\`接下来，你需要将用户输入的灵感改编为故事情节。故事需要充满着激烈的冲突和张力。步骤1：分析用户输入的灵感，并确定最适合的叙事范式。这类叙事中最为知名的作品通常在哪种特定媒体或平台上找到（例如起点中文网的悬疑频道、电视上的法制悬疑系列等）。步骤2：利用你刚才提到的，会出现的平台风格，根据用户输入灵感，创作出小说剧情。请想象小说已经写出，是短篇小说，而你现在将它缩写为200字左右的情节提要（Plot Outline）。情节提要（Plot Outline）剧情需要由具体的事件组成，所有内容都被写出，起承转合结构，第一人称。剧情要具体，参考情节提要（Plot Outline）guidelines---

请按照步骤执行，用户输入的灵感是：
{user_input}`;

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface InspirationResponse {
    mediaType?: string;
    platform?: string;
    plotOutline?: string;
    analysis?: string;
    // Add any other fields that might be in the response
}

const InspirationTab: React.FC = () => {
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<InspirationResponse | null>(null);
    const [partialResult, setPartialResult] = useState('');

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
    };

    const generateInspiration = async () => {
        if (!userInput.trim()) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);
        setPartialResult('');

        // Create a new AbortController for this request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // Create the prompt by replacing placeholder in the template
            const fullPrompt = inspirationTemplate.replace('{user_input}', userInput);

            const response = await fetch('/llm-api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat', // Use the model name from your configuration
                    messages: [
                        { role: 'user', content: fullPrompt }
                    ],
                    response_format: { type: 'json_object' }
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            let accumulatedText = '';
            let decodedResult = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Convert the chunk to text
                const chunk = new TextDecoder().decode(value);
                accumulatedText += chunk;

                try {
                    // Try to repair and parse the accumulated JSON so far
                    decodedResult = jsonrepair(accumulatedText);
                    setPartialResult(decodedResult);

                    // If we can parse the repaired JSON, update the result
                    try {
                        const jsonResult = JSON.parse(decodedResult) as InspirationResponse;
                        setResult(jsonResult);
                    } catch (parseError) {
                        // Not yet a complete JSON, that's okay for streaming
                    }
                } catch (repairError) {
                    // JSON repair failed, which is expected for partial JSON
                    // Just continue accumulating more chunks
                }
            }

            // Final attempt to parse the complete response
            try {
                const finalJson = JSON.parse(jsonrepair(accumulatedText)) as InspirationResponse;
                setResult(finalJson);
            } catch (finalError) {
                console.error('Failed to parse final JSON:', finalError);
                setError(new Error('Failed to parse response as JSON'));
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Request was aborted');
            } else {
                console.error('Error generating inspiration:', err);
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    // Cleanup function to abort any ongoing fetch when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <Title level={4}>灵感生成器</Title>
            <Paragraph>
                输入你的灵感，AI将帮你构建故事情节提要。
            </Paragraph>

            <TextArea
                rows={4}
                value={userInput}
                onChange={handleInputChange}
                placeholder="输入你的创作灵感..."
                style={{ marginBottom: '16px' }}
                disabled={isLoading}
            />

            <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={generateInspiration}
                loading={isLoading}
                style={{ marginBottom: '24px' }}
            >
                生成
            </Button>

            {error && (
                <Alert
                    message="Error"
                    description={error.message}
                    type="error"
                    showIcon
                    style={{ marginBottom: '16px' }}
                />
            )}

            {(isLoading || result || partialResult) && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '16px',
                        border: '1px solid #303030',
                        borderRadius: '8px',
                        backgroundColor: '#141414'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <Text strong style={{ fontSize: '16px' }}>生成结果</Text>
                        {isLoading && <Spin />}
                    </div>

                    {result ? (
                        <div>
                            {result.mediaType && result.platform && (
                                <div style={{ marginBottom: '16px' }}>
                                    <Text strong>适合媒体类型:</Text> {result.mediaType}
                                    <br />
                                    <Text strong>推荐平台:</Text> {result.platform}
                                </div>
                            )}

                            {result.plotOutline && (
                                <div style={{ marginBottom: '16px' }}>
                                    <Text strong>情节提要:</Text>
                                    <Paragraph style={{
                                        padding: '12px',
                                        backgroundColor: '#1f1f1f',
                                        borderRadius: '8px',
                                        marginTop: '8px'
                                    }}>
                                        {result.plotOutline}
                                    </Paragraph>
                                </div>
                            )}

                            {result.analysis && (
                                <div>
                                    <Text strong>分析:</Text>
                                    <Paragraph style={{
                                        padding: '12px',
                                        backgroundColor: '#1f1f1f',
                                        borderRadius: '8px',
                                        marginTop: '8px'
                                    }}>
                                        {result.analysis}
                                    </Paragraph>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <pre style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#d9d9d9'
                            }}>
                                {partialResult || (isLoading ? '生成中...' : '')}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InspirationTab; 