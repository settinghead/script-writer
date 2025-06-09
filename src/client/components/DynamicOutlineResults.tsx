import React, { useState, useEffect } from 'react';
import { Row, Col, Alert, Button, Space, message } from 'antd';
import { ReloadOutlined, ExportOutlined, UndoOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DynamicStreamingUI, outlineFieldRegistry } from './shared/streaming';
import { OutlineExportModal } from './shared/OutlineExportModal';
import { ReasoningIndicator } from './shared/ReasoningIndicator';
import { formatOutlineForExport, type OutlineExportData } from '../utils/outlineExporter';
import { apiService } from '../services/apiService';
import { OutlineSessionData } from '../../server/services/OutlineService';
import { ReasoningEvent } from '../../common/streaming/types';

interface OutlineCharacter {
    name: string;
    type?: string;
    description: string;
    age?: string;
    gender?: string;
    occupation?: string;
    personality_traits?: string[];
    character_arc?: string;
    relationships?: { [key: string]: string };
    key_scenes?: string[];
}

interface DynamicOutlineResultsProps {
    sessionId: string;
    components: {
        title?: string;
        genre?: string;
        target_audience?: {
            demographic?: string;
            core_themes?: string[];
        };
        selling_points?: string | string[];
        satisfaction_points?: string[];
        setting?: string;
        synopsis?: string;
        // New enhanced stages structure
        stages?: Array<{
            title?: string;
            stageSynopsis?: string;
            numberOfEpisodes?: number;
            timeframe?: string;
            startingCondition?: string;
            endingCondition?: string;
            stageStartEvent?: string;
            stageEndEvent?: string;
            keyPoints?: Array<{
                event: string;
                timeSpan?: string;
                emotionArcs?: Array<{
                    characters: string[];
                    content: string;
                }>;
                relationshipDevelopments?: Array<{
                    characters: string[];
                    content: string;
                }>;
            }>;
            externalPressure?: string;
        }>;
        // Legacy synopsis_stages for backward compatibility
        synopsis_stages?: Array<{
            stageSynopsis: string;
            numberOfEpisodes: number;
            timeframe?: string;
            startingCondition?: string;
            endingCondition?: string;
            stageStartEvent?: string;
            stageEndEvent?: string;
            keyMilestones?: Array<{
                event: string;
                timeSpan: string;
            }>;
            externalPressure?: string;
        }> | string[];
        characters?: OutlineCharacter[];
    };
    status: 'active' | 'completed' | 'failed';
    isStreaming?: boolean;
    isConnecting?: boolean;
    isThinking?: boolean;
    onStopStreaming?: () => void;
    onComponentUpdate?: (componentType: string, newValue: string, newArtifactId: string) => void;
    onRegenerate?: () => void;
    // New props for real-time streaming
    streamingItems?: any[];
    // Additional props needed for export
    sourceArtifact?: {
        text: string;
        title?: string;
        type: string;
    };
    totalEpisodes?: number;
    episodeDuration?: number;
    createdAt?: string;
    reasoningEvent?: ReasoningEvent | null;
}

export const DynamicOutlineResults: React.FC<DynamicOutlineResultsProps> = ({
    sessionId,
    components,
    status,
    isStreaming = false,
    isConnecting = false,
    isThinking = false,
    onStopStreaming,
    onComponentUpdate,
    onRegenerate,
    streamingItems = [],
    sourceArtifact,
    totalEpisodes,
    episodeDuration,
    createdAt,
    reasoningEvent
}) => {
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');
    const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Determine streaming status
    const streamingStatus = isConnecting ? 'idle' : isStreaming ? 'streaming' : 'completed';

    // Use TanStack Query to load original data
    const { data: originalData, isLoading: isLoadingOriginal } = useQuery({
        queryKey: ['outline-original', sessionId],
        queryFn: () => apiService.getOriginalOutlineData(sessionId),
        enabled: !!sessionId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });

    // Use TanStack Query to load current data for comparison
    const { data: currentData } = useQuery({
        queryKey: ['outline-session', sessionId],
        queryFn: () => apiService.getOutlineSession(sessionId),
        enabled: !!sessionId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Determine which fields have been modified
    useEffect(() => {
        if (currentData?.components && originalData?.components) {
            const modified = new Set<string>();
            Object.keys(currentData.components).forEach(key => {
                if (JSON.stringify(currentData.components[key]) !== JSON.stringify(originalData.components[key])) {
                    modified.add(key);
                }
            });
            setModifiedFields(modified);
        }
    }, [currentData, originalData]);

    // Mutation for updating outline components
    const updateMutation = useMutation({
        mutationFn: async ({ componentType, value }: { componentType: string; value: any }) => {
            return apiService.updateOutlineComponent(sessionId, componentType, value);
        },
        onSuccess: (_, { componentType, value }) => {
            // Update the cache
            queryClient.invalidateQueries({ queryKey: ['outline-session', sessionId] });
            
            // Update local state
            setModifiedFields(prev => new Set([...prev, componentType]));

            // Update parent component
            if (onComponentUpdate) {
                const newArtifactId = `artifact-${Date.now()}`;
                onComponentUpdate(componentType, value, newArtifactId);
            }
        },
        onError: (error) => {
            console.error('Error saving field:', error);
            message.error('保存失败，请重试');
        }
    });

    // Mutation for reverting to original
    const revertMutation = useMutation({
        mutationFn: () => apiService.clearOutlineEdits(sessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outline-session', sessionId] });
            setModifiedFields(new Set());
            message.success('已恢复到原始版本');
        },
        onError: (error) => {
            console.error('Error reverting to original:', error);
            message.error('恢复失败，请重试');
        }
    });

    // Handle field edit with auto-save
    const handleFieldEdit = async (path: string, value: any) => {
        console.log('Field edit requested:', path, value);

        // Convert path to component type
        const componentType = pathToComponentType(path);

        let finalValue = value;

        // Handle target_audience sub-field updates by constructing complete object
        if (path.startsWith('target_audience.')) {
            const currentTargetAudience = components.target_audience || {};
            
            if (path === 'target_audience.demographic') {
                finalValue = {
                    ...currentTargetAudience,
                    demographic: value
                };
            } else if (path === 'target_audience.core_themes') {
                finalValue = {
                    ...currentTargetAudience,
                    core_themes: value
                };
            }
        }

        // Use mutation to save
        return new Promise((resolve, reject) => {
            updateMutation.mutate(
                { componentType, value: finalValue },
                {
                    onSuccess: () => resolve(undefined),
                    onError: (error) => reject(error)
                }
            );
        });
    };

    const handleRevertToOriginal = async () => {
        if (!originalData) return;

        if (!confirm('确定要恢复到原始版本吗？这将丢失所有修改。')) {
            return;
        }

        revertMutation.mutate();
    };

    const handleGenerateEpisodes = () => {
                                navigate(`/projects/${sessionId}/episodes`);
    };

    const hasModifications = modifiedFields.size > 0;

    // Convert JSON path to component type for backend
    const pathToComponentType = (path: string): string => {
        if (path === 'title') return 'title';
        if (path === 'genre') return 'genre';
        if (path.startsWith('target_audience')) return 'target_audience';
        if (path === 'selling_points') return 'selling_points';
        if (path === 'satisfaction_points') return 'satisfaction_points';
        if (path.startsWith('setting')) return 'setting';
        if (path === 'synopsis') return 'synopsis';
        if (path === 'stages' || path === 'synopsis_stages') return 'synopsis_stages';
        if (path.startsWith('characters')) return 'characters';
        return 'unknown';
    };

    // Enhanced field edit handler that provides auto-save functionality
    const createAutoSaveHandler = (path: string) => {
        return async (value: any) => {
            await handleFieldEdit(path, value);
        };
    };

    // Update field registry to include auto-save handlers
    const enhancedFieldRegistry = outlineFieldRegistry.map(field => ({
        ...field,
        onSave: createAutoSaveHandler(field.path)
    }));

    // Transform components data for streaming
    const streamingData = React.useMemo(() => {
        // Use real-time streaming items if available and streaming
        if (isStreaming && streamingItems.length > 0) {
            return streamingItems;
        }

        // Otherwise use components data
        if (!components) return [];

        // 🔥 FIX: Convert synopsis_stages to enhanced stages format for streaming
        let enhancedStages = [];
        
        if (components.stages && Array.isArray(components.stages)) {
            // Already in enhanced format
            enhancedStages = components.stages;
        } else if (components.synopsis_stages && Array.isArray(components.synopsis_stages)) {
            // Convert legacy synopsis_stages to enhanced stages format
            enhancedStages = components.synopsis_stages.map((stage, index) => {
                // Handle both legacy array format and object format
                if (typeof stage === 'string') {
                    // Legacy string array format
                    return {
                        title: `第${index + 1}阶段`,
                        stageSynopsis: stage,
                        numberOfEpisodes: 1,
                        timeframe: '',
                        startingCondition: '',
                        endingCondition: '',
                        stageStartEvent: '',
                        stageEndEvent: '',
                        keyPoints: [],
                        externalPressure: ''
                    };
                } else {
                    // Enhanced object format but stored in synopsis_stages
                    return {
                        title: stage.title || `第${index + 1}阶段`,
                        stageSynopsis: stage.stageSynopsis || '',
                        numberOfEpisodes: stage.numberOfEpisodes || 1,
                        timeframe: stage.timeframe || '',
                        startingCondition: stage.startingCondition || '',
                        endingCondition: stage.endingCondition || '',
                        stageStartEvent: stage.stageStartEvent || '',
                        stageEndEvent: stage.stageEndEvent || '',
                        // 🔥 ENHANCED: Convert keyMilestones to keyPoints if available
                        keyPoints: stage.keyMilestones ? stage.keyMilestones.map(milestone => ({
                            event: typeof milestone === 'string' ? milestone : milestone.event,
                            timeSpan: typeof milestone === 'object' ? milestone.timeSpan : '',
                            emotionArcs: [],
                            relationshipDevelopments: []
                        })) : stage.keyPoints || [],
                        externalPressure: stage.externalPressure || ''
                    };
                }
            });
        }

        // Convert the components object into a format that matches the new streaming structure
        const transformedData = {
            ...components,
            // Keep selling_points as is - let the field component handle string vs array
            selling_points: components.selling_points,
            // Keep setting as is - let the field component handle string vs object
            setting: components.setting,
            // Ensure satisfaction_points is an array
            satisfaction_points: components.satisfaction_points || [],
            // 🔥 FIX: Use the converted enhanced stages
            stages: enhancedStages,
            // Ensure characters array is properly formatted
            characters: components.characters || []
        };

        // Debug logging to understand the data structure
        console.log('[DynamicOutlineResults] Debug - original components.stages:', components.stages?.length, 'items');
        console.log('[DynamicOutlineResults] Debug - original components.synopsis_stages:', components.synopsis_stages?.length, 'items');
        console.log('[DynamicOutlineResults] Debug - converted transformedData.stages:', transformedData.stages?.length, 'items');
        if (transformedData.stages?.[0]) {
            console.log('[DynamicOutlineResults] Debug - first converted stage:', transformedData.stages[0]);
        }

        return [transformedData];
    }, [components, streamingItems, isStreaming]);

    const handleExport = () => {
        // Convert new format to export format
        const exportComponents = {
            ...components,
            // Convert selling_points to string if it's an array
            selling_points: Array.isArray(components.selling_points)
                ? components.selling_points.join('\n')
                : components.selling_points,
            // Convert stages to synopsis_stages format for export
            synopsis_stages: components.stages ? components.stages.map(stage => ({
                stageSynopsis: stage.stageSynopsis || stage.title || '',
                numberOfEpisodes: stage.numberOfEpisodes || 1,
                timeframe: stage.timeframe,
                startingCondition: stage.startingCondition || '',
                endingCondition: stage.endingCondition || '',
                stageStartEvent: stage.stageStartEvent || '',
                stageEndEvent: stage.stageEndEvent || '',
                keyMilestones: stage.keyPoints ? stage.keyPoints.map(point => ({
                    event: point.event,
                    timeSpan: point.timeSpan || ''
                })) : [],
                externalPressure: stage.externalPressure || ''
            })) : components.synopsis_stages
        };

        // Remove the new stages field for export
        delete exportComponents.stages;

        // Prepare export data
        const exportData: OutlineExportData = {
            sessionId,
            sourceArtifact: sourceArtifact || {
                text: '',
                type: 'unknown'
            },
            totalEpisodes,
            episodeDuration,
            components: exportComponents as any,
            createdAt: createdAt || new Date().toISOString()
        };

        // Generate formatted text
        const formattedText = formatOutlineForExport(exportData);
        setExportText(formattedText);
        setIsExportModalVisible(true);
    };

    const getCompletedComponentsCount = () => {
        let count = 0;
        if (components.title) count++;
        if (components.genre) count++;
        if (components.target_audience) count++;
        if (components.selling_points) count++;
        if (components.satisfaction_points && components.satisfaction_points.length > 0) count++;
        if (components.setting) count++;
        if (components.synopsis) count++;
        if ((components.stages && components.stages.length > 0) || (components.synopsis_stages && components.synopsis_stages.length > 0)) count++;
        if (components.characters && components.characters.length > 0) count++;
        return count;
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Status */}
            {status === 'failed' && (
                <Alert
                    message="生成失败"
                    description="大纲生成过程中出现错误，请重新生成。"
                    type="error"
                    showIcon
                    style={{
                        backgroundColor: '#2d1b1b',
                        border: '1px solid #d32f2f',
                        color: '#fff'
                    }}
                />
            )}

            {/* Action Buttons */}
            <Row gutter={[16, 16]}>
                <Col>
                    <Button
                        type="default"
                        icon={<ReloadOutlined />}
                        onClick={onRegenerate}
                        disabled={isStreaming}
                        style={{
                            background: '#434343',
                            borderColor: '#434343',
                            color: '#d9d9d9'
                        }}
                    >
                        重新生成
                    </Button>
                </Col>
                <Col>
                    <Button
                        type="default"
                        icon={<ExportOutlined />}
                        onClick={handleExport}
                        disabled={!components || Object.keys(components).length === 0}
                        style={{
                            background: '#434343',
                            borderColor: '#434343',
                            color: '#d9d9d9'
                        }}
                    >
                        导出大纲
                    </Button>
                </Col>
                {hasModifications && (
                    <Col>
                        <Button
                            type="default"
                            icon={<UndoOutlined />}
                            onClick={handleRevertToOriginal}
                            loading={revertMutation.isPending}
                            style={{
                                background: '#722ed1',
                                borderColor: '#722ed1',
                                color: '#fff'
                            }}
                        >
                            恢复到原始生成
                        </Button>
                    </Col>
                )}
                <Col>
                    <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={handleGenerateEpisodes}
                        disabled={!components || status !== 'completed'}
                        style={{
                            background: '#52c41a',
                            borderColor: '#52c41a'
                        }}
                    >
                        开始每集撰写
                    </Button>
                </Col>
            </Row>

            {/* Modification indicator */}
            {hasModifications && (
                <Alert
                    message={`已修改 ${modifiedFields.size} 个字段`}
                    description="您可以继续编辑或恢复到原始生成内容"
                    type="info"
                    showIcon
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #1890ff',
                        color: '#fff'
                    }}
                />
            )}

            {/* Reasoning indicator */}
            <ReasoningIndicator
                isVisible={reasoningEvent?.type === 'reasoning_start'}
                phase="outline"
                className="mb-4"
            />

            {/* Dynamic streaming UI with auto-save */}
            <DynamicStreamingUI
                fieldRegistry={enhancedFieldRegistry}
                streamingData={streamingData}
                streamingStatus={streamingStatus}
                isThinking={isThinking && reasoningEvent?.type !== 'reasoning_start'}
                onStopStreaming={onStopStreaming}
                onFieldEdit={handleFieldEdit}
                className="outline-results"
            />

            {/* Empty state */}
            {!components || Object.keys(components).length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #303030',
                    borderRadius: '8px'
                }}>
                    {isStreaming ? '正在生成大纲...' : '暂无大纲数据'}
                </div>
            ) : null}

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                exportText={exportText}
                title="导出大纲"
            />
        </Space>
    );
};

export default DynamicOutlineResults; 