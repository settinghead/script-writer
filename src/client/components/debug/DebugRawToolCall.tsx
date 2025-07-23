import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Typography, Tabs, Spin, Alert, Select, Button, Space, Form, Input, Divider } from 'antd';
import { ToolOutlined, BugOutlined, FileTextOutlined, DatabaseOutlined, SaveOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useDebugParams } from '../../hooks/useDebugParams';
import { computeCanonicalJsondocsFromLineage, extractCanonicalJsondocIds } from '../../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../../common/transform-jsondoc-framework/lineageResolution';
import { applyPatch } from 'fast-json-patch';
import * as Diff from 'diff';
import { applyContextDiffAndGeneratePatches } from '../../../common/contextDiff';
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

    // Dry run state
    const [nonPersistentRunLoading, setNonPersistentRunLoading] = useState(false);
    const [nonPersistentRunResults, setNonPersistentRunResults] = useState<any>(null);
    const [nonPersistentRunStatus, setNonPersistentRunStatus] = useState<string>('');
    const [rawTextStream, setRawTextStream] = useState<string>('');
    const [patchStream, setPatchStream] = useState<any[]>([]);

    // JSON diff state for edit tools
    const [originalJsonString, setOriginalJsonString] = useState<string>('');
    const [patchedJsonString, setPatchedJsonString] = useState<string>('');

    // Refs to track current values for event handler access (fix React closure issue)
    const rawTextStreamRef = useRef('');
    const originalJsonStringRef = useRef('');

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

    // Non-persistent run function
    const runNonPersistentRun = async (toolName: string, input: any) => {
        setNonPersistentRunLoading(true);
        setNonPersistentRunResults(null);
        setNonPersistentRunStatus('开始非持久化运行...');
        setRawTextStream('');
        setPatchStream([]);
        setOriginalJsonString('');
        setPatchedJsonString('');

        // Clear refs for new run
        rawTextStreamRef.current = '';
        originalJsonStringRef.current = '';

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
                            const fallbackString = '// Original jsondoc data is undefined or null\n// Jsondoc ID: ' + targetJsondocId + '\n// Schema: ' + targetJsondoc.schema_type;
                            setOriginalJsonString(fallbackString);
                            originalJsonStringRef.current = fallbackString;
                        } else {
                            const jsonString = JSON.stringify(originalData, null, 2);
                            console.log('[DebugRawToolCall] JSON.stringify successful, length:', jsonString.length);
                            console.log('[DebugRawToolCall] Setting originalJsonString preview:', jsonString.substring(0, 100) + '...');
                            setOriginalJsonString(jsonString);
                            originalJsonStringRef.current = jsonString;
                        }
                    } catch (parseError) {
                        console.error('[DebugRawToolCall] Failed to parse jsondoc data:', parseError);
                        const errorString = '// Failed to parse jsondoc data: ' + parseError;
                        setOriginalJsonString(errorString);
                        originalJsonStringRef.current = errorString;
                    }
                } else {
                    console.warn('[DebugRawToolCall] Jsondoc not found in context:', targetJsondocId);
                    const notFoundString = '// Jsondoc not found: ' + targetJsondocId;
                    setOriginalJsonString(notFoundString);
                    originalJsonStringRef.current = notFoundString;
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
                                const newRawTextStream = rawTextStreamRef.current + data.textDelta;
                                setRawTextStream(newRawTextStream);
                                rawTextStreamRef.current = newRawTextStream;
                                setNonPersistentRunStatus(`接收原始文本... (第${data.chunkCount}块)`);
                                console.log('[DebugRawToolCall] rawText event - current rawTextStream length:', rawTextStreamRef.current.length, 'new delta length:', data.textDelta?.length);
                            } else if (currentEvent === 'patches') {
                                // Handle patch data
                                setPatchStream(prev => [...prev, {
                                    chunkCount: data.chunkCount,
                                    patches: data.patches,
                                    source: data.source,
                                    rawText: data.rawText
                                }]);
                                setNonPersistentRunResults(data.patches);
                                setNonPersistentRunStatus(`接收补丁数据... (第${data.chunkCount}块, ${data.patches?.length || 0}个补丁)`);

                                console.log('[DebugRawToolCall] patches event - source:', data.source, 'patches count:', data.patches?.length);
                                console.log('[DebugRawToolCall] State check at patches event:');
                                console.log('  - originalJsonString available:', !!originalJsonStringRef.current, 'length:', originalJsonStringRef.current?.length, 'starts with //:', originalJsonStringRef.current?.startsWith('//'));
                                console.log('  - rawTextStream available:', !!rawTextStreamRef.current, 'length:', rawTextStreamRef.current?.length);
                                console.log('  - isEditTool:', isEditTool(toolName), 'toolName:', toolName);
                                console.log('  - data.source === final:', data.source === 'final');

                                // If this is an edit tool and we have final patches, apply the context diff correctly
                                if (isEditTool(toolName) && data.source === 'final') {
                                    console.log('[DebugRawToolCall] Final patches received, applying context diff...');
                                    console.log('[DebugRawToolCall] DETAILED STATE CHECK:');
                                    console.log('  - originalJsonString type:', typeof originalJsonStringRef.current);
                                    console.log('  - originalJsonString value preview:', originalJsonStringRef.current?.substring(0, 100));
                                    console.log('  - rawTextStream type:', typeof rawTextStreamRef.current);
                                    console.log('  - rawTextStream value preview:', rawTextStreamRef.current?.substring(0, 100));
                                    console.log('  - Condition check: originalJsonString &&', !!originalJsonStringRef.current, '!originalJsonString.startsWith("//")', !originalJsonStringRef.current?.startsWith('//'), 'rawTextStream', !!rawTextStreamRef.current);

                                    try {
                                        if (originalJsonStringRef.current && !originalJsonStringRef.current.startsWith('//') && rawTextStreamRef.current) {
                                            console.log('[DebugRawToolCall] All conditions met, calling applyContextDiffAndGeneratePatches...');
                                            // Apply context-based diff directly to the JSON string using common function
                                            const diffResult = applyContextDiffAndGeneratePatches(originalJsonStringRef.current, rawTextStreamRef.current);

                                            console.log('[DebugRawToolCall] Diff result:', {
                                                success: diffResult.success,
                                                hasModifiedJson: !!diffResult.modifiedJson,
                                                modifiedJsonLength: diffResult.modifiedJson?.length,
                                                hasRfc6902Patches: !!diffResult.rfc6902Patches,
                                                rfc6902PatchesCount: diffResult.rfc6902Patches?.length,
                                                error: diffResult.error
                                            });

                                            if (diffResult.success && diffResult.modifiedJson) {
                                                console.log('[DebugRawToolCall] Context diff applied successfully');
                                                setPatchedJsonString(diffResult.modifiedJson);

                                                // Store the RFC6902 patches for display
                                                if (diffResult.rfc6902Patches) {
                                                    console.log('[DebugRawToolCall] RFC6902 JSON patches created:', diffResult.rfc6902Patches);
                                                    setNonPersistentRunResults({
                                                        ...nonPersistentRunResults,
                                                        rfc6902Patches: diffResult.rfc6902Patches
                                                    });
                                                }
                                            } else {
                                                console.log('[DebugRawToolCall] Context diff failed:', diffResult.error);
                                                // Context diff failed, show error info
                                                let errorInfo = '// Failed to apply context diff\n';
                                                errorInfo += `// Error: ${diffResult.error}\n\n`;
                                                errorInfo += '// Raw context diff:\n';
                                                errorInfo += rawTextStreamRef.current ? `/*\n${rawTextStreamRef.current}\n*/\n\n` : '// No raw diff available\n\n';
                                                errorInfo += '// Generated JSON patches (fallback):\n';
                                                errorInfo += data.patches ? JSON.stringify(data.patches, null, 2) : '// No patches generated';

                                                setPatchedJsonString(errorInfo);
                                            }
                                        } else {
                                            console.log('[DebugRawToolCall] Conditions not met for diff application');
                                            console.log('  - Missing originalJsonString:', !originalJsonStringRef.current);
                                            console.log('  - originalJsonString starts with //:', originalJsonStringRef.current?.startsWith('//'));
                                            console.log('  - Missing rawTextStream:', !rawTextStreamRef.current);

                                            // Show detailed info when original JSON or raw diff is not available
                                            let reconstructionInfo = '// Cannot apply context diff\n';
                                            reconstructionInfo += '// Original JSON status: ' + (originalJsonStringRef.current ? originalJsonStringRef.current.startsWith('//') ? 'fallback message' : 'available' : 'undefined') + '\n';
                                            reconstructionInfo += '// Raw diff available: ' + (rawTextStreamRef.current ? 'yes' : 'no') + '\n';
                                            reconstructionInfo += '// Raw diff length: ' + (rawTextStreamRef.current?.length || 0) + '\n';
                                            reconstructionInfo += '// Original JSON length: ' + (originalJsonStringRef.current?.length || 0) + '\n\n';
                                            reconstructionInfo += '// Raw context diff:\n';
                                            reconstructionInfo += rawTextStreamRef.current ? `/*\n${rawTextStreamRef.current}\n*/\n\n` : '// No raw diff available\n\n';
                                            reconstructionInfo += '// Generated JSON patches (reference):\n';
                                            reconstructionInfo += data.patches ? JSON.stringify(data.patches, null, 2) : '// No patches generated';

                                            setPatchedJsonString(reconstructionInfo);
                                        }
                                    } catch (error) {
                                        console.error('[DebugRawToolCall] Failed to process context diff:', error);
                                        setPatchedJsonString('// Failed to process context diff: ' + error + '\n\nRaw diff:\n' + (rawTextStreamRef.current || 'No raw diff available') + '\n\nJSON Patches:\n' + JSON.stringify(data.patches, null, 2));
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

            {/* Patch Stream */}
            {patchStream.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <DatabaseOutlined style={{ marginRight: 8 }} />
                        转换的JSON补丁流
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            ({patchStream.length} 个块)
                        </Text>
                    </Title>

                    {patchStream.map((patchData, index) => (
                        <div key={index} style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#1890ff' }}>
                                块 #{patchData.chunkCount} ({patchData.source})
                                {patchData.patches?.length > 0 && ` - ${patchData.patches.length} 个补丁`}
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
                                    {JSON.stringify(patchData.patches, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Debug info for diff state */}
            {selectedTool && isEditTool(selectedTool) && (
                <div style={{ marginTop: 24, padding: 12, backgroundColor: '#262626', borderRadius: 6 }}>
                    <Text strong style={{ color: '#1890ff' }}>Debug Info:</Text>
                    <br />
                    <Text style={{ fontSize: '12px', color: '#ccc' }}>
                        Tool: {selectedTool} | IsEdit: {isEditTool(selectedTool) ? 'Yes' : 'No'} |
                        OriginalJSON: {originalJsonString ? `${originalJsonString.length} chars` : 'Not set'} |
                        PatchedJSON: {patchedJsonString ? `${patchedJsonString.length} chars` : 'Not set'} |
                        RawJsondocs: {Array.isArray(rawJsondocs) ? rawJsondocs.length : 'loading'} |
                        Selected: {selectedJsondocs.length}
                    </Text>
                </div>
            )}

            {/* JSON Diff View for Edit Tools */}
            {originalJsonString && selectedTool && isEditTool(selectedTool) && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        JSON对比视图 (原始 → 修改后)
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            显示上下文差异如何影响JSON结构
                        </Text>
                    </Title>

                    {patchedJsonString ? (
                        <>
                            <DiffView
                                oldValue={originalJsonString}
                                newValue={patchedJsonString}
                            />

                            {/* Show RFC6902 JSON Patches if available */}
                            {nonPersistentRunResults?.rfc6902Patches && Array.isArray(nonPersistentRunResults.rfc6902Patches) && (
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
                                            {JSON.stringify(nonPersistentRunResults.rfc6902Patches, null, 2)}
                                        </pre>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8 }}>
                                        这些是通过RFC6902标准计算得出的JSON补丁，描述了从原始JSON到修改后JSON所需的操作。
                                    </Text>
                                </div>
                            )}
                        </>
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

            {/* Non-Persistent Run Results */}
            {nonPersistentRunResults && (
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
                            {JSON.stringify(nonPersistentRunResults, null, 2)}
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