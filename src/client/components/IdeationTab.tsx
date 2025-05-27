import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Button, Typography, Spin, Alert, Switch, Modal } from 'antd';
import { SendOutlined, ReloadOutlined, ArrowLeftOutlined, DeleteOutlined, BulbOutlined } from '@ant-design/icons';
import BrainstormingPanel from './BrainstormingPanel';

// Use a hardcoded template instead of importing from a file
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

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface IdeationResponse {
    mediaType?: string;
    platform?: string;
    plotOutline?: string;
    analysis?: string;
}

const IdeationTab: React.FC = () => {
    const { id: ideationRunId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [userInput, setUserInput] = useState('');
    const [brainstormingEnabled, setBrainstormingEnabled] = useState(true);
    const [brainstormingCollapsed, setBrainstormingCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingRun, setIsLoadingRun] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<IdeationResponse | null>(null);

    // Brainstorming data
    const [brainstormingData, setBrainstormingData] = useState({
        selectedPlatform: '',
        selectedGenrePaths: [] as string[][],
        genreProportions: [] as number[],
        generatedIdeas: [] as string[],
        requirements: ''
    });

    const abortControllerRef = useRef<AbortController | null>(null);

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
            setBrainstormingData({
                selectedPlatform: data.selectedPlatform || '',
                selectedGenrePaths: data.genrePaths || [],
                genreProportions: data.genreProportions || [],
                generatedIdeas: data.initialIdeas || [],
                requirements: data.requirements || ''
            });

            // If there are generated ideas and user input matches one of them, collapse brainstorming
            if (data.initialIdeas && data.initialIdeas.length > 0 && data.userInput) {
                const ideaIndex = data.initialIdeas.findIndex((idea: string) => idea === data.userInput);
                if (ideaIndex !== -1) {
                    setBrainstormingCollapsed(true);
                }
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
        // If user manually edits and it no longer matches a brainstormed idea, keep collapsed state
    };

    const handleBrainstormingToggle = (checked: boolean) => {
        setBrainstormingEnabled(checked);
        if (!checked) {
            setBrainstormingCollapsed(true);
        } else {
            setBrainstormingCollapsed(false);
        }
    };

    const handleIdeaSelect = (idea: string) => {
        setUserInput(idea);
        setBrainstormingCollapsed(true);
    };

    const handleBrainstormingDataChange = useCallback((data: {
        selectedPlatform: string;
        selectedGenrePaths: string[][];
        genreProportions: number[];
        generatedIdeas: string[];
        requirements: string;
    }) => {
        setBrainstormingData(data);
    }, []);

    const handleRunCreated = useCallback((runId: string) => {
        // Navigate to the new ideation run
        navigate(`/ideation/${runId}`);
    }, [navigate]);

    const generateIdeation = async () => {
        if (!userInput.trim()) {
            return;
        }

        // Build genre string for prompt
        const buildGenrePromptString = (): string => {
            if (brainstormingData.selectedGenrePaths.length === 0) return '未指定';
            return brainstormingData.selectedGenrePaths.map((path, index) => {
                const proportion = brainstormingData.genreProportions[index] !== undefined
                    ? brainstormingData.genreProportions[index]
                    : (100 / brainstormingData.selectedGenrePaths.length);
                const pathString = path.join(' > ');
                return brainstormingData.selectedGenrePaths.length > 1
                    ? `${pathString} (${proportion.toFixed(0)}%)`
                    : pathString;
            }).join(', ');
        };

        // Check if we have an existing run ID from the URL
        if (!ideationRunId) {
            // If no run ID, create a new run
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
                        selectedPlatform: brainstormingData.selectedPlatform,
                        genrePaths: brainstormingData.selectedGenrePaths,
                        genreProportions: brainstormingData.genreProportions,
                        initialIdeas: brainstormingData.generatedIdeas,
                        requirements: brainstormingData.requirements,
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
        setBrainstormingData({
            selectedPlatform: '',
            selectedGenrePaths: [],
            genreProportions: [],
            generatedIdeas: [],
            requirements: ''
        });
        setBrainstormingEnabled(true);
        setBrainstormingCollapsed(false);
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

                    {/* Brainstorming Toggle */}
                    <div style={{
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px',
                        background: '#1a1a1a',
                        borderRadius: '6px',
                        border: '1px solid #303030'
                    }}>
                        <BulbOutlined style={{ color: '#52c41a' }} />
                        <Text style={{ color: '#d9d9d9' }}>启用头脑风暴</Text>
                        <Switch
                            checked={brainstormingEnabled}
                            onChange={handleBrainstormingToggle}
                            size="small"
                        />
                        {brainstormingCollapsed && brainstormingEnabled && (
                            <Button
                                type="link"
                                size="small"
                                onClick={() => setBrainstormingCollapsed(false)}
                                style={{ marginLeft: 'auto', color: '#1890ff' }}
                            >
                                展开设置
                            </Button>
                        )}
                    </div>

                    {/* Brainstorming Panel */}
                    {brainstormingEnabled && (
                        <BrainstormingPanel
                            isCollapsed={brainstormingCollapsed}
                            onIdeaSelect={handleIdeaSelect}
                            onDataChange={handleBrainstormingDataChange}
                            onRunCreated={!ideationRunId ? handleRunCreated : undefined}
                            initialPlatform={brainstormingData.selectedPlatform}
                            initialGenrePaths={brainstormingData.selectedGenrePaths}
                            initialGenreProportions={brainstormingData.genreProportions}
                            initialGeneratedIdeas={brainstormingData.generatedIdeas}
                            initialRequirements={brainstormingData.requirements}
                        />
                    )}

                    {/* Central Textarea */}
                    <div style={{ marginBottom: '24px' }}>
                        <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '16px' }}>
                            故事灵感
                        </Text>
                        <TextArea
                            rows={8}
                            value={userInput}
                            onChange={handleInputChange}
                            placeholder="输入或选择你的故事梗概..."
                            style={{
                                fontSize: '14px',
                                lineHeight: '1.6',
                                background: '#141414',
                                border: '1px solid #434343',
                                borderRadius: '8px'
                            }}
                        />
                        <Text type="secondary" style={{ display: 'block', marginTop: '8px', fontSize: '12px' }}>
                            {brainstormingEnabled && !brainstormingCollapsed
                                ? '可以直接输入，或使用上方头脑风暴功能生成创意'
                                : '输入完整的故事梗概，包含起承转合结构'
                            }
                        </Text>
                    </div>

                    {/* Generate Button */}
                    {userInput.trim() && (
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={generateIdeation}
                            loading={isLoading}
                            size="large"
                            style={{
                                marginBottom: '24px',
                                height: '44px',
                                fontSize: '16px',
                                fontWeight: '500'
                            }}
                        >
                            生成情节提要
                        </Button>
                    )}

                    {error && (
                        <Alert
                            message="生成失败"
                            description={error.message}
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {/* Results */}
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
            )}
        </div>
    );
};

export default IdeationTab;