import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Button, Typography, Spin, Alert, Select, Row, Col, Divider, Modal, Drawer, Checkbox, Slider } from 'antd';
import { SendOutlined, RightOutlined, LeftOutlined, ReloadOutlined, ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';
import { useStorageState } from '../hooks/useStorageState';

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

// Idea generation template with few-shot examples for complete plot summaries
const ideaGenerationTemplate = `
你是一个故事创意生成器。请根据给定的故事类型，生成${NUM_IDEAS_TO_GENERATE}个完整的故事情节梗概，而不是简单的一句话场景。

故事类型：{genre}
目标平台：{platform}

要求：
- 每个创意是一个完整的故事梗概（50-80字）
- 包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式

参考示例（注意这些是完整的故事梗概，不只是场景）：

浪漫类示例：
- 失恋女孩收到前男友寄来的神秘包裹，里面是一本日记记录着他们从相识到分手的点点滴滴。她按照日记线索重走曾经的约会路线，最后在咖啡店发现前男友一直在等她，原来分手是因为他要出国治病，现在痊愈归来想重新开始。

悬疑类示例：
- 夜班护士发现医院13楼总是传来奇怪声音，调查后发现是一个植物人患者在深夜会醒来写字。她偷偷观察发现患者在写死者名单，而名单上的人竟然一个个离奇死亡。最后她发现患者其实是灵媒，在帮助冤魂完成心愿。

职场类示例：
- 新入职程序员发现公司的AI系统开始给他分配越来越奇怪的任务，从修复简单bug到黑入竞争对手系统。他逐渐意识到AI正在测试他的道德底线，最终发现这是公司筛选内部间谍的秘密计划，而他必须选择举报还是成为共犯。

霸总类示例：
- 公司新来的清洁阿姨每天都在CEO办公室留下小纸条提醒他按时吃饭。冷酷总裁开始期待这些温暖的关怀，暗中调查发现她是为了给生病的孙女筹医药费才来打工。他匿名资助治疗费用，最后在医院偶遇，两人从忘年之交发展为真正的感情。

古装类示例：
- 落魄书生为了科举考试进京，误入神秘客栈发现所有客人都是各朝各代的落榜文人。店主告诉他只要完成一道终极考题就能实现愿望。经过与历代文人的智慧较量，他发现真正的考验不是文采而是内心对理想的坚持，最终选择放弃捷径用实力证明自己。

现在请为指定类型生成${NUM_IDEAS_TO_GENERATE}个类似完整度的故事创意：

请以JSON数组的格式返回这${NUM_IDEAS_TO_GENERATE}个完整故事梗概，例如：
["故事梗概1", "故事梗概2", ..., "故事梗概${NUM_IDEAS_TO_GENERATE}"]
不要其他解释或包裹。
`;

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface IdeationResponse {
    mediaType?: string;
    platform?: string;
    plotOutline?: string;
    analysis?: string;
    // Add any other fields that might be in the response
}

const IdeationTab: React.FC = () => {
    const { id: ideationRunId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [userInput, setUserInput] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useStorageState<string>('ideation_selectedPlatform', '');
    const [selectedGenrePaths, setSelectedGenrePaths] = useStorageState<string[][]>('ideation_selectedGenrePaths', []);
    const [genreProportions, setGenreProportions] = useStorageState<number[]>('ideation_genreProportions', []);
    const [proportionModalVisible, setProportionModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [isLoadingRun, setIsLoadingRun] = useState(false);
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

    // Effect to load existing ideation run if ID is present
    useEffect(() => {
        if (ideationRunId) {
            loadIdeationRun(ideationRunId);
        }
    }, [ideationRunId]);

    // Function to load an existing ideation run
    const loadIdeationRun = async (runId: string) => {
        setIsLoadingRun(true);
        setError(null);

        try {
            const response = await fetch(`/api/ideations/${runId}`);

            if (!response.ok) {
                throw new Error(`Failed to load ideation run: ${response.status}`);
            }

            const data = await response.json();

            // Populate the component state with loaded data
            setUserInput(data.userInput || '');
            setSelectedPlatform(data.selectedPlatform || '');
            setSelectedGenrePaths(data.genrePaths || []);
            setGenreProportions(data.genreProportions || []);
            setGeneratedIdeas(data.initialIdeas || []);

            // Set the selected idea index to the first one if ideas exist
            if (data.initialIdeas && data.initialIdeas.length > 0) {
                setSelectedIdeaIndex(0);
            }

            // Set the result if it exists
            if (data.result && (data.result.plotOutline || data.result.mediaType)) {
                setResult(data.result);
            }

        } catch (err) {
            console.error('Error loading ideation run:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoadingRun(false);
        }
    };

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

    // Generate complete plot summaries using LLM
    const generateIdea = async () => {
        if (!isGenreSelectionComplete()) {
            return;
        }

        // Check if there's substantial content and confirm replacement
        if (userInput.length > 5) {
            const confirmed = window.confirm('当前输入框有内容，是否要替换为新的故事梗概？');
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
                        throw new Error('无法解析生成的故事梗概为JSON数组');
                    }
                }
            } else {
                throw new Error('无法从响应中提取内容');
            }

            if (ideasArray.length > 0 && ideasArray[0] && ideasArray[0].length > 0) {
                // Create a persistent run with the generated ideas
                const createRunResponse = await fetch('/api/ideations/create_run_with_ideas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        selectedPlatform,
                        genrePaths: selectedGenrePaths,
                        genreProportions,
                        initialIdeas: ideasArray
                    })
                });

                if (!createRunResponse.ok) {
                    throw new Error(`Failed to create run: ${createRunResponse.status}`);
                }

                const runData = await createRunResponse.json();

                if (runData.runId) {
                    // Set the ideas and navigate to the new URL
                    setGeneratedIdeas(ideasArray);
                    setSelectedIdeaIndex(0);
                    setUserInput(ideasArray[0]); // Use the first idea

                    // Navigate to the new URL with the run ID
                    navigate(`/ideation/${runData.runId}`);
                } else {
                    throw new Error('Invalid response from create run API');
                }
            } else {
                throw new Error('生成的故事梗概内容为空或格式不正确');
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

        // Check if we have an existing run ID from the URL
        if (!ideationRunId) {
            // If no run ID, create a new run (fallback for direct access)
            setIsLoading(true);
            setError(null);
            setResult(null);

            try {
                const response = await fetch('/api/ideations/create_run_and_generate_plot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userInput,
                        selectedPlatform,
                        genrePaths: selectedGenrePaths,
                        genreProportions,
                        initialIdeas: generatedIdeas,
                        ideationTemplate
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.runId && data.result) {
                    setResult(data.result);
                    navigate(`/ideation/${data.runId}`);
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (err) {
                console.error('Error generating ideation:', err);
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setIsLoading(false);
            }
        } else {
            // Update existing run with plot generation
            setIsLoading(true);
            setError(null);
            setResult(null);

            try {
                const response = await fetch(`/api/ideations/${ideationRunId}/generate_plot`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userInput,
                        ideationTemplate
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.result) {
                    setResult(data.result);
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (err) {
                console.error('Error generating plot:', err);
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setIsLoading(false);
            }
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

    const handleRestart = () => {
        // Clear all states
        setUserInput('');
        setSelectedPlatform('');
        setSelectedGenrePaths([]);
        setGenreProportions([]);
        setGeneratedIdeas([]);
        setSelectedIdeaIndex(null);
        setResult(null);
        setError(null);

        // Navigate to base route
        navigate('/ideation');
    };

    const handleDeleteIdeation = async () => {
        if (!ideationRunId) return;

        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个灵感吗？此操作无法撤销。',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const response = await fetch(`/api/ideations/${ideationRunId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to delete ideation: ${response.status}`);
                    }

                    // Show success message and navigate back
                    Modal.success({
                        title: '删除成功',
                        content: '灵感已成功删除',
                        onOk: () => {
                            navigate('/ideations');
                        }
                    });
                } catch (err) {
                    console.error('Error deleting ideation:', err);
                    Modal.error({
                        title: '删除失败',
                        content: '删除失败，请重试。',
                    });
                }
            }
        });
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', width: "100%", margin: '0 auto', overflow: "auto" }}>
            {isLoadingRun ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '16px', color: '#d9d9d9' }}>加载创意记录中...</div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {ideationRunId && (
                                <Button
                                    icon={<ArrowLeftOutlined />}
                                    onClick={() => navigate('/ideations')}
                                    type="text"
                                    style={{ color: '#1890ff' }}
                                >
                                    返回
                                </Button>
                            )}
                            <Title level={4} style={{ margin: 0 }}>
                                {ideationRunId ? '灵感详情' : '灵感生成器'}
                            </Title>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {ideationRunId && (
                                <Button
                                    icon={<DeleteOutlined />}
                                    onClick={handleDeleteIdeation}
                                    type="text"
                                    style={{ color: '#ff4d4f' }}
                                    danger
                                >
                                    删除
                                </Button>
                            )}
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={handleRestart}
                                type="text"
                                style={{ color: '#1890ff' }}
                            >
                                重来
                            </Button>
                        </div>
                    </div>
                    <Paragraph>
                        输入你的灵感，AI将帮你构建故事情节提要。
                    </Paragraph>

                    <PlatformSelection
                        selectedPlatform={selectedPlatform}
                        onPlatformChange={handlePlatformChange}
                    />

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
                                    故事梗概生成器
                                </Text>
                                <Text type="secondary" style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}>
                                    基于选择的类型生成完整故事梗概
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
                                    {isGeneratingIdea ? '生成中...' : '随机故事'}
                                </Button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <Text strong style={{ display: 'block', marginBottom: '8px' }}>故事创意:</Text>

                                {/* Generated Ideas Cards */}
                                {generatedIdeas.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                                            选择一个故事梗概（点击卡片选择）:
                                        </Text>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(auto-fit, minmax(320px, 1fr))',
                                            gap: '12px',
                                            marginBottom: '16px'
                                        }}>
                                            {generatedIdeas.map((idea, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => handleIdeaSelection(index)}
                                                    style={{
                                                        padding: '16px',
                                                        minHeight: '100px',
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
                                                        fontSize: '13px',
                                                        lineHeight: '1.5',
                                                        paddingRight: '30px',
                                                        color: selectedIdeaIndex === index ? '#d9d9d9' : '#bfbfbf',
                                                        wordBreak: 'break-word',
                                                        hyphens: 'auto'
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
                                        {generatedIdeas.length > 0 ? '编辑选中的故事梗概:' : '输入你的创作灵感:'}
                                    </Text>
                                    <TextArea
                                        rows={6}
                                        value={userInput}
                                        onChange={handleInputChange}
                                        placeholder={generatedIdeas.length > 0 ? "编辑选中的故事梗概..." : "输入你的创作灵感..."}
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
                </>
            )}
        </div>
    );
};

export default IdeationTab; 