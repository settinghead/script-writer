import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Typography, Tabs, Spin, Alert, Select, Button, Space, Form, Input, Divider } from 'antd';
import { ToolOutlined, BugOutlined, FileTextOutlined, DatabaseOutlined, SaveOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useDebugParams } from '../../hooks/useDebugParams';
import { extractCanonicalJsondocIds } from '../../../common/canonicalJsondocLogic';
import { applyPatch, deepClone } from 'fast-json-patch';
import * as Diff from 'diff';
import { applyContextDiffToJSON, applyContextDiffAndGeneratePatches } from '../../../common/contextDiff';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../../../common/types';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Diff view component - same as PatchReviewModal
const DiffView: React.FC<{ oldValue: string; newValue: string }> = ({ oldValue, newValue }) => {
    const diff = Diff.diffWords(oldValue || '', newValue || '');

    return (
        <pre style={{
            background: '#1a1a1a',
            border: '1px solid #434343',
            borderRadius: '4px',
            padding: '8px',
            marginTop: '4px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '14px',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '600px'
        }}>
            {diff.map((part, index) => {
                if (part.removed) {
                    return (
                        <span
                            key={index}
                            style={{
                                backgroundColor: '#4a1a1a',
                                color: '#ff7875',
                                textDecoration: 'line-through',
                                padding: '2px 0'
                            }}
                        >
                            {part.value}
                        </span>
                    );
                } else if (part.added) {
                    return (
                        <span
                            key={index}
                            style={{
                                backgroundColor: '#1a4a1a',
                                color: '#95f985',
                                padding: '2px 0'
                            }}
                        >
                            {part.value}
                        </span>
                    );
                } else {
                    return (
                        <span key={index} style={{ color: '#d9d9d9' }}>
                            {part.value}
                        </span>
                    );
                }
            })}
        </pre>
    );
};

interface RawAgentContextProps {
    projectId: string;
}

interface Tool {
    name: string;
    description: string;
    inputSchema: any;
    templatePath: string;
    hasCustomTemplateVariables: boolean;
}

interface JsondocInfo {
    id: string;
    schemaType: string;
    schemaVersion: string;
    originType: string;
    createdAt: string;
    dataPreview: string;
}

interface PromptResult {
    tool: {
        name: string;
        description: string;
        templatePath: string;
    };
    input: any;
    templateVariables: Record<string, string>;
    fieldTitles: Record<string, string>;
    prompt: string;
}

// Streaming chunk data structure
interface StreamingChunk {
    type: 'rawText' | 'eagerPatches' | 'patches' | 'finalPatches' | 'pipelineResults' | 'chunk' | 'result' | 'status' | 'error';
    chunkCount?: number;
    patches?: any[];
    source?: string;
    textDelta?: string;
    accumulatedText?: string;
    attempt?: number;
    newPatchCount?: number;
    data?: any;
    message?: string;
    // NEW: Pipeline results from internalized debug-context-diff.ts logic
    status?: string;
    rawLLMOutput?: string;
    modifiedJson?: string;
    originalJsonLength?: number;
    modifiedJsonLength?: number;
    patchCount?: number;
}

// Helper function to provide default parameters for tools
const getDefaultParamsForTool = (toolName: string): Record<string, any> => {
    switch (toolName) {
        case 'edit_灵感创意':
            return {
                editRequirements: '调整故事内容，增强吸引力',
                ideaIndex: 0
            };
        case 'generate_灵感创意s':
            return {
                otherRequirements: '生成有创意的故事想法，快节奏，高颜值主角'
            };
        case 'generate_剧本设定':
            return {
                '其他要求': ''
            };
        case 'improve_剧本设定':
            return {
                editRequirements: '调整剧本设定，优化角色设定和故事背景'
            };
        case 'generate_chronicles':
            return {
                requirements: '按时间顺序展开故事，注重情感节拍和冲突设置'
            };
        case 'edit_chronicles':
            return {
                editRequirements: '调整时间线，优化故事发展节奏'
            };
        case 'generate_episode_planning':
            return {
                numberOfEpisodes: 20,
                requirements: '适合短视频平台，每集2-3分钟，注重钩子设计和悬念'
            };
        case 'edit_episode_planning':
            return {
                editRequirements: '调整剧集分组，优化观看顺序和情感节拍'
            };
        case 'generate_episode_synopsis':
            return {
                groupTitle: '第一组：相遇篇',
                episodeStart: 1,
                episodeEnd: 1
            };
        default:
            console.error(`[getDefaultParamsForTool] Missing default parameters for tool: ${toolName}`);
            throw new Error(`Default parameters not defined for tool: ${toolName}. Please add it to getDefaultParamsForTool() function.`);
    }
};

// Helper function to get expected jsondoc types for tools
const getExpectedJsondocTypes = (toolName: string): string[] => {
    switch (toolName) {
        case 'edit_灵感创意':
            return ['brainstorm_collection', '灵感创意'];
        case 'generate_灵感创意s':
            return ['brainstorm_input_params'];
        case 'generate_剧本设定':
            return ['brainstorm_collection', '灵感创意'];
        case 'improve_剧本设定':
            return ['剧本设定'];
        case 'generate_chronicles':
            return ['剧本设定', 'brainstorm_collection'];
        case 'edit_chronicles':
            return ['chronicles'];
        case 'generate_episode_planning':
            return ['chronicles', '剧本设定'];
        case 'edit_episode_planning':
            return ['episode_planning'];
        case 'generate_episode_synopsis':
            return ['episode_planning'];
        default:
            console.error(`[getExpectedJsondocTypes] Missing expected jsondoc types for tool: ${toolName}`);
            throw new Error(`Expected jsondoc types not defined for tool: ${toolName}. Please add it to getExpectedJsondocTypes() function.`);
    }
};

// Helper function to check if jsondoc is compatible with tool
const isJsondocCompatible = (jsondocType: string, toolName: string): boolean => {
    const expectedTypes = getExpectedJsondocTypes(toolName);
    return expectedTypes.length === 0 || expectedTypes.includes(jsondocType);
};

// Helper function to check if tool is an edit tool (uses context-based diff)
const isEditTool = (toolName: string): boolean => {
    return toolName.startsWith('edit_');
};

const RawTooLCall: React.FC<RawAgentContextProps> = ({ projectId }) => {
    const [tools, setTools] = useState<Tool[]>([]);
    const [jsondocs, setJsondocs] = useState<JsondocInfo[]>([]);
    // Get jsondocs and selectors from ProjectDataContext instead of fetching separately
    const {
        jsondocs: rawJsondocs,
        getJsondocById,
        lineageGraph,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs,
        isLoading: contextLoading
    } = useProjectData();

    // Get the pre-computed canonical context
    const projectDataContext = useProjectData();
    const canonicalContextFromData = projectDataContext.canonicalContext === "pending" || projectDataContext.canonicalContext === "error"
        ? null
        : projectDataContext.canonicalContext;

    const [canonicalJsondocIds, setCanonicalJsondocIds] = useState<Set<string>>(new Set());
    const [promptResult, setPromptResult] = useState<PromptResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toolsLoading, setToolsLoading] = useState(true);
    const [jsondocsLoading, setJsondocsLoading] = useState(true);

    // Dry run state - updated for new streaming system
    const [nonPersistentRunLoading, setNonPersistentRunLoading] = useState(false);
    const [nonPersistentRunResults, setNonPersistentRunResults] = useState<any>(null);
    const [nonPersistentRunStatus, setNonPersistentRunStatus] = useState<string>('');
    const [rawTextStream, setRawTextStream] = useState<string>('');
    const [streamingChunks, setStreamingChunks] = useState<StreamingChunk[]>([]);
    const [finalPatches, setFinalPatches] = useState<any[]>([]);

    // Real-time patch-applied JSON state
    const [originalJsonString, setOriginalJsonString] = useState<string>('');
    const [currentPatchedJsonString, setCurrentPatchedJsonString] = useState<string>('');
    const [currentPatches, setCurrentPatches] = useState<any[]>([]);

    // NEW: Pipeline results state for real-time debugging
    const [pipelineResults, setPipelineResults] = useState<{
        status: string;
        rawLLMOutputLength: number;
        modifiedJsonLength: number;
        patchCount: number;
        originalJsonLength: number;
    } | null>(null);

    // Use the debug params hook for persistence
    const {
        selectedTool,
        selectedJsondocs,
        additionalParams,
        setSelectedTool,
        setSelectedJsondocs,
        setAdditionalParams,
        saveParams,
        loadParams,
        clearParams,
        isLoading: paramsLoading,
        error: paramsError
    } = useDebugParams({ projectId });

    // Create request payload for debouncing
    const requestPayload = useMemo(() => {
        if (!selectedTool) {
            return null;
        }

        if (selectedJsondocs.length === 0) {
            return null;
        }

        // Wait for jsondocs to be loaded before processing selectedJsondocs
        if (jsondocsLoading || jsondocs.length === 0) {
            return null;
        }

        let parsedParams = {};
        try {
            if (additionalParams.trim()) {
                parsedParams = JSON.parse(additionalParams);
            }
        } catch (err) {
            return null; // Invalid JSON, don't make request
        }

        // Add default values for commonly required fields
        const defaultParams = getDefaultParamsForTool(selectedTool);
        const mergedParams = { ...defaultParams, ...parsedParams };

        // Prepare jsondocs array for the request
        // First, filter out any selectedJsondocs that don't exist in the current project
        const validSelectedJsondocs = selectedJsondocs.filter(jsondocId => {
            const jsondoc = jsondocs.find(j => j.id === jsondocId);
            if (!jsondoc) {
                console.warn(`[DebugRawToolCall] Jsondoc ${jsondocId} not found in current project - removing from selection`);
                return false;
            }
            return true;
        });

        // If any jsondocs were filtered out, update the selection
        if (validSelectedJsondocs.length !== selectedJsondocs.length) {
            console.warn(`[DebugRawToolCall] Cleaned up selectedJsondocs: ${selectedJsondocs.length} -> ${validSelectedJsondocs.length}`);
            setSelectedJsondocs(validSelectedJsondocs);
            return null; // Return null to trigger re-computation with cleaned selection
        }

        const jsondocsArray = validSelectedJsondocs.map(jsondocId => {
            const jsondoc = jsondocs.find(j => j.id === jsondocId);
            // This should never happen now due to filtering above, but keep as safety net
            if (!jsondoc) {
                throw new Error(`Jsondoc with ID ${jsondocId} not found after validation. This should not happen.`);
            }
            if (!jsondoc.schemaType) {
                throw new Error(`Jsondoc ${jsondocId} has no schemaType. This indicates a data integrity issue.`);
            }
            return {
                jsondocId,
                description: `${jsondoc.schemaType} (${jsondoc.originType})`,
                schemaType: jsondoc.schemaType
            };
        });

        const payload = {
            toolName: selectedTool,
            jsondocs: jsondocsArray,
            additionalParams: mergedParams
        };

        return payload;
    }, [selectedTool, selectedJsondocs, additionalParams, jsondocs, jsondocsLoading, setSelectedJsondocs]);

    // Single debounced request payload
    const debouncedRequestPayload = useDebounce(requestPayload, 1000);

    // Clear incompatible jsondocs when tool changes
    useEffect(() => {
        if (selectedTool && selectedJsondocs.length > 0) {
            const compatibleJsondocs = selectedJsondocs.filter(jsondocId => {
                const jsondoc = jsondocs.find(j => j.id === jsondocId);
                return jsondoc && isJsondocCompatible(jsondoc.schemaType, selectedTool);
            });

            if (compatibleJsondocs.length !== selectedJsondocs.length) {
                setSelectedJsondocs(compatibleJsondocs);
            }
        }
    }, [selectedTool, jsondocs]);

    // Populate default parameters when tool changes
    useEffect(() => {
        if (selectedTool) {
            const defaultParams = getDefaultParamsForTool(selectedTool);
            if (Object.keys(defaultParams).length > 0) {
                // Only set if additionalParams is empty or just '{}'
                if (additionalParams.trim() === '' || additionalParams.trim() === '{}') {
                    setAdditionalParams(JSON.stringify(defaultParams, null, 2));
                }
            }
        }
    }, [selectedTool]);

    // Load available tools
    useEffect(() => {
        const loadTools = async () => {
            try {
                setToolsLoading(true);
                const response = await fetch('/api/admin/tools', {
                    headers: {
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load tools: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.success) {
                    setTools(result.tools);
                } else {
                    throw new Error(result.error || 'Failed to load tools');
                }
            } catch (err) {
                console.error('Error loading tools:', err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setToolsLoading(false);
            }
        };

        loadTools();
    }, []);

    // Compute canonical jsondocs from ProjectDataContext data
    useEffect(() => {
        if (contextLoading ||
            !Array.isArray(rawJsondocs) ||
            lineageGraph === "pending" || lineageGraph === "error" ||
            !Array.isArray(transforms) ||
            !Array.isArray(humanTransforms) ||
            !Array.isArray(transformInputs) ||
            !Array.isArray(transformOutputs)) {
            setJsondocsLoading(true);
            return;
        }

        try {
            setJsondocsLoading(true);

            // Use pre-computed canonical context from project data
            const canonicalContext = canonicalContextFromData;

            if (!canonicalContext) {
                setJsondocsLoading(false);
                return;
            }

            const canonicalIds = extractCanonicalJsondocIds(canonicalContext);

            // Add episode synopsis jsondocs to canonical set
            canonicalContext.canonicalEpisodeSynopsisList.forEach(episode => {
                canonicalIds.add(episode.id);
            });

            setCanonicalJsondocIds(canonicalIds);

            // Filter jsondocs to only show canonical ones and convert to JsondocInfo format
            const canonicalJsondocs: JsondocInfo[] = rawJsondocs
                .filter(j => canonicalIds.has(j.id))
                .map(j => {
                    // Create data preview like RawGraphVisualization does
                    let dataPreview = '';
                    try {
                        const data = typeof j.data === 'string' ? JSON.parse(j.data) : j.data;
                        if (j.schema_type === 'brainstorm_collection') {
                            if (data.ideas && Array.isArray(data.ideas) && data.ideas.length > 0) {
                                const firstIdea = data.ideas[0];
                                const title = firstIdea.title || '';
                                dataPreview = title.length > 25 ? `${title.substring(0, 25)}...` : title;
                            } else {
                                dataPreview = '创意集合';
                            }
                        } else if (j.schema_type === '灵感创意') {
                            const title = data.title || '';
                            dataPreview = title.length > 25 ? `${title.substring(0, 25)}...` : title;
                        } else if (j.schema_type === '剧本设定') {
                            const outlineTitle = data.title || data.synopsis || '';
                            dataPreview = outlineTitle.length > 25 ? `${outlineTitle.substring(0, 25)}...` : outlineTitle;
                        } else {
                            // Generic preview for other types
                            const keys = Object.keys(data || {});
                            if (keys.length > 0) {
                                const firstKey = keys[0];
                                const firstValue = data[firstKey];
                                if (typeof firstValue === 'string') {
                                    dataPreview = firstValue.length > 25 ? `${firstValue.substring(0, 25)}...` : firstValue;
                                } else {
                                    dataPreview = `${firstKey}: ${typeof firstValue}`;
                                }
                            } else {
                                dataPreview = '空数据';
                            }
                        }
                    } catch (error) {
                        dataPreview = '数据解析错误';
                    }

                    return {
                        id: j.id,
                        schemaType: j.schema_type,
                        schemaVersion: j.schema_version,
                        originType: j.origin_type || 'unknown',
                        createdAt: j.created_at,
                        dataPreview: dataPreview || '无预览'
                    };
                });

            setJsondocs(canonicalJsondocs);
            console.log('[DebugRawToolCall] Computed canonical jsondocs:', canonicalJsondocs.length, 'out of', rawJsondocs.length);

        } catch (err) {
            console.error('Error computing canonical jsondocs:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setJsondocsLoading(false);
        }
    }, [rawJsondocs, lineageGraph, transforms, humanTransforms, transformInputs, transformOutputs, contextLoading]);

    // Generate prompt with the given payload
    const generatePromptWithPayload = useCallback(async (requestBody: any) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/admin/tools/${requestBody.toolName}/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                setPromptResult(result);
            } else {
                throw new Error(result.error || 'Failed to generate prompt');
            }
        } catch (err) {
            console.error('Error generating prompt:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    // Automatic prompt generation when debounced request payload changes
    useEffect(() => {
        if (debouncedRequestPayload) {
            generatePromptWithPayload(debouncedRequestPayload);
        } else {
            // Clear results when selections are invalid
            setPromptResult(null);
            setError(null);
        }
    }, [debouncedRequestPayload]);

    // Function to apply patches to original JSON and return the result
    const applyPatchesToOriginal = useCallback((patches: any[], original: string): string => {
        console.log('[DebugRawToolCall] applyPatchesToOriginal called:', {
            patchesCount: patches?.length,
            originalLength: original?.length,
            patches: patches
        });

        if (!patches || patches.length === 0 || !original) {
            console.warn('[DebugRawToolCall] Early return from applyPatchesToOriginal:', {
                hasPatches: !!patches,
                patchesLength: patches?.length,
                hasOriginal: !!original
            });
            return original;
        }

        try {
            const originalData = JSON.parse(original);
            const originalCopy = deepClone(originalData);
            console.log('[DebugRawToolCall] About to apply patches:', patches);
            const patchResults = applyPatch(originalCopy, patches);

            console.log('[DebugRawToolCall] Patch results:', patchResults);

            // Check if all patches applied successfully
            const failedPatches = patchResults.filter(r => r.test === false);
            if (failedPatches.length > 0) {
                console.warn(`[DebugRawToolCall] ${failedPatches.length} patches failed to apply:`, failedPatches);
            } else {
                console.log(`[DebugRawToolCall] All ${patches.length} patches applied successfully`);
            }

            const result = JSON.stringify(originalCopy, null, 2);
            console.log('[DebugRawToolCall] Final result length:', result.length);
            return result;
        } catch (error) {
            console.error('[DebugRawToolCall] Failed to apply patches:', error);
            return original;
        }
    }, []);

    // Non-persistent run function - updated for new streaming system
    const runNonPersistentRun = async (toolName: string, input: any) => {
        setNonPersistentRunLoading(true);
        setNonPersistentRunResults(null);
        setNonPersistentRunStatus('开始非持久化运行...');
        setRawTextStream('');
        setStreamingChunks([]);
        setFinalPatches([]);
        setCurrentPatches([]);
        setPipelineResults(null); // Reset pipeline results for new run

        // If this is an edit tool, capture the original JSON for diff comparison
        const isEdit = isEditTool(toolName);
        console.log('[DebugRawToolCall] Edit tool check:', { toolName, isEdit, hasJsondocs: input.jsondocs?.length > 0, rawJsondocsCount: Array.isArray(rawJsondocs) ? rawJsondocs.length : 'loading' });

        let capturedOriginalJsonString = '';  // Local variable to avoid state race conditions

        if (isEdit && input.jsondocs && input.jsondocs.length > 0) {
            try {
                // Get the first jsondoc as the target for editing
                const targetJsondocId = input.jsondocs[0].jsondocId;
                console.log('[DebugRawToolCall] Looking for jsondoc:', targetJsondocId);
                console.log('[DebugRawToolCall] Available jsondoc IDs:', Array.isArray(rawJsondocs) ? rawJsondocs.map(j => j.id) : 'loading...');

                // Use the ProjectDataContext selector to get the jsondoc (better data handling)
                const targetJsondoc = getJsondocById(targetJsondocId);
                console.log('[DebugRawToolCall] Jsondoc from context:', targetJsondoc);

                if (targetJsondoc) {
                    try {
                        // Use the same data access pattern as RawGraphVisualization
                        let originalData;
                        if (typeof targetJsondoc.data === 'string') {
                            originalData = JSON.parse(targetJsondoc.data);
                        } else {
                            originalData = targetJsondoc.data;
                        }

                        console.log('[DebugRawToolCall] Parsed original data:', {
                            dataType: typeof originalData,
                            isNull: originalData === null,
                            isUndefined: originalData === undefined,
                            hasKeys: originalData && typeof originalData === 'object' ? Object.keys(originalData).length : 0
                        });

                        if (originalData === undefined || originalData === null) {
                            console.warn('[DebugRawToolCall] Original data is null/undefined, using fallback');
                            capturedOriginalJsonString = '// Original jsondoc data is undefined or null\n// Jsondoc ID: ' + targetJsondocId + '\n// Schema: ' + targetJsondoc.schema_type;
                        } else {
                            const jsonString = JSON.stringify(originalData, null, 2);
                            console.log('[DebugRawToolCall] JSON.stringify successful, length:', jsonString.length);
                            console.log('[DebugRawToolCall] Setting originalJsonString preview:', jsonString.substring(0, 100) + '...');
                            capturedOriginalJsonString = jsonString;
                        }
                    } catch (parseError) {
                        console.error('[DebugRawToolCall] Failed to parse jsondoc data:', parseError);
                        capturedOriginalJsonString = '// Failed to parse jsondoc data: ' + parseError;
                    }
                } else {
                    console.warn('[DebugRawToolCall] Jsondoc not found in context:', targetJsondocId);
                    capturedOriginalJsonString = '// Jsondoc not found: ' + targetJsondocId;
                }
            } catch (error) {
                console.warn('[DebugRawToolCall] Failed to capture original JSON for diff:', error);
                capturedOriginalJsonString = '// Failed to capture original JSON: ' + error;
            }
        }

        // Set state variables after capturing (avoid race conditions)
        console.log('[DebugRawToolCall] Setting state with captured original JSON:', capturedOriginalJsonString.length, 'characters');
        setOriginalJsonString(capturedOriginalJsonString);
        setCurrentPatchedJsonString(capturedOriginalJsonString || ''); // Initialize with original

        try {
            const response = await fetch(`/api/admin/tools/${toolName}/non-persistent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                body: JSON.stringify(input)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            let consolidatedResult: any = {};

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                let currentEvent = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            // Debug all received data
                            if (currentEvent === 'finalPatches') {
                                console.log('[DebugRawToolCall] Raw SSE data for finalPatches:', {
                                    currentEvent,
                                    data: data,
                                    dataType: typeof data,
                                    dataKeys: Object.keys(data || {}),
                                    rawLine: line
                                });
                            }

                            if (currentEvent === 'rawText') {
                                // Handle raw text streaming for debugging
                                setRawTextStream(prev => prev + data.textDelta);
                                setNonPersistentRunStatus(`接收原始文本... (第${data.chunkCount}块)`);

                            } else if (currentEvent === 'pipelineResults') {
                                // NEW: Handle internalized pipeline results - this is the main data source now
                                setNonPersistentRunStatus(`处理管道结果... (状态: ${data.status}, 补丁: ${data.patchCount || 0})`);

                                // Update pipeline results state for debugging display
                                setPipelineResults({
                                    status: data.status || 'unknown',
                                    rawLLMOutputLength: data.rawLLMOutput?.length || 0,
                                    modifiedJsonLength: data.modifiedJsonLength || 0,
                                    patchCount: data.patchCount || 0,
                                    originalJsonLength: data.originalJsonLength || 0
                                });

                                // Update raw text stream from pipeline
                                if (data.rawLLMOutput) {
                                    setRawTextStream(data.rawLLMOutput);
                                }

                                // Apply patches from pipeline results if available
                                if (data.patches && data.patches.length > 0 && capturedOriginalJsonString && !capturedOriginalJsonString.startsWith('//')) {
                                    const patchedJson = applyPatchesToOriginal(data.patches, capturedOriginalJsonString);
                                    setCurrentPatchedJsonString(patchedJson);
                                    setCurrentPatches(data.patches);
                                } else if (data.modifiedJson && capturedOriginalJsonString && !capturedOriginalJsonString.startsWith('//')) {
                                    // Use modified JSON directly from pipeline if patches aren't available
                                    setCurrentPatchedJsonString(data.modifiedJson);
                                }

                            } else if (currentEvent === 'eagerPatches') {
                                // Handle eager patch data - apply patches in real-time
                                setNonPersistentRunStatus(`接收急切补丁... (第${data.chunkCount}块, ${data.patches?.length || 0}个补丁, 尝试${data.attempt})`);

                                if (data.patches && data.patches.length > 0 && capturedOriginalJsonString && !capturedOriginalJsonString.startsWith('//')) {
                                    // Apply patches and update current view
                                    const patchedJson = applyPatchesToOriginal(data.patches, capturedOriginalJsonString);
                                    setCurrentPatchedJsonString(patchedJson);
                                    setCurrentPatches(data.patches);
                                }

                            } else if (currentEvent === 'patches') {
                                // Handle regular patch data
                                setNonPersistentRunStatus(`接收补丁数据... (第${data.chunkCount}块, ${data.patches?.length || 0}个补丁)`);

                                if (data.patches && data.patches.length > 0 && capturedOriginalJsonString && !capturedOriginalJsonString.startsWith('//')) {
                                    // Apply patches and update current view
                                    const patchedJson = applyPatchesToOriginal(data.patches, capturedOriginalJsonString);
                                    setCurrentPatchedJsonString(patchedJson);
                                    setCurrentPatches(data.patches);
                                }

                            } else if (currentEvent === 'finalPatches') {
                                // Handle final patches
                                console.log('[DebugRawToolCall] Received finalPatches:', {
                                    dataPatches: data.patches,
                                    patchesLength: data.patches?.length,
                                    patchesType: typeof data.patches,
                                    capturedOriginalJsonStringExists: !!capturedOriginalJsonString,
                                    capturedOriginalJsonStringStartsWithComment: capturedOriginalJsonString?.startsWith('//'),
                                    capturedOriginalJsonStringLength: capturedOriginalJsonString?.length
                                });

                                setFinalPatches(data.patches || []);
                                setNonPersistentRunResults(data.patches);
                                setNonPersistentRunStatus(`接收最终补丁... (${data.patches?.length || 0}个补丁)`);

                                if (data.patches && data.patches.length > 0 && capturedOriginalJsonString && !capturedOriginalJsonString.startsWith('//')) {
                                    console.log('[DebugRawToolCall] Applying final patches:', data.patches.length, 'patches to original JSON');
                                    // Apply final patches
                                    const patchedJson = applyPatchesToOriginal(data.patches, capturedOriginalJsonString);
                                    console.log('[DebugRawToolCall] Patch application result:', {
                                        originalLength: capturedOriginalJsonString.length,
                                        patchedLength: patchedJson.length,
                                        changed: patchedJson !== capturedOriginalJsonString
                                    });
                                    setCurrentPatchedJsonString(patchedJson);
                                    setCurrentPatches(data.patches);
                                } else {
                                    console.warn('[DebugRawToolCall] Final patches not applied - conditions not met:', {
                                        hasPatches: !!(data.patches && data.patches.length > 0),
                                        hasCapturedOriginalJson: !!capturedOriginalJsonString,
                                        capturedoriginalJsonValid: capturedOriginalJsonString && !capturedOriginalJsonString.startsWith('//')
                                    });
                                }

                            } else if (currentEvent === 'chunk' && data.data) {
                                // Handle both array and object data structures
                                if (Array.isArray(data.data)) {
                                    // For array data, update the consolidated result
                                    consolidatedResult = data.data;
                                    setNonPersistentRunResults(consolidatedResult);
                                } else {
                                    // For object data, merge into consolidated result
                                    consolidatedResult = { ...consolidatedResult, ...data.data };
                                    setNonPersistentRunResults(consolidatedResult);
                                }
                                setNonPersistentRunStatus(`接收数据中... (第${data.chunkCount}块)`);
                            } else if (currentEvent === 'result' && data.message === 'Non-persistence run completed successfully') {
                                setNonPersistentRunStatus('非持久化运行完成');
                            } else if (currentEvent === 'status' && data.message) {
                                setNonPersistentRunStatus(data.message);
                            } else if (currentEvent === 'error') {
                                setNonPersistentRunStatus(`错误: ${data.message}`);
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Non-persistent run error:', error);
            setNonPersistentRunStatus(`错误: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setNonPersistentRunLoading(false);
        }
    };

    const renderCodeBlock = (content: string, maxHeight = '800px') => (
        <div style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '16px',
            lineHeight: '1.4',
            color: '#e6e6e6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#0d1117',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            maxHeight,
            overflow: 'auto'
        }}>
            {content}
        </div>
    );

    // Two-column responsive layout components
    const renderConfigurationColumn = () => (
        <div style={{ minWidth: '400px' }}>
            <Alert
                message="自动生成提示词"
                description="选择工具和数据后，提示词将自动生成，无需手动点击按钮。仅显示规范数据源（最新/派生版本）"
                type="info"
                style={{ marginBottom: 16 }}
                showIcon
            />

            <Form layout="vertical">
                <Form.Item label="选择工具">
                    <Select
                        value={selectedTool}
                        onChange={setSelectedTool}
                        placeholder="选择一个工具"
                        loading={toolsLoading}
                        size="large"
                        style={{ width: '100%' }}
                    >
                        {tools.map(tool => (
                            <Option key={tool.name} value={tool.name}>
                                <div>
                                    <Text strong>{tool.name}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {tool.description}
                                    </Text>
                                </div>
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label="选择数据源">
                    <Select
                        mode="multiple"
                        value={selectedJsondocs}
                        onChange={setSelectedJsondocs}
                        placeholder="选择一个或多个数据源"
                        loading={jsondocsLoading}
                        size="large"
                        style={{ width: '100%' }}
                        optionLabelProp="label"
                    >
                        {jsondocs
                            .filter(jsondoc => !selectedTool || isJsondocCompatible(jsondoc.schemaType, selectedTool))
                            .map(jsondoc => (
                                <Option
                                    key={jsondoc.id}
                                    value={jsondoc.id}
                                    label={`${jsondoc.schemaType} (${jsondoc.originType}) [规范]`}
                                >
                                    <div>
                                        <Text strong>{jsondoc.schemaType}</Text>
                                        <Text type="secondary"> ({jsondoc.originType})</Text>
                                        <Text style={{ color: '#52c41a', fontSize: '11px' }}> [规范]</Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            {jsondoc.dataPreview}
                                        </Text>
                                    </div>
                                </Option>
                            ))}
                    </Select>
                    {selectedTool && (
                        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                            <Text type="secondary">
                                期望数据类型: {getExpectedJsondocTypes(selectedTool).join(', ') || '任意类型'}
                            </Text>
                            <br />
                            <Text style={{ color: '#52c41a', fontSize: '11px' }}>
                                ✅ 仅显示规范数据源（最新/派生版本）
                            </Text>
                            {jsondocs.filter(jsondoc => isJsondocCompatible(jsondoc.schemaType, selectedTool)).length === 0 && (
                                <div style={{ marginTop: 4, color: '#ff4d4f' }}>
                                    ⚠️ 当前项目中没有与此工具兼容的规范数据
                                </div>
                            )}
                        </div>
                    )}
                </Form.Item>

                <Form.Item label="附加参数 (JSON)">
                    <TextArea
                        value={additionalParams}
                        onChange={(e) => setAdditionalParams(e.target.value)}
                        placeholder='{"key": "value"}'
                        rows={4}
                        style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
                    />
                    {selectedTool && (
                        <div style={{ marginTop: 8, fontSize: '12px' }}>
                            <Text type="secondary">默认参数:</Text>
                            <div style={{
                                marginTop: 4,
                                padding: 8,
                                backgroundColor: '#262626',
                                borderRadius: 4,
                                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                fontSize: '11px',
                                color: '#ccc'
                            }}>
                                {JSON.stringify(getDefaultParamsForTool(selectedTool), null, 2)}
                            </div>
                        </div>
                    )}
                </Form.Item>
            </Form>

            {/* Persistence Controls */}
            <div style={{ marginTop: 16 }}>
                <Divider />
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={loadParams}
                        size="small"
                        loading={paramsLoading}
                    >
                        重新加载
                    </Button>
                    <Button
                        icon={<DeleteOutlined />}
                        onClick={clearParams}
                        size="small"
                        danger
                        loading={paramsLoading}
                    >
                        清除参数
                    </Button>
                    <Button
                        icon={<PlayCircleOutlined />}
                        onClick={() => {
                            if (!selectedTool || selectedJsondocs.length === 0) return;

                            let parsedParams = {};
                            try {
                                if (additionalParams.trim()) {
                                    parsedParams = JSON.parse(additionalParams);
                                }
                            } catch (e) {
                                setError('Invalid JSON in additional parameters');
                                return;
                            }

                            // Merge default parameters with user-provided parameters
                            const defaultParams = getDefaultParamsForTool(selectedTool);
                            const mergedParams = { ...defaultParams, ...parsedParams };

                            runNonPersistentRun(selectedTool, {
                                jsondocs: selectedJsondocs.map(id => {
                                    const jsondoc = jsondocs.find(j => j.id === id);
                                    if (!jsondoc) {
                                        throw new Error(`Jsondoc with ID ${id} not found during test run. This should not happen - check jsondoc loading logic.`);
                                    }
                                    if (!jsondoc.schemaType) {
                                        throw new Error(`Jsondoc ${id} has no schemaType during test run. This indicates a data integrity issue.`);
                                    }
                                    return {
                                        jsondocId: id,
                                        description: jsondoc.schemaType,
                                        schemaType: jsondoc.schemaType
                                    };
                                }),
                                additionalParams: mergedParams
                            });
                        }}
                        size="small"
                        loading={nonPersistentRunLoading}
                        disabled={!selectedTool || selectedJsondocs.length === 0}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                    >
                        执行测试运行
                    </Button>
                </Space>

                {paramsError && (
                    <Alert
                        message="参数保存错误"
                        description={paramsError}
                        type="warning"
                        style={{ marginTop: 8 }}
                        closable
                    />
                )}

                {paramsLoading && (
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            <Spin size="small" style={{ marginRight: 4 }} />
                            正在处理参数...
                        </Text>
                    </div>
                )}
            </div>

            {loading && (
                <Alert
                    message="正在生成提示词..."
                    type="info"
                    style={{ marginTop: 16 }}
                    showIcon
                />
            )}

            {error && (
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    style={{ marginTop: 16 }}
                    closable
                    onClose={() => setError(null)}
                />
            )}

            {/* Tool Schema Section */}
            {selectedTool && (
                <div style={{ marginTop: 24 }}>
                    <Divider />
                    <Title level={5} style={{ color: '#fff' }}>
                        <DatabaseOutlined style={{ marginRight: 8 }} />
                        工具输入模式
                    </Title>
                    {(() => {
                        const tool = tools.find(t => t.name === selectedTool);
                        return tool ? renderCodeBlock(JSON.stringify(tool.inputSchema, null, 2), '400px') : null;
                    })()}
                </div>
            )}
        </div>
    );

    const renderResultsColumn = () => (
        <div style={{ minWidth: '400px' }}>
            {promptResult ? (
                <div>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        生成结果
                    </Title>

                    <Title level={5} style={{ color: '#fff', marginTop: 20 }}>完整提示词</Title>
                    {renderCodeBlock(promptResult.prompt, '800px')}

                    <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#262626', borderRadius: 8 }}>
                        <Text strong style={{ color: '#fff' }}>工具: </Text>
                        <Text code>{promptResult.tool.name}</Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>描述: </Text>
                        <Text type="secondary">{promptResult.tool.description}</Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>模板: </Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>{promptResult.tool.templatePath}</Text>
                    </div>

                    <Title level={5} style={{ color: '#fff', marginTop: 20 }}>输入数据</Title>
                    {renderCodeBlock(JSON.stringify(promptResult.input, null, 2), '150px')}

                    <Title level={5} style={{ color: '#fff', marginTop: 20 }}>模板变量</Title>
                    {Object.entries(promptResult.templateVariables).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#1890ff' }}>%%{key}%%:</Text>
                            {renderCodeBlock(value, '120px')}
                        </div>
                    ))}

                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    border: '2px dashed #555',
                    borderRadius: '8px',
                    color: '#999',
                    backgroundColor: '#262626'
                }}>
                    <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                    <Text type="secondary">选择工具和数据源后，结果将在此显示</Text>
                </div>
            )}

            {/* NEW: Pipeline Results Dashboard */}
            {pipelineResults && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <BugOutlined style={{ marginRight: 8 }} />
                        实时管道状态
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            ({pipelineResults.status})
                        </Text>
                    </Title>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        marginBottom: 16
                    }}>
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#262626',
                            border: '1px solid #434343',
                            borderRadius: '6px'
                        }}>
                            <Text style={{ color: '#1890ff', fontSize: '12px' }}>状态</Text>
                            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                                {pipelineResults.status}
                            </div>
                        </div>
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#262626',
                            border: '1px solid #434343',
                            borderRadius: '6px'
                        }}>
                            <Text style={{ color: '#52c41a', fontSize: '12px' }}>原始输出</Text>
                            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                                {pipelineResults.rawLLMOutputLength} 字符
                            </div>
                        </div>
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#262626',
                            border: '1px solid #434343',
                            borderRadius: '6px'
                        }}>
                            <Text style={{ color: '#faad14', fontSize: '12px' }}>修改后JSON</Text>
                            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                                {pipelineResults.modifiedJsonLength} 字符
                            </div>
                        </div>
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#262626',
                            border: '1px solid #434343',
                            borderRadius: '6px'
                        }}>
                            <Text style={{ color: '#f759ab', fontSize: '12px' }}>补丁数量</Text>
                            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                                {pipelineResults.patchCount} 个
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Raw Text Stream */}
            {rawTextStream && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        原始统一差异文本流
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            ({rawTextStream.length} 字符)
                        </Text>
                    </Title>

                    <div style={{
                        maxHeight: '300px',
                        overflow: 'auto',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #434343',
                        borderRadius: '6px'
                    }}>
                        <pre style={{
                            margin: '0',
                            width: '100%',
                            fontSize: '11px',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            color: '#e6e6e6',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                            padding: '12px'
                        }}>
                            {rawTextStream}
                        </pre>
                    </div>
                </div>
            )}

            {/* Real-time Patch-Applied JSON View - NEW! */}
            {originalJsonString && currentPatchedJsonString && selectedTool && isEditTool(selectedTool) && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        实时补丁应用视图
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            {currentPatches.length} 个补丁已应用
                            {pipelineResults && (
                                <span style={{ color: '#52c41a', marginLeft: 8 }}>
                                    (来自管道: {pipelineResults.status})
                                </span>
                            )}
                        </Text>
                    </Title>

                    {!originalJsonString.startsWith('//') ? (
                        <DiffView
                            oldValue={originalJsonString}
                            newValue={currentPatchedJsonString}
                        />
                    ) : (
                        <div style={{
                            padding: 16,
                            backgroundColor: '#4a1a1a',
                            border: '1px solid #ff4d4f',
                            borderRadius: '6px'
                        }}>
                            <Text style={{ color: '#ff7875' }}>
                                无法显示差异: {originalJsonString}
                            </Text>
                        </div>
                    )}

                    {/* Show current patches info */}
                    {currentPatches.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <Title level={5} style={{ color: '#fff' }}>当前应用的补丁</Title>
                            <div style={{
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #434343',
                                borderRadius: '6px',
                                padding: '12px',
                                maxHeight: '200px',
                                overflow: 'auto'
                            }}>
                                <pre style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    color: '#e6e6e6',
                                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                                }}>
                                    {JSON.stringify(currentPatches, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Final Results */}
            {finalPatches.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <PlayCircleOutlined style={{ marginRight: 8 }} />
                        最终结果 (JSON补丁)
                        {nonPersistentRunLoading && <Spin size="small" style={{ marginLeft: 8 }} />}
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            {nonPersistentRunStatus}
                        </Text>
                    </Title>

                    <div style={{
                        maxHeight: '400px',
                        overflow: 'auto',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #434343',
                        borderRadius: '6px'
                    }}>
                        <pre style={{
                            margin: '0',
                            width: '100%',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            color: '#e6e6e6',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                            padding: '12px'
                        }}>
                            {JSON.stringify(finalPatches, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '20px',
            background: '#0a0a0a'
        }}>
            <Card
                title={
                    <Title level={3} style={{ margin: 0, color: '#fff' }}>
                        <BugOutlined style={{ marginRight: '12px' }} />
                        工具调试控制台
                    </Title>
                }
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #333'
                }}
                styles={{
                    header: {
                        background: '#262626',
                        borderBottom: '1px solid #333'
                    },
                    body: {
                        background: '#1a1a1a',
                        color: '#fff',
                        padding: '24px'
                    }
                }}
            >
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '32px'
                }}>
                    {renderConfigurationColumn()}
                    {renderResultsColumn()}
                </div>
            </Card>
        </div>
    );
};

export default RawTooLCall; 