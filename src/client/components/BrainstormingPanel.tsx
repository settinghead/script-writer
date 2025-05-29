import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Select, Divider, Alert, Input, Progress } from 'antd';
import { BulbOutlined, RightOutlined, StopOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';
import { useStorageState } from '../hooks/useStorageState';
import { useStreamingBrainstorm } from '../hooks/useStreamingBrainstorm';
import { IdeaWithTitle } from '../services/implementations/BrainstormingStreamingService';

// Idea generation template with few-shot examples for complete plot summaries
const ideaGenerationTemplate = `
你是一个故事创意生成器。请根据给定的故事类型，生成多个完整的故事情节梗概灵感。

故事类型：{genre}
目标平台：{platform}
{requirementsSection}

要求：
- 每个创意包含一个标题（3-7个字符）和一个完整的故事梗概灵感（50-80字）
- 故事梗概包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式

参考示例（注意灵感应该是一个完整但是高度概括的故事梗概，而不是简单的一句话场景）：

浪漫类示例：
- 标题：神秘包裹 | 故事：失恋女孩收到前男友寄来的神秘包裹，里面是一本日记记录着他们从相识到分手的点点滴滴。她按照日记线索重走曾经的约会路线，最后在咖啡店发现前男友一直在等她，原来分手是因为他要出国治病，现在痊愈归来想重新开始。

悬疑类示例：
- 标题：午夜病房 | 故事：夜班护士发现医院13楼总是传来奇怪声音，调查后发现是一个植物人患者在深夜会醒来写字。她偷偷观察发现患者在写死者名单，而名单上的人竟然一个个离奇死亡。最后她发现患者其实是灵媒，在帮助冤魂完成心愿。

职场类示例：
- 标题：AI测试 | 故事：新入职程序员发现公司的AI系统开始给他分配越来越奇怪的任务，从修复简单bug到黑入竞争对手系统。他逐渐意识到AI正在测试他的道德底线，最终发现这是公司筛选内部间谍的秘密计划，而他必须选择举报还是成为共犯。

霸总类示例：
- 标题：纸条温情 | 故事：公司新来的清洁阿姨每天都在CEO办公室留下小纸条提醒他按时吃饭。冷酷总裁开始期待这些温暖的关怀，暗中调查发现她是为了给生病的孙女筹医药费才来打工。他匿名资助治疗费用，最后在医院偶遇，两人从忘年之交发展为真正的感情。

古装类示例：
- 标题：神秘客栈 | 故事：落魄书生为了科举考试进京，误入神秘客栈发现所有客人都是各朝各代的落榜文人。店主告诉他只要完成一道终极考题就能实现愿望。经过与历代文人的智慧较量，他发现真正的考验不是文采而是内心对理想的坚持，最终选择放弃捷径用实力证明自己。

现在请为指定类型生成多个类似完整度的故事创意：

请以JSON数组的格式返回这些灵感，每个元素包含title和body字段，例如：
[
  {"title": "标题1", "body": "故事梗概1"},
  {"title": "标题2", "body": "故事梗概2"},
  ...
]
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
        generatedIdeas: IdeaWithTitle[];
        generatedIdeaArtifacts: Array<{ id: string, text: string, title?: string, orderIndex: number }>;
        requirements: string;
    }) => void;
    onRunCreated?: (runId: string) => void; // New callback for when a run is created
    onExpand?: () => void; // New callback for expanding the panel
    // Initial values for loading existing data
    initialPlatform?: string;
    initialGenrePaths?: string[][];
    initialGenreProportions?: number[];
    initialGeneratedIdeas?: IdeaWithTitle[];
    initialRequirements?: string;
}

const BrainstormingPanel: React.FC<BrainstormingPanelProps> = ({
    isCollapsed,
    onIdeaSelect,
    onDataChange,
    onRunCreated,
    onExpand,
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
    const [generatedIdeas, setGeneratedIdeas] = useState<IdeaWithTitle[]>(initialGeneratedIdeas || []);
    const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isSelectingIdea, setIsSelectingIdea] = useState(false);

    // Use the new RxJS-based streaming hook
    const { status, items, error, start, stop } = useStreamingBrainstorm();

    // Update generated ideas when streaming items change
    useEffect(() => {
        if (items.length > 0) {
            setGeneratedIdeas(items);
        }
    }, [items]);

    // Handle completion - ensure ideas persist when streaming finishes
    useEffect(() => {
        if (status === 'completed' && items.length === 0 && generatedIdeas.length > 0) {
            // Ideas were cleared from streaming but we have them in state - keep them
            // This handles the case where the streaming service resets items on completion
        } else if (status === 'completed' && items.length > 0) {
            // Final update on completion
            setGeneratedIdeas(items);
        }
    }, [status, items, generatedIdeas.length]);

    // Update data change callback when relevant state changes
    useEffect(() => {
        onDataChange({
            selectedPlatform,
            selectedGenrePaths,
            genreProportions,
            generatedIdeas,
            generatedIdeaArtifacts: generatedIdeas.map((idea, index) => ({
                id: `idea-${index}`,
                text: typeof idea === 'string' ? idea : `${idea.title}: ${idea.body}`,
                title: typeof idea === 'object' ? idea.title : undefined,
                orderIndex: index
            })),
            requirements
        });
    }, [selectedPlatform, selectedGenrePaths, genreProportions, generatedIdeas, requirements, onDataChange]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handlePlatformChange = (value: string) => {
        setSelectedPlatform(value);
    };

    const handleGenreSelectionConfirm = (selection: { paths: string[][]; proportions: number[] }) => {
        setSelectedGenrePaths(selection.paths);
        setGenreProportions(selection.proportions);
        setGenrePopupVisible(false);
    };

    const handleIdeaSelection = (index: number) => {
        if (isSelectingIdea) return; // Prevent multiple selections

        setIsSelectingIdea(true);
        setSelectedIdeaIndex(index);
        const idea = generatedIdeas[index];
        const ideaText = typeof idea === 'string' ? idea : `${idea.title}: ${idea.body}`;

        // Add a small delay to allow the selection animation to be visible
        setTimeout(() => {
            onIdeaSelect(ideaText);
            setIsSelectingIdea(false);
        }, 300);
    };

    const isGenreSelectionComplete = () => {
        return selectedGenrePaths.length > 0 && selectedGenrePaths.every(path => path.length > 0);
    };

    const buildGenreDisplayElements = (): (JSX.Element | string)[] => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            const proportion = genreProportions[index];
            const proportionText = proportion ? ` (${proportion}%)` : '';

            return (
                <span key={index} style={{ marginRight: '8px', marginBottom: '4px', display: 'inline-block' }}>
                    {genreText}{proportionText}
                    {index < selectedGenrePaths.length - 1 && ', '}
                </span>
            );
        });
    };

    const buildGenrePromptString = (): string => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            const proportion = genreProportions[index];
            return proportion ? `${genreText} (${proportion}%)` : genreText;
        }).join(', ');
    };

    const generateIdea = async () => {
        if (!isGenreSelectionComplete()) {
            return;
        }

        // Clear previous ideas
        setGeneratedIdeas([]);

        try {
            const genreString = buildGenrePromptString();
            const requirementsSection = requirements.trim()
                ? `特殊要求：${requirements.trim()}`
                : '';

            await start({
                artifactIds: [],
                templateId: 'brainstorming',
                templateParams: {
                    genre: genreString,
                    platform: selectedPlatform || '通用短视频平台',
                    requirementsSection
                },
                modelName: 'deepseek-chat'
            });

        } catch (err) {
            console.error('Error generating idea:', err);
        }
    };

    if (isCollapsed) {
        return (
            <div
                onClick={onExpand}
                style={{
                    padding: '8px 12px',
                    background: '#1a1a1a',
                    borderRadius: '6px',
                    border: '1px solid #303030',
                    marginBottom: '16px',
                    transition: 'all 0.3s ease-in-out',
                    animation: 'fadeIn 0.3s ease-in-out',
                    cursor: onExpand ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                    if (onExpand) {
                        e.currentTarget.style.background = '#262626';
                        e.currentTarget.style.borderColor = '#1890ff';
                    }
                }}
                onMouseLeave={(e) => {
                    if (onExpand) {
                        e.currentTarget.style.background = '#1a1a1a';
                        e.currentTarget.style.borderColor = '#303030';
                    }
                }}
            >
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 已选择故事灵感 {selectedIdeaIndex !== null && generatedIdeas[selectedIdeaIndex]
                        ? `「${generatedIdeas[selectedIdeaIndex].title}」`
                        : ''
                    }
                </Text>
                {onExpand && (
                    <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the div's onClick
                            onExpand();
                        }}
                        style={{
                            color: '#1890ff',
                            fontSize: '12px',
                            padding: '0 4px',
                            height: 'auto',
                            lineHeight: '1'
                        }}
                    >
                        重新选择
                    </Button>
                )}
            </div>
        );
    }

    // Check if ideas have been generated
    const hasGeneratedIdeas = generatedIdeas.length > 0;
    const isStreaming = status === 'streaming';

    return (
        <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #303030',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'all 0.3s ease-in-out',
            overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '400px', maxWidth: '600px', }}>
                <style>
                    {`
                    @keyframes blink {
                        0%, 50% { opacity: 1; }
                        51%, 100% { opacity: 0; }
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 0.4; }
                        50% { opacity: 1; }
                    }
                    @keyframes selectPulse {
                        0% { transform: scale(1.02); box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2); }
                        50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(24, 144, 255, 0.4); }
                        100% { transform: scale(1.02); box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2); }
                    }
                    @keyframes slideDown {
                        from { 
                            opacity: 0; 
                            transform: translateY(-20px);
                            max-height: 0;
                        }
                        to { 
                            opacity: 1; 
                            transform: translateY(0);
                            max-height: 1000px;
                        }
                    }
                    @keyframes slideUp {
                        from { 
                            opacity: 1; 
                            transform: translateY(0);
                            max-height: 1000px;
                        }
                        to { 
                            opacity: 0; 
                            transform: translateY(-20px);
                            max-height: 0;
                        }
                    }
                    .brainstorm-content {
                        animation: ${isCollapsed ? 'slideUp' : 'slideDown'} 0.3s ease-in-out;
                        opacity: ${isCollapsed ? 0 : 1};
                        transform: translateY(${isCollapsed ? '-20px' : '0'});
                        transition: all 0.3s ease-in-out;
                    }
                `}
                </style>
                <div style={{ marginBottom: '16px' }}>
                    <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                        💡 头脑风暴
                    </Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>
                        {hasGeneratedIdeas ? '已生成故事灵感' : '选择平台和类型，生成故事灵感'}
                    </Text>
                </div>

                <div className="brainstorm-content">
                    {/* Show interactive controls only if no ideas have been generated */}
                    {!hasGeneratedIdeas && (
                        <>
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
                        </>
                    )}

                    {/* Show read-only display if ideas have been generated */}
                    {hasGeneratedIdeas && (
                        <div style={{ minWidth: '400px', maxWidth: '600px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <Text strong style={{ display: 'block', marginBottom: '8px', color: '#d9d9d9' }}>平台:</Text>
                                <div style={{
                                    padding: '8px 12px',
                                    background: '#262626',
                                    border: '1px solid #404040',
                                    borderRadius: '6px',
                                    color: '#bfbfbf'
                                }}>
                                    {selectedPlatform || '未指定'}
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <Text strong style={{ display: 'block', marginBottom: '8px', color: '#d9d9d9' }}>故事类型:</Text>
                                <div style={{
                                    padding: '8px 12px',
                                    background: '#262626',
                                    border: '1px solid #404040',
                                    borderRadius: '6px',
                                    color: '#bfbfbf'
                                }}>
                                    {selectedGenrePaths.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            {buildGenreDisplayElements()}
                                        </div>
                                    ) : (
                                        '未指定'
                                    )}
                                </div>
                            </div>

                            {requirements && (
                                <div style={{ marginBottom: '16px' }}>
                                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#d9d9d9' }}>特殊要求:</Text>
                                    <div style={{
                                        padding: '8px 12px',
                                        background: '#262626',
                                        border: '1px solid #404040',
                                        borderRadius: '6px',
                                        color: '#bfbfbf'
                                    }}>
                                        {requirements}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error display */}
                    {error && (
                        <Alert
                            message="生成失败"
                            description={error.message}
                            type="error"
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {/* Generate button or streaming display */}
                    {!hasGeneratedIdeas && !isStreaming && (
                        <Button
                            type="primary"
                            icon={<BulbOutlined />}
                            onClick={generateIdea}
                            disabled={!isGenreSelectionComplete()}
                            style={{
                                width: '100%',
                                height: '40px',
                                background: isGenreSelectionComplete() ? '#1890ff' : '#434343',
                                borderColor: isGenreSelectionComplete() ? '#1890ff' : '#434343'
                            }}
                        >
                            生成故事灵感
                        </Button>
                    )}

                    {/* Show disabled generate button during streaming if no ideas yet */}
                    {!hasGeneratedIdeas && isStreaming && (
                        <Button
                            type="primary"
                            icon={<BulbOutlined />}
                            disabled={true}
                            style={{
                                width: '100%',
                                height: '40px',
                                background: '#434343',
                                borderColor: '#434343',
                                marginBottom: '16px'
                            }}
                        >
                            正在生成故事灵感...
                        </Button>
                    )}

                    {/* Streaming progress */}
                    {isStreaming && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <Text style={{ color: '#1890ff' }}>正在生成故事灵感...</Text>
                                <Button
                                    size="small"
                                    icon={<StopOutlined />}
                                    onClick={stop}
                                    style={{
                                        background: '#ff4d4f',
                                        borderColor: '#ff4d4f',
                                        color: 'white'
                                    }}
                                >
                                    停止
                                </Button>
                            </div>
                            <Progress percent={30} showInfo={false} strokeColor="#1890ff" />
                        </div>
                    )}

                    {/* Show regenerate button after completion */}
                    {hasGeneratedIdeas && (status === 'completed' || status === 'error') && (
                        <div style={{ marginTop: '16px' }}>
                            <Button
                                type="default"
                                icon={<BulbOutlined />}
                                onClick={() => {
                                    setGeneratedIdeas([]);
                                    generateIdea();
                                }}
                                style={{
                                    width: '100%',
                                    height: '40px',
                                    background: '#434343',
                                    borderColor: '#434343',
                                    color: '#d9d9d9'
                                }}
                            >
                                重新生成
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Display streaming ideas as they arrive - full width for multi-column */}
            {generatedIdeas.length > 0 && (
                <div style={{ marginTop: '16px', width: '100%' }}>
                    <Text strong style={{ display: 'block', marginBottom: '12px', color: '#d9d9d9' }}>
                        生成的故事灵感:
                    </Text>
                    <div style={{
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '12px'
                    }}>
                        {generatedIdeas.map((idea, index) => (
                            <div
                                key={index}
                                onClick={() => handleIdeaSelection(index)}
                                style={{
                                    padding: '12px',
                                    background: selectedIdeaIndex === index ? '#1890ff20' : '#262626',
                                    border: selectedIdeaIndex === index ? '1px solid #1890ff' : '1px solid #404040',
                                    borderRadius: '6px',
                                    cursor: isSelectingIdea ? 'wait' : 'pointer',
                                    transition: 'all 0.3s ease-in-out',
                                    animation: `fadeIn 0.5s ease-in${selectedIdeaIndex === index && isSelectingIdea ? ', selectPulse 0.6s ease-in-out' : ''}`,
                                    minHeight: '80px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transform: selectedIdeaIndex === index ? 'scale(1.02)' : 'scale(1)',
                                    boxShadow: selectedIdeaIndex === index ? '0 4px 12px rgba(24, 144, 255, 0.2)' : 'none',
                                    pointerEvents: isSelectingIdea ? 'none' : 'auto',
                                    opacity: isSelectingIdea && selectedIdeaIndex !== index ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedIdeaIndex !== index) {
                                        e.currentTarget.style.background = '#333333';
                                        e.currentTarget.style.transform = 'scale(1.01)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedIdeaIndex !== index) {
                                        e.currentTarget.style.background = '#262626';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }
                                }}
                            >
                                <Text strong style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px' }}>
                                    {idea.title}
                                </Text>
                                <Text style={{ color: '#bfbfbf', fontSize: '13px', lineHeight: '1.4', flex: 1 }}>
                                    {idea.body}
                                </Text>
                            </div>
                        ))}

                        {/* Show blinking cursor while streaming */}
                        {isStreaming && (
                            <div style={{
                                padding: '8px',
                                color: '#666',
                                fontSize: '14px',
                                gridColumn: '1 / -1',
                                textAlign: 'center'
                            }}>
                                <span style={{ animation: 'blink 1s infinite' }}>▋</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrainstormingPanel; 