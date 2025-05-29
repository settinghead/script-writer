import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Button, Typography, Spin, Alert, Switch, Modal } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, DeleteOutlined, BulbOutlined, DesktopOutlined } from '@ant-design/icons';
import BrainstormingPanel from './BrainstormingPanel';
import StoryInspirationEditor from './StoryInspirationEditor';



const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const IdeationTab: React.FC = () => {
    const { id: ideationRunId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const initialArtifactId = searchParams.get('artifact_id');

    const [userInput, setUserInput] = useState('');
    const [currentArtifactId, setCurrentArtifactId] = useState<string | null>(initialArtifactId);
    const [brainstormingEnabled, setBrainstormingEnabled] = useState(true);
    const [brainstormingCollapsed, setBrainstormingCollapsed] = useState(false);
    const [isLoadingRun, setIsLoadingRun] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Brainstorming data  
    const [brainstormingData, setBrainstormingData] = useState({
        selectedPlatform: '',
        selectedGenrePaths: [] as string[][],
        genreProportions: [] as number[],
        generatedIdeas: [] as Array<{ title: string, body: string }>,
        generatedIdeaArtifacts: [] as Array<{ id: string, text: string, title?: string, orderIndex: number }>,
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
                generatedIdeaArtifacts: data.initialIdeaArtifacts || [],
                requirements: data.requirements || ''
            });

            // If there are generated ideas and user input matches one of them, collapse brainstorming
            if (data.initialIdeas && data.initialIdeas.length > 0 && data.userInput) {
                const ideaIndex = data.initialIdeas.findIndex((idea: any) =>
                    (typeof idea === 'string' ? idea : idea.body) === data.userInput
                );
                if (ideaIndex !== -1) {
                    setBrainstormingCollapsed(true);
                }
            }

            // Note: plot generation is now handled by the outline feature

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

    const handleStoryInspirationValueChange = useCallback((value: string) => {
        setUserInput(value);
    }, []);

    const handleArtifactChange = useCallback((artifactId: string | null) => {
        setCurrentArtifactId(artifactId);

        // Update URL with new artifact ID
        if (ideationRunId) {
            if (artifactId) {
                const newSearchParams = new URLSearchParams();
                newSearchParams.set('artifact_id', artifactId);
                navigate(`/ideation/${ideationRunId}?${newSearchParams.toString()}`, { replace: true });
            } else {
                // Clear artifact_id from URL 
                navigate(`/ideation/${ideationRunId}`, { replace: true });
            }
        }
    }, [ideationRunId, navigate]);

    const handleStartOutlineDesign = useCallback(async () => {
        if (!userInput.trim()) {
            console.warn('No user input available for outline design');
            return;
        }

        let artifactIdToUse = currentArtifactId;

        // If we don't have an artifact ID yet, create a user_input artifact
        if (!artifactIdToUse) {
            try {
                const response = await fetch('/api/artifacts/user-input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: userInput.trim(),
                        sourceArtifactId: null // This is manual input
                    })
                });

                if (response.ok) {
                    const artifact = await response.json();
                    artifactIdToUse = artifact.id;
                } else {
                    console.error('Failed to create user input artifact');
                    return;
                }
            } catch (error) {
                console.error('Error creating user input artifact:', error);
                return;
            }
        }

        // Navigate to outline design page with the current artifact ID
        // This will be either a brainstorm_idea artifact or a user_input artifact
        navigate(`/new-outline?artifact_id=${artifactIdToUse}`);
    }, [currentArtifactId, userInput, navigate]);

    const handleBrainstormingToggle = (checked: boolean) => {
        setBrainstormingEnabled(checked);
        if (!checked) {
            setBrainstormingCollapsed(true);
        } else {
            setBrainstormingCollapsed(false);
        }
    };

    const handleIdeaSelect = (ideaBody: string) => {
        setUserInput(ideaBody);
        setBrainstormingCollapsed(true);

        // Find the artifact ID for this idea
        const selectedArtifact = brainstormingData.generatedIdeaArtifacts.find(
            artifact => artifact.text === ideaBody
        );

        if (selectedArtifact) {
            // Use the brainstorm_idea artifact ID
            setCurrentArtifactId(selectedArtifact.id);

            // Update URL with artifact ID
            if (ideationRunId) {
                const newSearchParams = new URLSearchParams();
                newSearchParams.set('artifact_id', selectedArtifact.id);
                navigate(`/ideation/${ideationRunId}?${newSearchParams.toString()}`, { replace: true });
            }
        } else {
            // Fallback: clear artifact ID for manual input
            setCurrentArtifactId(null);
            if (ideationRunId) {
                navigate(`/ideation/${ideationRunId}`, { replace: true });
            }
        }
    };

    const handleBrainstormingDataChange = useCallback((data: {
        selectedPlatform: string;
        selectedGenrePaths: string[][];
        genreProportions: number[];
        generatedIdeas: Array<{ title: string, body: string }>;
        generatedIdeaArtifacts: Array<{ id: string, text: string, title?: string, orderIndex: number }>;
        requirements: string;
    }) => {
        setBrainstormingData({
            ...data
        });
    }, []);

    const handleRunCreated = useCallback((runId: string) => {
        // Navigate to the new ideation run
        navigate(`/ideation/${runId}`);
    }, [navigate]);



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
            generatedIdeaArtifacts: [],
            requirements: ''
        });
        setBrainstormingEnabled(true);
        setBrainstormingCollapsed(false);
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
        <div style={{ padding: '20px', maxWidth: "800px", margin: '0 auto', width: "100%", overflow: "auto" }}>
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
                        输入你的故事灵感，然后点击"开始设计大纲"生成完整的故事大纲。
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
                    </div>

                    {/* Brainstorming Panel */}
                    {brainstormingEnabled && (
                        <BrainstormingPanel
                            isCollapsed={brainstormingCollapsed}
                            onIdeaSelect={handleIdeaSelect}
                            onDataChange={handleBrainstormingDataChange}
                            onRunCreated={!ideationRunId ? handleRunCreated : undefined}
                            onExpand={() => setBrainstormingCollapsed(false)}
                            initialPlatform={brainstormingData.selectedPlatform}
                            initialGenrePaths={brainstormingData.selectedGenrePaths}
                            initialGenreProportions={brainstormingData.genreProportions}
                            initialGeneratedIdeas={brainstormingData.generatedIdeas}
                            initialRequirements={brainstormingData.requirements}
                        />
                    )}

                    {/* Story Inspiration Editor */}
                    {ideationRunId ? (
                        <StoryInspirationEditor
                            currentArtifactId={currentArtifactId || undefined}
                            onValueChange={handleStoryInspirationValueChange}
                            onArtifactChange={handleArtifactChange}
                            externalValue={userInput}
                            placeholder={brainstormingEnabled && !brainstormingCollapsed
                                ? '可以直接输入，或使用上方头脑风暴功能生成创意'
                                : '输入完整的故事梗概，包含起承转合结构'
                            }
                        />
                    ) : (
                        // Fallback for new ideation (no ID yet)
                        <div style={{ marginBottom: '24px' }}>
                            <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '16px' }}>
                                故事灵感
                            </Text>
                            <TextArea
                                rows={8}
                                value={userInput}
                                onChange={handleInputChange}
                                placeholder={brainstormingEnabled && !brainstormingCollapsed
                                    ? '可以直接输入，或使用上方头脑风暴功能生成创意'
                                    : '输入完整的故事梗概，包含起承转合结构'
                                }
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
                    )}

                    {/* Action Buttons */}
                    {userInput.trim() && (
                        <Button
                            type="primary"
                            icon={<DesktopOutlined />}
                            onClick={handleStartOutlineDesign}
                            size="large"
                            style={{
                                marginBottom: '24px',
                                height: '44px',
                                fontSize: '16px',
                                fontWeight: '500',
                                minWidth: '160px',
                                background: '#52c41a',
                                borderColor: '#52c41a'
                            }}
                        >
                            开始设计大纲
                        </Button>
                    )}

                    {error && (
                        <Alert
                            message="操作失败"
                            description={error.message}
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default IdeationTab;