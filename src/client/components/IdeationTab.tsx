import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Input, Button, Typography, Spin, Alert, Switch, Modal, Card, Space, Breadcrumb } from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, DeleteOutlined, BulbOutlined, DesktopOutlined, HomeOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import BrainstormingInputForm from './BrainstormingInputForm';
import BrainstormingParameterSummary from './BrainstormingParameterSummary';
import StoryInspirationEditor from './StoryInspirationEditor';
import BrainstormingResults from './BrainstormingResults';
import DynamicBrainstormingResults from './DynamicBrainstormingResults';
import { useStreamingBrainstorm } from '../hooks/useStreamingBrainstorm';
import { IdeaWithTitle } from '../services/implementations/BrainstormingStreamingService';
import TextareaAutosize from 'react-textarea-autosize';


const { Title, Text, Paragraph } = Typography;

const IdeationTab: React.FC = () => {
    const { id: ideationRunId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialArtifactId = searchParams.get('artifact_id');
    const initialTransformId = searchParams.get('transform');

    const [userInput, setUserInput] = useState('');
    const [currentArtifactId, setCurrentArtifactId] = useState<string | null>(initialArtifactId);
    const [brainstormingEnabled, setBrainstormingEnabled] = useState(true);
    const [brainstormingCollapsed, setBrainstormingCollapsed] = useState(false);
    const [isLoadingRun, setIsLoadingRun] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null);

    // NEW: Streaming job state
    const [isStreamingJob, setIsStreamingJob] = useState(false);
    const [activeTransformId, setActiveTransformId] = useState<string | null>(initialTransformId);

    // Brainstorming data  
    const [brainstormingData, setBrainstormingData] = useState({
        selectedPlatform: '',
        selectedGenrePaths: [] as string[][],
        generatedIdeas: [] as IdeaWithTitle[],
        generatedIdeaArtifacts: [] as Array<{ id: string, text: string, title?: string, orderIndex: number }>,
        requirements: ''
    });

    // Use streaming hook when we have an active transform ID
    const { status, items, isThinking, error: streamingError, stop, reasoningEvent } = useStreamingBrainstorm(activeTransformId || undefined);

    // Update generated ideas when streaming items change
    useEffect(() => {
        if (items.length > 0) {
            setBrainstormingData(prev => ({
                ...prev,
                generatedIdeas: items
            }));
        }
    }, [items]);

    // Watch for streaming completion
    useEffect(() => {
        if (status === 'completed' && activeTransformId) {
            handleStreamingComplete();
        }
    }, [status, activeTransformId]);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Effect to watch for URL parameter changes
    useEffect(() => {
        const currentTransformId = searchParams.get('transform');
        const currentArtifactId = searchParams.get('artifact_id');

        // Update transform ID if it changed
        if (currentTransformId !== activeTransformId) {
            setActiveTransformId(currentTransformId);
            setIsStreamingJob(!!currentTransformId);
        }

        // Update artifact ID if it changed
        if (currentArtifactId !== currentArtifactId) {
            setCurrentArtifactId(currentArtifactId);
        }
    }, [searchParams]);

    // Effect to load existing ideation run if ID is present
    useEffect(() => {
        if (ideationRunId) {
            loadIdeationRun(ideationRunId);
            // If we have a transform ID from URL, set streaming state immediately
            const currentTransformId = searchParams.get('transform');
            if (currentTransformId) {
                setIsStreamingJob(true);
                setActiveTransformId(currentTransformId);
            } else {
                // Otherwise check if there's an active streaming job for this run
                checkActiveStreamingJob(ideationRunId);
            }
        }
    }, [ideationRunId]);

    // Function to load an existing ideation run
    const loadIdeationRun = async (runId: string) => {
        setIsLoadingRun(true);
        setError(null);

        try {
            const response = await fetch(`/api/projects/${runId}`);

            if (!response.ok) {
                throw new Error(`Failed to load ideation run: ${response.status}`);
            }

            const data = await response.json();

            // Populate the component state with loaded data
            setUserInput(data.userInput || '');
            setBrainstormingData({
                selectedPlatform: data.selectedPlatform || '',
                selectedGenrePaths: data.genrePaths || [],
                generatedIdeas: data.initialIdeas || [],
                generatedIdeaArtifacts: data.initialIdeaArtifacts || [],
                requirements: data.requirements || ''
            });

            // If there are generated ideas and user input matches one of them, collapse brainstorming
            if (data.initialIdeas && data.initialIdeas.length > 0 && data.userInput) {
                const ideaIndex = data.initialIdeas.findIndex((idea: any) =>
                    `${idea.title}: ${idea.body}` === data.userInput
                );
                if (ideaIndex !== -1) {
                    setBrainstormingCollapsed(true);
                    setSelectedIdeaIndex(ideaIndex);
                }
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
                        sourceArtifactId: null
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
        const selectedIndex = brainstormingData.generatedIdeas.findIndex(
            idea => `${idea.title}: ${idea.body}` === ideaBody
        );

        if (selectedIndex !== -1) {
            setSelectedIdeaIndex(selectedIndex);
            const selectedArtifact = brainstormingData.generatedIdeaArtifacts[selectedIndex];

            if (selectedArtifact && selectedArtifact.id && !selectedArtifact.id.startsWith('temp-idea-')) {
                setCurrentArtifactId(selectedArtifact.id);

                // Update URL with artifact ID
                if (ideationRunId) {
                    const newSearchParams = new URLSearchParams();
                    newSearchParams.set('artifact_id', selectedArtifact.id);
                    navigate(`/ideation/${ideationRunId}?${newSearchParams.toString()}`, { replace: true });
                }
            } else {
                setCurrentArtifactId(null);
                if (ideationRunId) {
                    navigate(`/ideation/${ideationRunId}`, { replace: true });
                }
            }
        }
    };

    const handleStreamingComplete = useCallback(() => {
        setIsStreamingJob(false);
        setActiveTransformId(null);

        // Clear transform ID from URL
        if (ideationRunId) {
            const newSearchParams = new URLSearchParams(window.location.search);
            newSearchParams.delete('transform');
            const newUrl = newSearchParams.toString()
                ? `/ideation/${ideationRunId}?${newSearchParams.toString()}`
                : `/ideation/${ideationRunId}`;
            navigate(newUrl, { replace: true });
        }
    }, [ideationRunId, navigate]);

    const generateIdeas = async () => {
        if (!brainstormingData.selectedGenrePaths.length) {
            setError(new Error('请至少选择一个故事类型'));
            return;
        }

        setError(null);

        try {
            // Create project and start brainstorming job in one request
            const response = await fetch('/api/projects/create-project-and-brainstorm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: brainstormingData.selectedPlatform || '通用短视频平台',
                    genrePaths: brainstormingData.selectedGenrePaths,
                    requirements: brainstormingData.requirements.trim()
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create project and brainstorming job: ${response.status}`);
            }

            const { projectId, ideationRunId, transformId, projectTitle } = await response.json();

            console.log(`Created project ${projectId} (${projectTitle}) with brainstorming job ${transformId}`);

            // Navigate to the new project brainstorming page
            navigate(`/projects/${projectId}/brainstorm?transform=${transformId}&ideationRun=${ideationRunId}`);

        } catch (err) {
            console.error('Error creating project and brainstorming job:', err);
            setError(err instanceof Error ? err : new Error('Failed to create project and start brainstorming'));
        }
    };

    const handleRegenerate = () => {
        setBrainstormingData(prev => ({
            ...prev,
            generatedIdeas: []
        }));
        setSelectedIdeaIndex(null);
        generateIdeas();
    };

    const checkActiveStreamingJob = async (runId: string) => {
        try {
            const response = await fetch(`/api/projects/${runId}/active-job`);
            if (response.ok) {
                const jobData = await response.json();
                if (jobData.status === 'running') {
                    setIsStreamingJob(true);
                    setActiveTransformId(jobData.transformId);
                }
            } else if (response.status === 404) {
                // 404 is expected for completed ideations - no active job exists
                // This is normal and not an error
                return;
            }
        } catch (error) {
            // Only log actual network errors, not 404s
            console.error('Error checking active streaming job:', error);
        }
    };

    // Cleanup function
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
            generatedIdeas: [],
            generatedIdeaArtifacts: [],
            requirements: ''
        });
        setBrainstormingEnabled(true);
        setBrainstormingCollapsed(false);
        setError(null);
        setSelectedIdeaIndex(null);

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
                    const response = await fetch(`/api/projects/${ideationRunId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to delete ideation: ${response.status}`);
                    }

                    Modal.success({
                        title: '删除成功',
                        content: '灵感已成功删除',
                        onOk: () => {
                            navigate('/projects');
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

    // Update artifacts when ideas change
    useEffect(() => {
        setBrainstormingData(prev => ({
            ...prev,
            generatedIdeaArtifacts: prev.generatedIdeas.map((idea, index) => ({
                id: idea.artifactId || `temp-idea-${index}`,
                text: `${idea.title}: ${idea.body}`,
                title: idea.title,
                orderIndex: index
            }))
        }));
    }, [brainstormingData.generatedIdeas]);

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
                                    onClick={() => navigate('/projects')}
                                    type="text"
                                    style={{ color: '#1890ff' }}
                                >
                                    返回
                                </Button>
                            )}
                            <Title level={4} style={{ margin: 0 }}>
                                {ideationRunId ? '灵感详情' : '灵感生成器'}
                            </Title>
                            {isStreamingJob && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginLeft: '16px',
                                    color: '#52c41a'
                                }}>
                                    <Spin size="small" />
                                    <Text style={{ color: '#52c41a', fontSize: '12px' }}>
                                        正在生成中...
                                    </Text>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {ideationRunId && !isStreamingJob && (
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
                                disabled={isStreamingJob}
                            >
                                重来
                            </Button>
                        </div>
                    </div>

               

                    {/* Brainstorming Section */}
                    {ideationRunId ? (
                        // For existing ideation runs, show parameter summary and results
                        <>
                            {/* Show parameter summary if we have brainstorming data */}
                            {brainstormingData.selectedPlatform && (
                                <BrainstormingParameterSummary
                                    selectedPlatform={brainstormingData.selectedPlatform}
                                    selectedGenrePaths={brainstormingData.selectedGenrePaths}
                                    requirements={brainstormingData.requirements}
                                />
                            )}

                            {/* Show results if we have ideas or are streaming */}
                            {(brainstormingData.generatedIdeas.length > 0 || activeTransformId || status === 'streaming') && !brainstormingCollapsed && (
                                <DynamicBrainstormingResults
                                    ideas={brainstormingData.generatedIdeas}
                                    onIdeaSelect={handleIdeaSelect}
                                    isStreaming={status === 'streaming'}
                                    isConnecting={!!activeTransformId && status === 'idle'}
                                    isThinking={isThinking}
                                    onStop={stop}
                                    onRegenerate={handleRegenerate}
                                    error={streamingError}
                                    selectedIdeaIndex={selectedIdeaIndex}
                                    canRegenerate={!isStreamingJob}
                                    ideationRunId={ideationRunId}
                                    reasoningEvent={reasoningEvent}
                                />
                            )}

                            {/* Show collapsed state if an idea was selected */}
                            {brainstormingCollapsed && selectedIdeaIndex !== null && brainstormingData.generatedIdeas[selectedIdeaIndex] && (
                                <div
                                    onClick={() => setBrainstormingCollapsed(false)}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#1a1a1a',
                                        borderRadius: '6px',
                                        border: '1px solid #303030',
                                        marginBottom: '16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#262626';
                                        e.currentTarget.style.borderColor = '#1890ff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#1a1a1a';
                                        e.currentTarget.style.borderColor = '#303030';
                                    }}
                                >
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        💡 已选择故事灵感「{brainstormingData.generatedIdeas[selectedIdeaIndex].title}」
                                    </Text>
                                    <Button
                                        type="link"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBrainstormingCollapsed(false);
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
                                </div>
                            )}
                        </>
                    ) : (
                        // For new ideation, show input form with toggle
                        <>
                    

                            {brainstormingEnabled && (
                                <BrainstormingInputForm
                                    selectedPlatform={brainstormingData.selectedPlatform}
                                    selectedGenrePaths={brainstormingData.selectedGenrePaths}
                                    requirements={brainstormingData.requirements}
                                    onPlatformChange={(value) => setBrainstormingData(prev => ({ ...prev, selectedPlatform: value }))}
                                    onGenreSelectionChange={(paths) => setBrainstormingData(prev => ({
                                        ...prev,
                                        selectedGenrePaths: paths
                                    }))}
                                    onRequirementsChange={(value) => setBrainstormingData(prev => ({ ...prev, requirements: value }))}
                                    onGenerate={generateIdeas}
                                />
                            )}
                        </>
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