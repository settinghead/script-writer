import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, Spin, Alert, Select, Row, Col, Divider, Modal, Drawer, Checkbox, Slider } from 'antd';
import { SendOutlined, RightOutlined, LeftOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';
import GenreSelectionPopup from './GenreSelectionPopup';

const NUM_IDEAS_TO_GENERATE = 6; // New global constant

// Use a hardcoded template instead of importing from a file
// The content is directly copied from src/client/ideation.txt
const ideationTemplate = `
你是一个短视频编剧。你的任务是根据用户输入的灵感，创作一个短视频的情节提要（ Plot Outline ）。

Guidelines：

\`\`\`
1. 情节具体且明确：精确具体地明确故事的核心情节、主要事件和角色的关键行动。
2.每个主要角色的动机清晰，知道"为什么角色为什么要做某些事情"
3. 有明确的冲突或目标
4.故事完整，叙事闭环
5. 去除笼统的概括语句。不使用任何修辞手法。只描述事件，不描述其他

\`\`\`
接下来，你需要将用户输入的灵感改编为故事情节。故事需要充满着激烈的冲突和张力。
步骤1：分析用户输入的灵感，并确定最适合的叙事范式。这类叙事中最为知名的作品通常在哪种特定媒体或平台上找到（例如起点中文网的悬疑频道、电视上的法制悬疑系列等）。
步骤2：利用你刚才提到的，会出现的平台风格，根据用户输入灵感，创作出小说剧情。请想象小说已经写出，是短篇小说，而你现在将它缩写为200字左右的情节提要（Plot Outline）。情节提要（Plot Outline）剧情需要由具体的事件组成，所有内容都被写出，起承转合结构，第一人称。剧情要具体，参考情节提要（Plot Outline）guidelines

目标平台：{platform}
故事类型：{genre}
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

// Idea generation template
const ideaGenerationTemplate = `
你是一个创意生成器。请根据给定的故事类型，生成${NUM_IDEAS_TO_GENERATE}个简短、具体、有趣的创意灵感句子。

故事类型：{genre}
目标平台：{platform}

要求：
- 每个创意一句话（15-30字）
- 每个创意都要具体，不要抽象
- 每个创意都要有冲突或戏剧性
- 每个创意都适合短视频/短剧格式

请以JSON数组的格式返回这${NUM_IDEAS_TO_GENERATE}个创意，例如：
["创意1", "创意2", ..., "创意${NUM_IDEAS_TO_GENERATE}"]
不要其他解释或包裹。
`;

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Platform options for short drama platforms
const platformOptions = [
    { value: '抖音', label: '抖音 (Douyin)' },
    { value: '快手', label: '快手 (Kuaishou)' },
    { value: '小红书', label: '小红书 (Xiaohongshu)' },
    { value: 'B站', label: 'B站 (Bilibili)' },
    { value: '微博', label: '微博 (Weibo)' },
    { value: '腾讯视频', label: '腾讯视频 (Tencent Video)' },
    { value: '爱奇艺', label: '爱奇艺 (iQiyi)' },
    { value: '优酷', label: '优酷 (Youku)' },
    { value: '芒果TV', label: '芒果TV (Mango TV)' },
    { value: '西瓜视频', label: '西瓜视频 (Xigua Video)' }
];

interface IdeationResponse {
    mediaType?: string;
    platform?: string;
    plotOutline?: string;
    analysis?: string;
    // Add any other fields that might be in the response
}

const IdeationTab: React.FC = () => {
    const [userInput, setUserInput] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<string>('');
    const [selectedGenrePaths, setSelectedGenrePaths] = useState<string[][]>([]);
    const [genreProportions, setGenreProportions] = useState<number[]>([]);
    const [proportionModalVisible, setProportionModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<IdeationResponse | null>(null);
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
    const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // Add isMobile state

    const abortControllerRef = useRef<AbortController | null>(null);

    // Effect to handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
    };

    const handlePlatformChange = (value: string) => {
        setSelectedPlatform(value);
    };

    const handleGenreSelectionConfirm = (selection: { paths: string[][]; proportions: number[] }) => {
        setSelectedGenrePaths(selection.paths);
        setGenreProportions(selection.proportions);
        setGenrePopupVisible(false); // Close the main popup
    };

    // Handle idea card selection
    const handleIdeaSelection = (index: number) => {
        setSelectedIdeaIndex(index);
        setUserInput(generatedIdeas[index]);
    };

    // Check if genre selection is complete (for dice button)
    const isGenreSelectionComplete = () => {
        if (selectedGenrePaths.length === 0) {
            return false; // No genre selected
        }
        // Check if every selected path has at least 3 levels
        return selectedGenrePaths.every(path => path.length >= 3);
    };

    // Build genre string for the prompt and display
    const buildGenreDisplayElements = (): (JSX.Element | string)[] => {
        if (selectedGenrePaths.length === 0) return ["未指定"];

        return selectedGenrePaths.map((path, index) => {
            const proportion = genreProportions[index] !== undefined
                ? genreProportions[index]
                : (100 / selectedGenrePaths.length);
            const pathString = path.join(' > ');
            const displayString = selectedGenrePaths.length > 1
                ? `- ${pathString} (${proportion.toFixed(0)}%)`
                : `- ${pathString}`;
            return <div key={index} style={{ lineHeight: '1.5' }}>{displayString}</div>;
        });
    };

    // Function to build the genre string for the LLM prompt (single line)
    const buildGenrePromptString = (): string => {
        if (selectedGenrePaths.length === 0) return '未指定';
        return selectedGenrePaths.map((path, index) => {
            const proportion = genreProportions[index] !== undefined
                ? genreProportions[index]
                : (100 / selectedGenrePaths.length);
            const pathString = path.join(' > ');
            return selectedGenrePaths.length > 1
                ? `${pathString} (${proportion.toFixed(0)}%)`
                : pathString;
        }).join(', ');
    };

    // Generate a one-sentence idea using LLM
    const generateIdea = async () => {
        if (!isGenreSelectionComplete()) {
            return;
        }

        // Check if there's substantial content and confirm replacement
        if (userInput.length > 5) {
            const confirmed = window.confirm('当前输入框有内容，是否要替换为新的创意？');
            if (!confirmed) {
                return;
            }
        }

        setIsGeneratingIdea(true);
        setError(null);

        try {
            const genreString = buildGenrePromptString();
            const prompt = ideaGenerationTemplate
                .replace('{genre}', genreString)
                .replace('{platform}', selectedPlatform || '通用短视频平台');

            const response = await fetch('/llm-api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    stream: false, // Explicitly disable streaming
                    response_format: { type: 'json_object' } // Ensure JSON output
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            // Parse as regular JSON response
            const data = await response.json();

            // Extract the content from the response
            let ideasArray: string[] = [];
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                const contentText = data.choices[0].message.content.trim();
                try {
                    ideasArray = JSON.parse(contentText);
                    if (!Array.isArray(ideasArray) || ideasArray.some(item => typeof item !== 'string') || ideasArray.length === 0) {
                        throw new Error('响应不是一个包含字符串的有效非空数组');
                    }
                } catch (parseError) {
                    console.error('Failed to parse ideas JSON:', parseError);
                    console.log('Raw content for ideas:', contentText);
                    // Try to repair if simple parse fails, e.g. if LLM adds ```json wrapper
                    try {
                        const repairedJson = jsonrepair(contentText);
                        ideasArray = JSON.parse(repairedJson);
                        if (!Array.isArray(ideasArray) || ideasArray.some(item => typeof item !== 'string') || ideasArray.length === 0) {
                            throw new Error('修复后的响应仍然不是一个包含字符串的有效非空数组');
                        }
                    } catch (repairError) {
                        console.error('Failed to parse ideas JSON even after repair:', repairError);
                        throw new Error('无法解析生成的创意为JSON数组');
                    }
                }
            } else {
                throw new Error('无法从响应中提取内容');
            }

            if (ideasArray.length > 0 && ideasArray[0] && ideasArray[0].length > 0) {
                setGeneratedIdeas(ideasArray);
                setSelectedIdeaIndex(0);
                setUserInput(ideasArray[0]); // Use the first idea
                console.log("Generated ideas:", ideasArray); // Log all ideas
            } else {
                throw new Error('生成的创意内容为空或格式不正确');
            }

        } catch (err) {
            console.error('Error generating idea:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsGeneratingIdea(false);
        }
    };

    const generateIdeation = async () => {
        if (!userInput.trim()) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        // Create a new AbortController for this request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // Create the prompt by replacing placeholders in the template
            const fullPrompt = ideationTemplate
                .replace('{user_input}', userInput)
                .replace('{platform}', selectedPlatform || '未指定')
                .replace('{genre}', buildGenrePromptString() || '未指定');

            const response = await fetch('/llm-api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'user', content: fullPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    stream: false // Explicitly disable streaming
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText} `);
            }

            // Parse as regular JSON response
            const data = await response.json();

            // Extract the content from the response
            let contentText = '';
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                contentText = data.choices[0].message.content.trim();
            } else {
                throw new Error('无法从响应中提取内容');
            }

            // Parse the content as JSON (since we requested JSON format)
            try {
                const jsonResult = JSON.parse(contentText) as IdeationResponse;
                setResult(jsonResult);
            } catch (parseError) {
                // If JSON parsing fails, try with jsonrepair
                try {
                    const repairedJson = jsonrepair(contentText);
                    const jsonResult = JSON.parse(repairedJson) as IdeationResponse;
                    setResult(jsonResult);
                } catch (repairError) {
                    console.error('Failed to parse JSON even after repair:', repairError);
                    console.log('Raw content:', contentText);
                    setError(new Error('响应格式不正确，无法解析为JSON'));
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Request was aborted');
            } else {
                console.error('Error generating ideation:', err);
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
        <div style={{ padding: '20px', maxWidth: '600px', width: "100%", margin: '0 auto', overflow: "auto" }}>
            <Title level={4}>灵感生成器</Title>
            <Paragraph>
                输入你的灵感，AI将帮你构建故事情节提要。
            </Paragraph>

            <div style={{ marginBottom: '16px' }}>
                <Text strong>目标平台:</Text>
                <Select
                    style={{ width: '100%' }}
                    placeholder="选择目标平台"
                    options={platformOptions}
                    value={selectedPlatform}
                    onChange={handlePlatformChange}
                />
            </div>

            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>故事类型:</Text>
                <div
                    onClick={() => setGenrePopupVisible(true)}
                    style={{
                        border: '1px solid #434343',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        minHeight: '32px',
                        cursor: 'pointer',
                        background: '#141414',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#434343'}
                >
                    {selectedGenrePaths.length > 0 ? (
                        <span
                            style={{ color: '#d9d9d9', cursor: 'pointer' }}
                            onClick={() => setGenrePopupVisible(true)}
                        >
                            {/* Render the array of elements from buildGenreDisplayElements */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                {buildGenreDisplayElements()}
                            </div>
                        </span>
                    ) : (
                        <span
                            style={{ color: '#666', cursor: 'pointer' }}
                            onClick={() => setGenrePopupVisible(true)}
                        >
                            点击选择故事类型 (可多选, 最多3个)
                        </span>
                    )}
                    <RightOutlined style={{ fontSize: '12px', color: '#666' }} />
                </div>
            </div>

            <GenreSelectionPopup
                visible={genrePopupVisible}
                onClose={() => setGenrePopupVisible(false)}
                onSelect={handleGenreSelectionConfirm}
                currentSelectionPaths={selectedGenrePaths}
            />

            {/* Only show subsequent elements when genre selection is complete */}
            {isGenreSelectionComplete() ? (
                <>
                    <Divider style={{ margin: '24px 0' }} />

                    {/* Idea Generator Section */}
                    <div style={{
                        marginBottom: '24px',
                        textAlign: 'center',
                        padding: '16px',
                        background: '#1a1a1a',
                        borderRadius: '8px',
                        border: '1px solid #303030'
                    }}>
                        <Text strong style={{ display: 'block', marginBottom: '12px', color: '#d9d9d9' }}>
                            创意生成器
                        </Text>
                        <Text type="secondary" style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}>
                            基于选择的类型生成创意灵感
                        </Text>
                        <Button
                            type="primary"
                            size="large"
                            onClick={generateIdea}
                            loading={isGeneratingIdea}
                            style={{
                                background: '#52c41a',
                                borderColor: '#52c41a',
                                fontSize: '16px',
                                height: '40px',
                                minWidth: '120px'
                            }}
                        >
                            <span style={{ marginRight: '8px' }}>🎲</span>
                            {isGeneratingIdea ? '生成中...' : '随机创意'}
                        </Button>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <Text strong style={{ display: 'block', marginBottom: '8px' }}>创作灵感:</Text>

                        {/* Generated Ideas Cards */}
                        {generatedIdeas.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                                    选择一个创意（点击卡片选择）:
                                </Text>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(250px, 1fr))',
                                    gap: '8px',
                                    marginBottom: '16px'
                                }}>
                                    {generatedIdeas.map((idea, index) => (
                                        <div
                                            key={index}
                                            onClick={() => handleIdeaSelection(index)}
                                            style={{
                                                padding: '12px',
                                                border: selectedIdeaIndex === index ? '2px solid #1890ff' : '1px solid #434343',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                backgroundColor: selectedIdeaIndex === index ? '#1890ff10' : '#1a1a1a',
                                                transition: 'all 0.3s',
                                                position: 'relative'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedIdeaIndex !== index) {
                                                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                                                    e.currentTarget.style.borderColor = '#666';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedIdeaIndex !== index) {
                                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                                    e.currentTarget.style.borderColor = '#434343';
                                                }
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                backgroundColor: selectedIdeaIndex === index ? '#1890ff' : '#666',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                {index + 1}
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                lineHeight: '1.4',
                                                paddingRight: '30px',
                                                color: selectedIdeaIndex === index ? '#d9d9d9' : '#bfbfbf'
                                            }}>
                                                {idea}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Editable textarea for selected/modified idea */}
                        <div>
                            <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                                {generatedIdeas.length > 0 ? '编辑选中的创意:' : '输入你的创作灵感:'}
                            </Text>
                            <TextArea
                                rows={4}
                                value={userInput}
                                onChange={handleInputChange}
                                placeholder={generatedIdeas.length > 0 ? "编辑选中的创意..." : "输入你的创作灵感..."}
                                disabled={isLoading || isGeneratingIdea}
                                style={{
                                    background: isGeneratingIdea ? '#2a2a2a' : undefined,
                                    borderColor: isGeneratingIdea ? '#52c41a' : undefined
                                }}
                            />
                        </div>
                    </div>

                    {/* Only show generate button when there's text input */}
                    {userInput.trim() && (
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={generateIdeation}
                            loading={isLoading}
                            style={{ marginBottom: '24px', marginRight: '8px' }}
                        >
                            生成
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

                    {(isLoading || result) && (
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
                                        {''}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                /* Progress hint when genre selection is incomplete */
                <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#666',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #303030',
                    marginTop: '24px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>
                        请先完成故事类型选择以继续
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        需要选择完整的类型层级（至少3层）
                    </Text>
                </div>
            )}
        </div>
    );
};

export default IdeationTab; 