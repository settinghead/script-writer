import React, { useState, useEffect } from 'react';
import { Button, Typography, Select, Divider, Alert, Input } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';
import { useStorageState } from '../hooks/useStorageState';

const NUM_IDEAS_TO_GENERATE = 6;

// Idea generation template with few-shot examples for complete plot summaries
const ideaGenerationTemplate = `
你是一个故事创意生成器。请根据给定的故事类型，生成${NUM_IDEAS_TO_GENERATE}个完整的故事情节梗概灵感。

故事类型：{genre}
目标平台：{platform}
{requirementsSection}

要求：
- 每个创意是一个完整的故事梗概灵感（50-80字）
- 包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式

参考示例（注意灵感应该是一个完整但是高度概括的故事梗概，而不是简单的一句话场景）：

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

请以JSON数组的格式返回这${NUM_IDEAS_TO_GENERATE}个灵感，例如：
["故事灵感1", "故事灵感2", ..., "故事灵感${NUM_IDEAS_TO_GENERATE}"]
不要其他解释或包裹。
`;

const { Text } = Typography;

interface BrainstormingPanelProps {
    isCollapsed: boolean;
    onIdeaSelect: (idea: string) => void;
    onDataChange: (data: {
        selectedPlatform: string;
        selectedGenrePaths: string[][];
        genreProportions: number[];
        generatedIdeas: string[];
        generatedIdeaArtifacts: Array<{ id: string, text: string, orderIndex: number }>;
        requirements: string;
    }) => void;
    onRunCreated?: (runId: string) => void; // New callback for when a run is created
    // Initial values for loading existing data
    initialPlatform?: string;
    initialGenrePaths?: string[][];
    initialGenreProportions?: number[];
    initialGeneratedIdeas?: string[];
    initialRequirements?: string;
}

const BrainstormingPanel: React.FC<BrainstormingPanelProps> = ({
    isCollapsed,
    onIdeaSelect,
    onDataChange,
    onRunCreated,
    initialPlatform = '',
    initialGenrePaths = [],
    initialGenreProportions = [],
    initialGeneratedIdeas = [],
    initialRequirements = ''
}) => {
    const [selectedPlatform, setSelectedPlatform] = useStorageState<string>('ideation_selectedPlatform', initialPlatform);
    const [selectedGenrePaths, setSelectedGenrePaths] = useStorageState<string[][]>('ideation_selectedGenrePaths', initialGenrePaths);
    const [genreProportions, setGenreProportions] = useStorageState<number[]>('ideation_genreProportions', initialGenreProportions);
    const [requirements, setRequirements] = useStorageState<string>('ideation_requirements', initialRequirements);
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>(initialGeneratedIdeas);
    const [generatedIdeaArtifacts, setGeneratedIdeaArtifacts] = useState<Array<{ id: string, text: string, orderIndex: number }>>([]);
    const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Effect to handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Notify parent of data changes
    useEffect(() => {
        onDataChange({
            selectedPlatform,
            selectedGenrePaths,
            genreProportions,
            generatedIdeas,
            generatedIdeaArtifacts,
            requirements
        });
    }, [selectedPlatform, selectedGenrePaths, genreProportions, generatedIdeas, generatedIdeaArtifacts, requirements]);

    const handlePlatformChange = (value: string) => {
        setSelectedPlatform(value);
    };

    const handleGenreSelectionConfirm = (selection: { paths: string[][]; proportions: number[] }) => {
        setSelectedGenrePaths(selection.paths);
        setGenreProportions(selection.proportions);
        setGenrePopupVisible(false);
    };

    // Handle idea card selection
    const handleIdeaSelection = (index: number) => {
        setSelectedIdeaIndex(index);
        onIdeaSelect(generatedIdeas[index]);
    };

    // Check if genre selection is complete
    const isGenreSelectionComplete = () => {
        if (selectedGenrePaths.length === 0) {
            return false;
        }
        return selectedGenrePaths.every(path => path.length >= 3);
    };

    // Build genre string for display
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

    // Function to build the genre string for the LLM prompt
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

        setIsGeneratingIdea(true);
        setError(null);

        try {
            const genreString = buildGenrePromptString();
            const requirementsSection = requirements.trim()
                ? `特殊要求：${requirements.trim()}`
                : '';
            const prompt = ideaGenerationTemplate
                .replace('{genre}', genreString)
                .replace('{platform}', selectedPlatform || '通用短视频平台')
                .replace('{requirementsSection}', requirementsSection);

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
                    stream: false,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

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
                    try {
                        const repairedJson = jsonrepair(contentText);
                        ideasArray = JSON.parse(repairedJson);
                        if (!Array.isArray(ideasArray) || ideasArray.some(item => typeof item !== 'string') || ideasArray.length === 0) {
                            throw new Error('修复后的响应仍然不是一个包含字符串的有效非空数组');
                        }
                    } catch (repairError) {
                        console.error('Failed to parse ideas JSON even after repair:', repairError);
                        throw new Error('无法解析生成的故事灵感为JSON数组');
                    }
                }
            } else {
                throw new Error('无法从响应中提取内容');
            }

            if (ideasArray.length > 0 && ideasArray[0] && ideasArray[0].length > 0) {
                setGeneratedIdeas(ideasArray);
                setSelectedIdeaIndex(null); // Reset selection

                // Create ideation run after successful idea generation
                if (onRunCreated) {
                    try {
                        const createRunResponse = await fetch('/api/ideations/create_run_with_ideas', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                selectedPlatform,
                                genrePaths: selectedGenrePaths,
                                genreProportions,
                                initialIdeas: ideasArray,
                                requirements
                            })
                        });

                        if (!createRunResponse.ok) {
                            throw new Error(`Failed to create run: ${createRunResponse.status}`);
                        }

                        const runData = await createRunResponse.json();
                        if (runData.runId) {
                            // Store the artifact data from the response
                            if (runData.initialIdeaArtifacts && Array.isArray(runData.initialIdeaArtifacts)) {
                                setGeneratedIdeaArtifacts(runData.initialIdeaArtifacts);
                            }
                            onRunCreated(runData.runId);
                        }
                    } catch (runError) {
                        console.error('Error creating ideation run:', runError);
                        // Don't throw here - we still want to show the ideas even if run creation fails
                    }
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

    if (isCollapsed) {
        return (
            <div style={{
                padding: '8px 12px',
                background: '#1a1a1a',
                borderRadius: '6px',
                border: '1px solid #303030',
                marginBottom: '16px'
            }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 已选择故事灵感 {selectedIdeaIndex !== null ? `#${selectedIdeaIndex + 1}` : ''}
                </Text>
            </div>
        );
    }

    return (
        <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #303030',
            marginBottom: '24px'
        }}>
            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                    💡 头脑风暴
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>
                    选择平台和类型，生成故灵感
                </Text>
            </div>

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
                        <span style={{ color: '#d9d9d9', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                {buildGenreDisplayElements()}
                            </div>
                        </span>
                    ) : (
                        <span style={{ color: '#666', cursor: 'pointer' }}>
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

            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>特殊要求:</Text>
                <Input
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="可以留空，或添加具体要求，例如：要狗血、要反转、要搞笑等"
                    style={{
                        background: '#141414',
                        border: '1px solid #434343',
                        borderRadius: '6px'
                    }}
                />
                <Text type="secondary" style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    AI将根据您的特殊要求来生成故事灵感
                </Text>
            </div>

            {isGenreSelectionComplete() && (
                <>
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
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
                            <span style={{ marginRight: '8px' }}>💡</span>
                            {isGeneratingIdea ? '头脑风暴中...' : '开始头脑风暴'}
                        </Button>
                    </div>

                    {error && (
                        <Alert
                            message="生成失败"
                            description={error.message}
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {generatedIdeas.length > 0 && (
                        <div>
                            <Text type="secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                                选择一个故事灵感（点击卡片选择）:
                            </Text>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(auto-fit, minmax(320px, 1fr))',
                                gap: '12px'
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
                                            backgroundColor: selectedIdeaIndex === index ? '#1890ff10' : '#2a2a2a',
                                            transition: 'all 0.3s',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedIdeaIndex !== index) {
                                                e.currentTarget.style.backgroundColor = '#333';
                                                e.currentTarget.style.borderColor = '#666';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedIdeaIndex !== index) {
                                                e.currentTarget.style.backgroundColor = '#2a2a2a';
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
                </>
            )}

            {!isGenreSelectionComplete() && (
                <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#666',
                    fontSize: '14px'
                }}>
                    请先完成故事类型选择以开始头脑风暴
                </div>
            )}
        </div>
    );
};

export default BrainstormingPanel; 