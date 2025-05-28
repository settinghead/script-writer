import React, { useState, useEffect } from 'react';
import { Button, Typography, Select, Divider, Alert, Input } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';
import { useStorageState } from '../hooks/useStorageState';
import { useStreamingTransform } from '../hooks/useStreamingTransform';
import StreamingDisplay from './StreamingDisplay';

const NUM_IDEAS_TO_GENERATE = 6;

// Idea generation template with few-shot examples for complete plot summaries
const ideaGenerationTemplate = `
你是一个故事创意生成器。请根据给定的故事类型，生成${NUM_IDEAS_TO_GENERATE}个完整的故事情节梗概灵感。

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

现在请为指定类型生成${NUM_IDEAS_TO_GENERATE}个灵感，请以JSON数组的格式返回这${NUM_IDEAS_TO_GENERATE}个灵感，每个元素包含title和body字段，例如：
[
  {"title": "标题1", "body": "故事梗概1"},
  {"title": "标题2", "body": "故事梗概2"},
  ...
]
不要其他解释或包裹。
`;

const { Text } = Typography;

interface IdeaWithTitle {
    title: string;
    body: string;
}

interface BrainstormingPanelProps {
    selectedPlatform: string;
    selectedGenrePaths: string[][];
    genreProportions: number[];
    requirements: string;
    generatedIdeas: IdeaWithTitle[];
    selectedIdeaIndex: number | null;
    onPlatformChange: (platform: string) => void;
    onGenreChange: (paths: string[][], proportions: number[]) => void;
    onRequirementsChange: (requirements: string) => void;
    onIdeasGenerated: (ideas: IdeaWithTitle[]) => void;
    onIdeaSelect: (index: number) => void;
    onRunCreated?: (runId: string) => void;
}

const BrainstormingPanel: React.FC<BrainstormingPanelProps> = ({
    selectedPlatform,
    selectedGenrePaths,
    genreProportions,
    requirements,
    generatedIdeas,
    selectedIdeaIndex,
    onPlatformChange,
    onGenreChange,
    onRequirementsChange,
    onIdeasGenerated,
    onIdeaSelect,
    onRunCreated
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Streaming transform hook
    const {
        isStreaming,
        displayData,
        progress,
        error: streamingError,
        startStreaming,
        stopStreaming,
        cleanup
    } = useStreamingTransform({
        onComplete: (result) => {
            console.log('Brainstorm streaming completed:', result);
            setIsGenerating(false);

            // Create ideation run after successful generation
            if (onRunCreated && result.artifactIds) {
                // The streaming endpoint should return the run ID
                // For now, we'll use a placeholder
                onRunCreated('streaming-generated-run');
            }
        },
        onError: (error) => {
            console.error('Brainstorm streaming error:', error);
            setError(error);
            setIsGenerating(false);
        }
    });

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    // Update generated ideas when streaming data changes
    useEffect(() => {
        if (displayData && displayData.type === 'brainstorm' && displayData.ideas) {
            const ideas: IdeaWithTitle[] = displayData.ideas.map((idea: any) => ({
                title: idea.title,
                body: idea.content
            }));
            onIdeasGenerated(ideas);
        }
    }, [displayData, onIdeasGenerated]);

    const buildGenrePromptString = (): string => {
        if (!selectedGenrePaths || selectedGenrePaths.length === 0) return '未指定';
        return selectedGenrePaths.map((path, index) => {
            const proportion = genreProportions && genreProportions[index] !== undefined
                ? genreProportions[index]
                : (100 / selectedGenrePaths.length);
            const pathString = path.join(' > ');
            return selectedGenrePaths.length > 1
                ? `${pathString} (${proportion.toFixed(0)}%)`
                : pathString;
        }).join(', ');
    };

    const generateIdea = async () => {
        if (isGenerating || isStreaming) {
            console.warn('Already generating ideas, ignoring request');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const genreString = buildGenrePromptString();
            const requirementsSection = requirements.trim()
                ? `特殊要求：${requirements.trim()}`
                : '';

            // Start streaming generation
            await startStreaming('/api/streaming/brainstorm', {
                selectedPlatform,
                genrePaths: selectedGenrePaths,
                genreProportions,
                requirements,
                ideationTemplate: ideaGenerationTemplate
            });

        } catch (error) {
            console.error('Error starting brainstorm generation:', error);
            setError(error instanceof Error ? error.message : 'Failed to start generation');
            setIsGenerating(false);
        }
    };

    const handleStopGeneration = () => {
        stopStreaming();
        setIsGenerating(false);
    };

    const canGenerate = selectedPlatform && selectedGenrePaths.length > 0;
    const currentError = error || streamingError;

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <BulbOutlined style={{ fontSize: '20px', marginRight: '8px', color: '#1890ff' }} />
                <Text strong style={{ fontSize: '16px' }}>智能头脑风暴</Text>
            </div>

            {/* Platform Selection */}
            <PlatformSelection
                selectedPlatform={selectedPlatform}
                onPlatformChange={onPlatformChange}
            />

            <Divider />

            {/* Genre Selection */}
            <GenreSelectionPopup
                selectedGenrePaths={selectedGenrePaths}
                genreProportions={genreProportions}
                onGenreChange={onGenreChange}
            />

            <Divider />

            {/* Requirements Input */}
            <div style={{ marginBottom: '20px' }}>
                <Text strong>特殊要求（可选）：</Text>
                <Input.TextArea
                    value={requirements}
                    onChange={(e) => onRequirementsChange(e.target.value)}
                    placeholder="例如：需要包含悬疑元素、适合年轻观众、时长控制在3分钟内等..."
                    rows={3}
                    style={{ marginTop: '8px' }}
                />
            </div>

            {/* Generate Button */}
            <div style={{ marginBottom: '20px' }}>
                <Button
                    type="primary"
                    icon={<BulbOutlined />}
                    onClick={generateIdea}
                    disabled={!canGenerate || isGenerating || isStreaming}
                    loading={isGenerating || isStreaming}
                    size="large"
                    style={{ marginRight: 12 }}
                >
                    {isGenerating || isStreaming ? '正在生成创意...' : '生成创意'}
                </Button>

                {(isGenerating || isStreaming) && (
                    <Button
                        onClick={handleStopGeneration}
                        size="large"
                    >
                        停止生成
                    </Button>
                )}
            </div>

            {/* Error Display */}
            {currentError && (
                <Alert
                    message="生成失败"
                    description={currentError}
                    type="error"
                    showIcon
                    style={{ marginBottom: '20px' }}
                />
            )}

            {/* Streaming Display */}
            {(isStreaming || displayData) && (
                <StreamingDisplay
                    data={displayData}
                    isStreaming={isStreaming}
                    progress={progress}
                    error={streamingError}
                    type="brainstorm"
                />
            )}

            {/* Legacy Ideas Display (for backward compatibility) */}
            {generatedIdeas.length > 0 && !isStreaming && !displayData && (
                <div>
                    <Divider />
                    <Text strong style={{ fontSize: '16px', marginBottom: '16px', display: 'block' }}>
                        生成的创意 ({generatedIdeas.length}个)
                    </Text>

                    <div style={{ display: 'grid', gap: '12px' }}>
                        {generatedIdeas.map((idea, index) => (
                            <div
                                key={index}
                                onClick={() => onIdeaSelect(index)}
                                style={{
                                    padding: '16px',
                                    border: selectedIdeaIndex === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedIdeaIndex === index ? '#f0f8ff' : '#fff',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                    <Text strong style={{ color: '#1890ff' }}>
                                        {idea.title}
                                    </Text>
                                    {selectedIdeaIndex === index && (
                                        <RightOutlined style={{ marginLeft: 'auto', color: '#1890ff' }} />
                                    )}
                                </div>
                                <Text style={{ color: '#666', lineHeight: '1.5' }}>
                                    {idea.body}
                                </Text>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrainstormingPanel; 