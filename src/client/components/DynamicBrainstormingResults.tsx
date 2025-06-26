import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Space, Button, Typography, Spin, Empty, Card, Tag, Alert } from 'antd';
import { StopOutlined, ReloadOutlined, EyeOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { ThinkingIndicator } from './shared/ThinkingIndicator';
import { ReasoningIndicator } from './shared/ReasoningIndicator';
import { IdeaWithTitle } from '../types/brainstorm';
import { apiService } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { ReasoningEvent } from '../../common/streaming/types';
import { ArtifactEditor } from './shared/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from './shared/fieldConfigs';
import { useProjectData } from '../contexts/ProjectDataContext';
import { findLatestBrainstormIdeasWithLineage } from '../../common/utils/lineageResolution';

const { Text } = Typography;

// Component to check for human transforms and show outline generation button
const GenerateOutlineButton: React.FC<{
    artifactId: string;
}> = ({ artifactId }) => {
    const projectData = useProjectData();

    // Check if the artifact has been edited (has human source transform)
    const artifact = projectData.getArtifactById(artifactId);
    const hasEditTransform = artifact?.isEditable || false;

    const handleGenerateOutline = () => {
        alert('not implemented');
    };

    // Only show button if user has edited the idea
    if (!hasEditTransform) {
        return null;
    }

    return (
        <>
            <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={handleGenerateOutline}
                style={{
                    marginTop: '12px',
                    marginBottom: '12px',
                    background: 'linear-gradient(100deg, #40a9ff, rgb(22, 106, 184))',
                    border: 'none',
                    borderRadius: '4px',
                    padding: "20px 20px",
                    fontSize: "18px"
                }}
            >
                用这个灵感继续 &gt;&gt;
            </Button>
            （生成叙事大纲）
        </>

    );
};

interface DynamicBrainstormingResultsProps {
    ideas: IdeaWithTitle[];
    onIdeaSelect?: (ideaText: string) => void;
    isStreaming?: boolean;
    isConnecting?: boolean;
    isThinking?: boolean;
    onStop?: () => void;
    onRegenerate?: () => void;
    error?: Error | null;
    selectedIdeaIndex?: number | null;
    canRegenerate?: boolean;
    ideationRunId?: string;
    reasoningEvent?: ReasoningEvent | null;
}

// Component to display associated outlines for an idea
const IdeaOutlines: React.FC<{
    ideaId: string;
    outlines: any[];
    isLoading: boolean;
}> = ({ ideaId, outlines, isLoading }) => {
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div style={{ padding: '8px', textAlign: 'center' }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                    加载关联大纲...
                </Text>
            </div>
        );
    }

    if (outlines.length === 0) {
        return (
            <div style={{ padding: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    暂无关联大纲
                </Text>
            </div>
        );
    }

    return (
        <div style={{ padding: '8px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 'bold', color: '#d9d9d9' }}>
                关联大纲 ({outlines.length})
            </Text>
            <div style={{ marginTop: '4px' }}>
                {outlines.map((outline, index) => (
                    <div
                        key={outline.sessionId}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            marginBottom: '4px',
                            background: '#262626',
                            borderRadius: '4px',
                            border: '1px solid #434343'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <Text style={{ fontSize: '12px', color: '#d9d9d9' }}>
                                {outline.title || '未命名大纲'}
                            </Text>
                            {outline.genre && (
                                <Tag style={{ marginLeft: '4px', fontSize: '10px', padding: '0 4px', height: '18px', lineHeight: '16px' }}>
                                    {outline.genre}
                                </Tag>
                            )}
                            {outline.status && (
                                <Tag
                                    color={outline.status === 'completed' ? 'green' : outline.status === 'failed' ? 'red' : 'blue'}
                                    style={{ marginLeft: '4px', fontSize: '10px', padding: '0 4px', height: '18px', lineHeight: '16px' }}
                                >
                                    {outline.status === 'completed' ? '已完成' :
                                        outline.status === 'failed' ? '失败' : '进行中'}
                                </Tag>
                            )}
                        </div>
                        <Button
                            size="small"
                            type="text"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent event bubbling to parent card
                                navigate(`/projects/${outline.sessionId}/outline`);
                            }}
                            style={{ color: '#1890ff', fontSize: '12px' }}
                        >
                            查看
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Individual idea card component using ArtifactEditor
const BrainstormIdeaCard: React.FC<{
    collectionId: string;
    ideaPath: string;
    index: number;
    isSelected: boolean;
    ideaOutlines: any[];
    onIdeaClick: (collectionId: string, index: number) => void;
}> = ({ collectionId, ideaPath, index, isSelected, ideaOutlines, onIdeaClick }) => {
    const [showSavedCheckmark, setShowSavedCheckmark] = useState(false);
    const projectData = useProjectData();

    // Check if this specific path has been edited (has lineage)
    const latestArtifactId = projectData.getLatestVersionForPath(collectionId, ideaPath);
    const hasBeenEdited = latestArtifactId && latestArtifactId !== collectionId;

    // Handle successful save - show checkmark briefly
    const handleSaveSuccess = useCallback(() => {
        setShowSavedCheckmark(true);
        setTimeout(() => {
            setShowSavedCheckmark(false);
        }, 2000); // Show checkmark for 2 seconds
    }, []);

    return (
        <Card
            key={`${collectionId}-${index}`}
            style={{
                backgroundColor: isSelected ? '#2d3436' : '#262626',
                border: isSelected ? '1px solid #1890ff' : '1px solid #434343',
                transition: 'all 0.2s ease',
                animation: 'fadeIn 0.3s ease-out',
                position: 'relative'
            }}
            styles={{ body: { padding: '12px' } }}
            hoverable={!isSelected}
            onMouseEnter={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.backgroundColor = '#2d3436';
                }
            }}
            onMouseLeave={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.borderColor = '#434343';
                    e.currentTarget.style.backgroundColor = '#262626';
                }
            }}
            onClick={() => onIdeaClick(collectionId, index)}
        >
            {/* Saved checkmark overlay */}
            {showSavedCheckmark && (
                <div
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        zIndex: 10,
                        background: '#52c41a',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'fadeInOut 2s ease-in-out'
                    }}
                >
                    <CheckOutlined style={{ color: 'white', fontSize: '12px' }} />
                </div>
            )}

            {/* Idea content using ArtifactEditor with JSON path */}
            <ArtifactEditor
                artifactId={collectionId}
                path={ideaPath}
                fields={BRAINSTORM_IDEA_FIELDS}
                statusLabel={hasBeenEdited ? "📝 已编辑版本" : "AI生成"}
                statusColor={hasBeenEdited ? "#52c41a" : "#1890ff"}
                transformName="edit_brainstorm_collection_idea"
                onSaveSuccess={handleSaveSuccess}
            />

            {/* Generate outline button */}
            <GenerateOutlineButton artifactId={latestArtifactId || collectionId} />

            {/* Associated outlines */}
            <IdeaOutlines
                ideaId={latestArtifactId || collectionId}
                outlines={ideaOutlines}
                isLoading={false}
            />
        </Card>
    );
};

/**
 * Hook to get latest brainstorm ideas from collections and individual artifacts
 * This replaces the complex per-card lineage resolution
 */
function useLatestBrainstormIdeas(): IdeaWithTitle[] {
    const projectData = useProjectData();

    return useMemo(() => {
        const allIdeas: IdeaWithTitle[] = [];

        // 1. Get all brainstorm collections
        const collections = projectData.getBrainstormCollections();

        // 2. Extract ideas from collections with lineage resolution
        for (const collection of collections) {
            try {
                const collectionData = JSON.parse(collection.data);

                // Check if collectionData has ideas array
                if (!collectionData.ideas || !Array.isArray(collectionData.ideas)) {
                    console.warn('⚠️ Collection missing ideas array:', collection.id);
                    continue;
                }

                for (let i = 0; i < collectionData.ideas.length; i++) {
                    // 3. Resolve latest version for each idea
                    const artifactPath = `$.ideas[${i}]`;
                    const latestArtifactId = projectData.getLatestVersionForPath(collection.id, artifactPath);

                    if (latestArtifactId && latestArtifactId !== collection.id) {
                        // Use individual edited version
                        const latestArtifact = projectData.getArtifactById(latestArtifactId);
                        if (latestArtifact) {
                            const ideaData = JSON.parse(latestArtifact.data);

                            allIdeas.push({
                                title: ideaData.title || `想法 ${i + 1}`,
                                body: ideaData.body || '内容加载中...',
                                artifactId: latestArtifactId,
                                originalArtifactId: collection.id,
                                artifactPath: `$.ideas[${i}]`,
                                index: i
                            });
                        }
                    } else {
                        // Use original from collection
                        const originalIdea = collectionData.ideas[i];

                        allIdeas.push({
                            title: originalIdea.title || `想法 ${allIdeas.length + 1}`,
                            body: originalIdea.body || '内容加载中...',
                            artifactId: collection.id, // Base artifact ID
                            originalArtifactId: collection.id,
                            artifactPath: `$.ideas[${i}]`, // JSONPath to specific item
                            index: allIdeas.length
                        });
                    }
                }
            } catch (parseErr) {
                console.warn(`❌ Failed to parse collection ${collection.id}:`, parseErr);
            }
        }

        // 4. LEGACY: Also get individual brainstorm ideas for backward compatibility
        const lineageGraph = projectData.getLineageGraph();
        const latestIndividualIdeas = findLatestBrainstormIdeasWithLineage(lineageGraph, projectData.artifacts);

        latestIndividualIdeas.forEach((artifact: any, index: number) => {
            try {
                const data = artifact.data ? JSON.parse(artifact.data) : {};
                allIdeas.push({
                    artifactId: artifact.id,
                    originalArtifactId: artifact.id,
                    title: data.title || `想法 ${allIdeas.length + index + 1}`,
                    body: data.body || '内容加载中...',
                    artifactPath: '$', // Root path for individual artifacts
                    index: allIdeas.length + index
                });
            } catch (parseErr) {
                console.warn(`Failed to parse individual artifact ${artifact.id}:`, parseErr);
            }
        });

        return allIdeas;
    }, [projectData]);
}

export const DynamicBrainstormingResults: React.FC<DynamicBrainstormingResultsProps> = ({
    ideas: propIdeas, // Rename to avoid confusion
    onIdeaSelect,
    isStreaming = false,
    isConnecting = false,
    isThinking = false,
    onStop,
    onRegenerate,
    error,
    selectedIdeaIndex = null,
    canRegenerate = true,
    ideationRunId,
    reasoningEvent
}) => {
    const [selectedIdea, setSelectedIdea] = useState<number | null>(selectedIdeaIndex);
    const [ideaOutlines, setIdeaOutlines] = useState<Record<string, any[]>>({});
    const [loadingOutlines, setLoadingOutlines] = useState<Record<string, boolean>>({});

    // Get latest brainstorm ideas using the new hook
    const latestIdeas = useLatestBrainstormIdeas();

    // Use latest ideas if available, otherwise fall back to prop ideas
    const ideas = latestIdeas.length > 0 ? latestIdeas : propIdeas;

    // Handle idea card click
    const handleIdeaClick = useCallback((collectionId: string, index: number) => {
        setSelectedIdea(prev => prev === index ? null : index);
        if (onIdeaSelect && ideas[index]) {
            onIdeaSelect(ideas[index].body);
        }
    }, [ideas, onIdeaSelect]);

    // Fetch outlines for each idea
    const fetchIdeaOutlines = async () => {
        const outlinePromises = ideas.map(async (idea) => {
            const artifactId = idea.artifactId;
            if (!artifactId || ideaOutlines[artifactId]) return; // Already loaded

            setLoadingOutlines(prev => ({ ...prev, [artifactId]: true }));

            try {
                // This would need to be implemented to fetch outlines associated with this idea
                // For now, return empty array
                const outlines: any[] = [];
                setIdeaOutlines(prev => ({ ...prev, [artifactId]: outlines }));
            } catch (err) {
                console.error(`Failed to fetch outlines for idea ${artifactId}:`, err);
                setIdeaOutlines(prev => ({ ...prev, [artifactId]: [] }));
            } finally {
                setLoadingOutlines(prev => ({ ...prev, [artifactId]: false }));
            }
        });

        await Promise.allSettled(outlinePromises);
    };

    // Load outlines when ideas change
    useEffect(() => {
        if (ideas.length > 0) {
            fetchIdeaOutlines();
        }
    }, [ideas]);

    // Show loading state
    if (isConnecting || (isStreaming && ideas.length === 0)) {
        return (
            <div className="text-center py-12">
                <div className="animate-pulse">
                    <div className="text-4xl mb-4">⚡</div>
                    <h2 className="text-xl font-semibold mb-2">头脑风暴进行中</h2>
                    <p className="text-gray-400">
                        {isConnecting ? '正在连接...' : '正在生成您的创意想法...'}
                    </p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-500 text-xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-white mb-2">生成失败</h2>
                <p className="text-gray-300 mb-4">{error.message}</p>
                {canRegenerate && onRegenerate && (
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={onRegenerate}
                    >
                        重新生成
                    </Button>
                )}
            </div>
        );
    }

    // Show empty state
    if (ideas.length === 0) {
        return (
            <div className="text-center py-12">
                <Empty
                    description={
                        <span className="text-gray-400">
                            暂无头脑风暴结果
                        </span>
                    }
                />
                {canRegenerate && onRegenerate && (
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={onRegenerate}
                        style={{ marginTop: '16px' }}
                    >
                        开始头脑风暴
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Text className="text-lg font-semibold text-white">
                        创意想法 ({ideas.length})
                    </Text>
                    {isStreaming && (
                        <div className="flex items-center gap-2">
                            <ReasoningIndicator isVisible={isThinking} />
                            <Text className="text-sm text-blue-400">
                                {isThinking ? '思考中...' : '生成中...'}
                            </Text>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isStreaming && onStop && (
                        <Button
                            type="primary"
                            danger
                            size="small"
                            icon={<StopOutlined />}
                            onClick={onStop}
                        >
                            停止生成
                        </Button>
                    )}
                    {canRegenerate && onRegenerate && !isStreaming && (
                        <Button
                            type="default"
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={onRegenerate}
                        >
                            重新生成
                        </Button>
                    )}
                </div>
            </div>

            {/* Thinking indicator */}
            {isThinking && (
                <ThinkingIndicator isThinking={isThinking} />
            )}

            {/* Ideas grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ideas.map((idea, index) => {
                    if (!idea.originalArtifactId || !idea.artifactPath) return null;

                    return (
                        <BrainstormIdeaCard
                            key={`${idea.originalArtifactId}-${index}`}
                            collectionId={idea.originalArtifactId}
                            ideaPath={idea.artifactPath}
                            index={index}
                            isSelected={selectedIdea === index}
                            ideaOutlines={ideaOutlines[idea.artifactId || ''] || []}
                            onIdeaClick={handleIdeaClick}
                        />
                    );
                })}
            </div>

            {/* Streaming indicator */}
            {isStreaming && (
                <div className="text-center py-4">
                    <Text className="text-sm text-gray-400">
                        正在生成更多创意想法...
                    </Text>
                </div>
            )}
        </div>
    );
};

export default DynamicBrainstormingResults;
