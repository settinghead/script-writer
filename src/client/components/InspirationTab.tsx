import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, Spin, Alert } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';

// Use a hardcoded template instead of importing from a file
// The content is directly copied from src/client/inspiration.txt
const inspirationTemplate = `
你是一个短视频编剧。你的任务是根据用户输入的灵感，创作一个短视频的情节提要（ Plot Outline ）。

Guidelines：

\`\`\`
1. 情节具体且明确：精确具体地明确故事的核心情节、主要事件和角色的关键行动。
2.每个主要角色的动机清晰，知道“为什么角色为什么要做某些事情”
3. 有明确的冲突或目标
4.故事完整，叙事闭环
5. 去除笼统的概括语句。不使用任何修辞手法。只描述事件，不描述其他

\`\`\`
接下来，你需要将用户输入的灵感改编为故事情节。故事需要充满着激烈的冲突和张力。
步骤1：分析用户输入的灵感，并确定最适合的叙事范式。这类叙事中最为知名的作品通常在哪种特定媒体或平台上找到（例如起点中文网的悬疑频道、电视上的法制悬疑系列等）。
步骤2：利用你刚才提到的，会出现的平台风格，根据用户输入灵感，创作出小说剧情。请想象小说已经写出，是短篇小说，而你现在将它缩写为200字左右的情节提要（Plot Outline）。情节提要（Plot Outline）剧情需要由具体的事件组成，所有内容都被写出，起承转合结构，第一人称。剧情要具体，参考情节提要（Plot Outline）guidelines
---
请按照步骤执行，用户输入的灵感是：
请以JSON格式回复，包含以下字段:
{
  "mediaType": "适合的媒体类型，例如'小说'、'电视剧'等",
  "platform": "推荐的发布平台，例如'起点中文网悬疑频道'等",
  "plotOutline": "500字左右的情节提要，以第一人称编写",
  "analysis": "简短分析为什么这个故事适合上述平台"
}

用户需求：
{user_input}


`;

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface InspirationResponse {
    mediaType?: string;
    platform?: string;
    plotOutline?: string;
    analysis?: string;
    // Add any other fields that might be in the response
}

// Improved helper function to handle the specific SSE format
const cleanResponseText = (text: string): string => {
    try {
        // Step 1: Strip out all the SSE prefixes completely
        // This handles patterns like `:{"messageId":"..."}`, `0:"text"`, `e:{...}`, etc.
        let cleaned = '';
        const lines = text.split('\n');

        for (const line of lines) {
            // Extract content between quotes for lines with quotes
            const match = line.match(/\d+:"(.*)"|:(.*)$/);
            if (match) {
                // Get the content from whichever capture group matched
                const content = match[1] || match[2] || '';
                // Unescape any escaped characters in the content (like \n, \")
                cleaned += content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
        }

        // Step 2: Extract content from markdown code blocks
        const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
            cleaned = jsonMatch[1].trim();
        }

        // Step 3: Final cleanup - remove any remaining markdown or non-JSON syntax
        cleaned = cleaned.replace(/```json|```/g, '').trim();

        // Step 4: Make sure we have a proper JSON object by checking for outer braces
        if (!cleaned.startsWith('{') && cleaned.includes('{')) {
            cleaned = cleaned.substring(cleaned.indexOf('{'));
        }
        if (!cleaned.endsWith('}') && cleaned.includes('}')) {
            cleaned = cleaned.substring(0, cleaned.lastIndexOf('}') + 1);
        }

        return cleaned;
    } catch (error) {
        console.error('Error in cleanResponseText:', error);
        return text; // Return original text if cleaning fails
    }
};

// Debugging helper to visualize the text transformation
const logCleaning = (original: string) => {
    const cleaned = cleanResponseText(original);
    console.log('ORIGINAL TEXT:', original);
    console.log('CLEANED TEXT:', cleaned);
    return cleaned;
};

const InspirationTab: React.FC = () => {
    const [userInput, setUserInput] = useState('古早言情剧');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<InspirationResponse | null>(null);
    const [partialResult, setPartialResult] = useState('');
    const [rawResponse, setRawResponse] = useState(''); // Store raw response for debugging

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
        setRawResponse('');

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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Convert the chunk to text
                const chunk = new TextDecoder().decode(value);
                accumulatedText += chunk;

                // Save raw response for debugging
                setRawResponse(prev => prev + chunk);

                // Only try to parse if we see a closing brace character (potential end of JSON)
                if (chunk.includes('}')) {
                    try {
                        // Clean the text and log the cleaning process
                        const cleanedText = cleanResponseText(accumulatedText);

                        if (cleanedText.trim()) {
                            // Try to repair the cleaned JSON
                            try {
                                const repairedJson = jsonrepair(cleanedText);
                                setPartialResult(repairedJson);

                                // If we can parse the repaired JSON, update the result
                                try {
                                    const jsonResult = JSON.parse(repairedJson) as InspirationResponse;
                                    if (jsonResult.mediaType || jsonResult.plotOutline) {
                                        setResult(jsonResult);
                                    }
                                } catch (parseError) {
                                    // Not yet a complete JSON, that's okay for streaming
                                }
                            } catch (repairError) {
                                // Expected for partial JSON
                            }
                        }
                    } catch (error) {
                        console.error('Error processing chunk:', error);
                    }
                }
            }

            // Final attempt to parse the complete response
            try {
                console.log('Final processing:', accumulatedText.substring(0, 100) + '...');
                const cleanedFinalText = cleanResponseText(accumulatedText);
                console.log('Cleaned final:', cleanedFinalText.substring(0, 100) + '...');

                if (cleanedFinalText && cleanedFinalText.trim()) {
                    const repairedFinal = jsonrepair(cleanedFinalText);
                    const finalJson = JSON.parse(repairedFinal) as InspirationResponse;
                    setResult(finalJson);
                } else {
                    throw new Error('Cleaned text was empty');
                }
            } catch (finalError) {
                console.error('Failed to parse final JSON:', finalError);
                // If we have a partial result already, don't show an error
                if (!result) {
                    setError(new Error('Failed to parse response as JSON. Check console for details.'));
                }
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

    // Function to manually parse the raw response if automatic parsing fails
    const tryManualParse = () => {
        try {
            if (!rawResponse) return;

            // Manual extraction from the raw response
            let jsonStr = '';
            let inJson = false;
            const lines = rawResponse.split('\n');

            for (const line of lines) {
                if (line.includes('{"mediaType"') || line.includes('"mediaType"')) {
                    inJson = true;
                    jsonStr = '{';
                } else if (inJson) {
                    const contentMatch = line.match(/\d+:"(.*)"/);
                    if (contentMatch && contentMatch[1]) {
                        jsonStr += contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    }

                    if (line.includes('}')) {
                        jsonStr += '}';
                        break;
                    }
                }
            }

            if (jsonStr) {
                const manualJson = JSON.parse(jsonrepair(jsonStr)) as InspirationResponse;
                setResult(manualJson);
                setError(null);
            }
        } catch (err) {
            console.error('Manual parse failed:', err);
        }
    };

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
                style={{ marginBottom: '24px', marginRight: '8px' }}
            >
                生成
            </Button>

            {error && rawResponse && (
                <Button
                    onClick={tryManualParse}
                    style={{ marginBottom: '24px' }}
                >
                    尝试手动解析
                </Button>
            )}

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
                            {result.mediaType && (
                                <div style={{ marginBottom: '16px' }}>
                                    <Text strong>适合媒体类型:</Text> {result.mediaType}
                                </div>
                            )}

                            {result.platform && (
                                <div style={{ marginBottom: '16px' }}>
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

            {/* Debug panel - uncomment if needed */}
            {/* {rawResponse && (
                <div style={{ marginTop: '20px', border: '1px solid #333', padding: '10px', borderRadius: '8px' }}>
                    <Text strong>Raw Response (for debugging):</Text>
                    <pre style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px', color: '#888' }}>
                        {rawResponse}
                    </pre>
                </div>
            )} */}
        </div>
    );
};

export default InspirationTab; 