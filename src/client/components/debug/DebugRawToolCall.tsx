import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Typography, Tabs, Spin, Alert, Select, Button, Space, Form, Input, Divider } from 'antd';
import { ToolOutlined, BugOutlined, FileTextOutlined, DatabaseOutlined, SaveOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useDebugParams } from '../../hooks/useDebugParams';
import { computeCanonicalJsondocsFromLineage, extractCanonicalJsondocIds } from '../../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../../common/transform-jsondoc-framework/lineageResolution';
import { applyPatch } from 'fast-json-patch';
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

// Diff view component (similar to PatchReviewModal)
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
    type: 'rawText' | 'eagerPatches' | 'patches' | 'finalPatches' | 'chunk' | 'result' | 'status' | 'error';
    chunkCount?: number;
    patches?: any[];
    source?: string;
    textDelta?: string;
    accumulatedText?: string;
    attempt?: number;
    newPatchCount?: number;
    data?: any;
    message?: string;
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
        case 'edit_剧本设定':
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
                episodeRange: '第1-5集',
                episodes: [1, 2, 3, 4, 5]
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
        case 'edit_剧本设定':
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
    const [eagerPatchHistory, setEagerPatchHistory] = useState<StreamingChunk[]>([]);
    const [finalPatches, setFinalPatches] = useState<any[]>([]);

    // JSON diff state for edit tools
    const [originalJsonString, setOriginalJsonString] = useState<string>('');
    const [patchedJsonString, setPatchedJsonString] = useState<string>('');
    const [contextDiffResult, setContextDiffResult] = useState<{
        success: boolean;
        modifiedJson?: string;
        rfc6902Patches?: any[];
        error?: string;
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

            // Build canonical context using ProjectDataContext data
            const canonicalContext = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                rawJsondocs,
                transforms || [],
                humanTransforms || [],
                transformInputs || [],
                transformOutputs || []
            );

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

    // Non-persistent run function - updated for new streaming system
    const runNonPersistentRun = async (toolName: string, input: any) => {
        setNonPersistentRunLoading(true);
        setNonPersistentRunResults(null);
        setNonPersistentRunStatus('开始非持久化运行...');
        setRawTextStream('');
        setStreamingChunks([]);
        setEagerPatchHistory([]);
        setFinalPatches([]);
        setOriginalJsonString('');
        setPatchedJsonString('');
        setContextDiffResult(null);

        // If this is an edit tool, capture the original JSON for diff comparison
        const isEdit = isEditTool(toolName);
        console.log('[DebugRawToolCall] Edit tool check:', { toolName, isEdit, hasJsondocs: input.jsondocs?.length > 0, rawJsondocsCount: Array.isArray(rawJsondocs) ? rawJsondocs.length : 'loading' });

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
                            setOriginalJsonString('// Original jsondoc data is undefined or null\n// Jsondoc ID: ' + targetJsondocId + '\n// Schema: ' + targetJsondoc.schema_type);
                        } else {
                            const jsonString = JSON.stringify(originalData, null, 2);
                            console.log('[DebugRawToolCall] JSON.stringify successful, length:', jsonString.length);
                            console.log('[DebugRawToolCall] Setting originalJsonString preview:', jsonString.substring(0, 100) + '...');
                            setOriginalJsonString(jsonString);
                        }
                    } catch (parseError) {
                        console.error('[DebugRawToolCall] Failed to parse jsondoc data:', parseError);
                        setOriginalJsonString('// Failed to parse jsondoc data: ' + parseError);
                    }
                } else {
                    console.warn('[DebugRawToolCall] Jsondoc not found in context:', targetJsondocId);
                    setOriginalJsonString('// Jsondoc not found: ' + targetJsondocId);
                }
            } catch (error) {
                console.warn('[DebugRawToolCall] Failed to capture original JSON for diff:', error);
            }
        }

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

                            if (currentEvent === 'rawText') {
                                // Handle raw text streaming for debugging
                                setRawTextStream(prev => prev + data.textDelta);
                                setNonPersistentRunStatus(`接收原始文本... (第${data.chunkCount}块)`);

                                // Add to streaming chunks
                                const streamingChunk: StreamingChunk = {
                                    type: 'rawText',
                                    chunkCount: data.chunkCount,
                                    textDelta: data.textDelta,
                                    accumulatedText: data.accumulatedText
                                };
                                setStreamingChunks(prev => [...prev, streamingChunk]);

                            } else if (currentEvent === 'eagerPatches') {
                                // Handle eager patch data - FIXED!
                                setNonPersistentRunStatus(`接收急切补丁... (第${data.chunkCount}块, ${data.patches?.length || 0}个补丁, 尝试${data.attempt})`);

                                const eagerChunk: StreamingChunk = {
                                    type: 'eagerPatches',
                                    chunkCount: data.chunkCount,
                                    patches: data.patches,
                                    source: data.source,
                                    attempt: data.attempt,
                                    newPatchCount: data.newPatchCount
                                };
                                setEagerPatchHistory(prev => [...prev, eagerChunk]);

                                // Also update the current results with eager patches
                                if (data.patches && data.patches.length > 0) {
                                    setNonPersistentRunResults(data.patches);
                                }

                            } else if (currentEvent === 'patches') {
                                // Handle regular patch data
                                setNonPersistentRunStatus(`接收补丁数据... (第${data.chunkCount}块, ${data.patches?.length || 0}个补丁)`);

                                const patchChunk: StreamingChunk = {
                                    type: 'patches',
                                    chunkCount: data.chunkCount,
                                    patches: data.patches,
                                    source: data.source
                                };
                                setStreamingChunks(prev => [...prev, patchChunk]);

                            } else if (currentEvent === 'finalPatches') {
                                // Handle final patches
                                setFinalPatches(data.patches || []);
                                setNonPersistentRunResults(data.patches);
                                setNonPersistentRunStatus(`接收最终补丁... (${data.patches?.length || 0}个补丁)`);

                                // If this is an edit tool, apply context diff using the same 4-step approach as debug script
                                if (isEditTool(toolName) && originalJsonString && !originalJsonString.startsWith('//') && rawTextStream) {
                                    console.log('[DebugRawToolCall] Applying context diff with final patches using simplified approach...');
                                    try {
                                        // STEP 1 & 2: Apply text diff and parse JSON (with jsonrepair)
                                        const modifiedJson = applyContextDiffToJSON(originalJsonString, rawTextStream);

                                        if (modifiedJson && modifiedJson !== originalJsonString) {
                                            console.log('[DebugRawToolCall] Context diff applied successfully');
                                            setPatchedJsonString(modifiedJson);

                                            // STEP 3 & 4: Generate RFC6902 patches 
                                            const rfc6902Patches = applyContextDiffAndGeneratePatches(originalJsonString, rawTextStream);

                                            setContextDiffResult({
                                                success: true,
                                                modifiedJson,
                                                rfc6902Patches: Array.isArray(rfc6902Patches) ? rfc6902Patches : []
                                            });
                                        } else {
                                            console.log('[DebugRawToolCall] No changes detected in context diff');
                                            setContextDiffResult({
                                                success: false,
                                                error: 'No changes detected in unified diff'
                                            });
                                            setPatchedJsonString('// No changes detected\n\n' + rawTextStream);
                                        }
                                    } catch (error) {
                                        console.error('[DebugRawToolCall] Failed to process context diff:', error);
                                        setContextDiffResult({
                                            success: false,
                                            error: error instanceof Error ? error.message : String(error)
                                        });
                                        setPatchedJsonString('// Failed to process context diff: ' + error + '\n\nRaw diff:\n' + rawTextStream);
                                    }
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

            {/* Eager Patch History - NEW! */}
            {eagerPatchHistory.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <DatabaseOutlined style={{ marginRight: 8 }} />
                        急切解析补丁历史 (实时流处理)
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            ({eagerPatchHistory.length} 次尝试)
                        </Text>
                    </Title>

                    {eagerPatchHistory.map((eagerChunk, index) => (
                        <div key={index} style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#52c41a' }}>
                                急切解析 #{eagerChunk.attempt} (块 #{eagerChunk.chunkCount})
                                {eagerChunk.patches && eagerChunk.patches.length > 0 && ` - ${eagerChunk.patches.length} 个补丁`}
                                {eagerChunk.newPatchCount && ` (+${eagerChunk.newPatchCount} 新增)`}
                            </Text>
                            <div style={{
                                maxHeight: '200px',
                                overflow: 'auto',
                                backgroundColor: '#1a4a1a',
                                border: '1px solid #52c41a',
                                borderRadius: '6px',
                                marginTop: 8
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
                                    {JSON.stringify(eagerChunk.patches, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Regular Streaming Chunks */}
            {streamingChunks.filter(chunk => chunk.type === 'patches').length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <DatabaseOutlined style={{ marginRight: 8 }} />
                        常规JSON补丁流
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            ({streamingChunks.filter(chunk => chunk.type === 'patches').length} 个块)
                        </Text>
                    </Title>

                    {streamingChunks.filter(chunk => chunk.type === 'patches').map((patchChunk, index) => (
                        <div key={index} style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#1890ff' }}>
                                块 #{patchChunk.chunkCount} ({patchChunk.source})
                                {patchChunk.patches && patchChunk.patches.length > 0 && ` - ${patchChunk.patches.length} 个补丁`}
                            </Text>
                            <div style={{
                                maxHeight: '200px',
                                overflow: 'auto',
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #434343',
                                borderRadius: '6px',
                                marginTop: 8
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
                                    {JSON.stringify(patchChunk.patches, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* JSON Diff View for Edit Tools - FIXED! */}
            {originalJsonString && selectedTool && isEditTool(selectedTool) && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        JSON对比视图 (原始 → 修改后)
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            显示上下文差异如何影响JSON结构
                        </Text>
                    </Title>

                    {contextDiffResult?.success && patchedJsonString ? (
                        <>
                            <DiffView
                                oldValue={originalJsonString}
                                newValue={patchedJsonString}
                            />

                            {/* Show RFC6902 JSON Patches */}
                            {contextDiffResult.rfc6902Patches && Array.isArray(contextDiffResult.rfc6902Patches) && contextDiffResult.rfc6902Patches.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <Title level={5} style={{ color: '#fff' }}>RFC6902 JSON Patches</Title>
                                    <div style={{
                                        backgroundColor: '#1a1a1a',
                                        border: '1px solid #434343',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        maxHeight: '300px',
                                        overflow: 'auto'
                                    }}>
                                        <pre style={{
                                            margin: 0,
                                            fontSize: '12px',
                                            color: '#e6e6e6',
                                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                                        }}>
                                            {JSON.stringify(contextDiffResult.rfc6902Patches, null, 2)}
                                        </pre>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8 }}>
                                        这些是通过RFC6902标准计算得出的JSON补丁，描述了从原始JSON到修改后JSON所需的操作。
                                    </Text>
                                </div>
                            )}
                        </>
                    ) : contextDiffResult?.error ? (
                        <div style={{
                            padding: 16,
                            backgroundColor: '#4a1a1a',
                            border: '1px solid #ff4d4f',
                            borderRadius: '6px'
                        }}>
                            <Text style={{ color: '#ff7875' }}>
                                上下文差异应用失败: {contextDiffResult.error}
                            </Text>
                            {patchedJsonString && (
                                <div style={{ marginTop: 12 }}>
                                    <Title level={5} style={{ color: '#fff' }}>调试信息</Title>
                                    <div style={{
                                        maxHeight: '200px',
                                        overflow: 'auto',
                                        backgroundColor: '#1a1a1a',
                                        border: '1px solid #434343',
                                        borderRadius: '6px',
                                        padding: '12px'
                                    }}>
                                        <pre style={{
                                            margin: 0,
                                            fontSize: '11px',
                                            color: '#e6e6e6',
                                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                                        }}>
                                            {patchedJsonString}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            padding: 16,
                            backgroundColor: '#262626',
                            border: '1px solid #434343',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <Text type="secondary">
                                {rawTextStream ? '正在等待最终补丁数据...' : '等待上下文差异数据...'}
                            </Text>
                        </div>
                    )}

                    {/* Show original JSON for reference */}
                    <div style={{ marginTop: 16 }}>
                        <Title level={5} style={{ color: '#fff' }}>原始JSON数据</Title>
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
                                {originalJsonString}
                            </pre>
                        </div>
                    </div>
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