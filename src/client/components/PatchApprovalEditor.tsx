import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Card, Button, message, Divider, Typography, Space, Input, Row, Col } from 'antd';
import { ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { debounce } from 'lodash';
import { applyPatch } from 'fast-json-patch';
import * as jsonpatch from 'fast-json-patch';
import * as Diff from 'diff';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Diff preview component (reused from PatchReviewModal)
const DiffPreview: React.FC<{ oldValue: string; newValue: string }> = ({ oldValue, newValue }) => {
    const diff = Diff.diffWords(oldValue || '', newValue || '');

    return (
        <div style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '12px',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            padding: '12px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '6px',
            maxHeight: '400px',
            overflowY: 'auto'
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
                                color: '#95de64',
                                padding: '2px 0'
                            }}
                        >
                            {part.value}
                        </span>
                    );
                } else {
                    return (
                        <span key={index} style={{ color: '#ffffff' }}>
                            {part.value}
                        </span>
                    );
                }
            })}
        </div>
    );
};

// Helper function to get value at JSON path
const getValueAtPath = (obj: any, path: string): any => {
    if (path === '') return obj;
    if (path === '/') return obj;

    // Remove leading slash and split by '/'
    const parts = path.substring(1).split('/');
    let current = obj;

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;

        // Handle array indices like "0", "1", etc.
        if (Array.isArray(current) && /^\d+$/.test(part)) {
            current = current[parseInt(part, 10)];
        } else {
            current = current[part];
        }
    }

    return current;
};

// Helper function to set value at JSON path
const setValueAtPath = (obj: any, path: string, value: any): any => {
    if (path === '' || path === '/') return value;

    const result = JSON.parse(JSON.stringify(obj)); // Deep clone
    const parts = path.substring(1).split('/');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (Array.isArray(current) && /^\d+$/.test(part)) {
            const index = parseInt(part, 10);
            if (!current[index]) current[index] = {};
            current = current[index];
        } else {
            if (!current[part]) current[part] = {};
            current = current[part];
        }
    }

    const lastPart = parts[parts.length - 1];
    if (Array.isArray(current) && /^\d+$/.test(lastPart)) {
        current[parseInt(lastPart, 10)] = value;
    } else {
        current[lastPart] = value;
    }

    return result;
};

interface PatchApprovalEditorProps {
    patchJsondocId: string;
    onSave?: () => void;
    onCancel?: () => void;
}



/**
 * Special patch editor that:
 * 1. Finds the original brainstorm_idea via transformInput relationships
 * 2. Applies current patches to show the "after" state
 * 3. Allows editing the full document
 * 4. Generates new patches and updates the patch jsondoc
 */
export const PatchApprovalEditor: React.FC<PatchApprovalEditorProps> = ({
    patchJsondocId,
    onSave,
    onCancel
}) => {
    const projectData = useProjectData();
    const [isSaving, setIsSaving] = useState(false);

    // Local editing state for the combined content (dynamic based on patch paths)
    const [editedContent, setEditedContent] = useState<Record<string, any>>({});

    // Track initialization to prevent auto-save on first load
    const initializedRef = useRef(false);

    // Get the patch jsondoc
    const patchJsondoc = useMemo(() => {
        return projectData.getJsondocById(patchJsondocId);
    }, [projectData, patchJsondocId]);

    // Find the original brainstorm_idea via transformInput relationships
    const originalBrainstormIdea = useMemo(() => {
        if (!patchJsondoc || projectData.lineageGraph === "pending") {
            return null;
        }

        // The patchJsondocId we receive might be the derived jsondoc from human transform
        // We need to find the ORIGINAL patch jsondoc that was created by AI
        let originalPatchJsondocId = patchJsondocId;

        // Check if this is a derived jsondoc from a human transform
        if (Array.isArray(projectData.humanTransforms)) {
            const humanTransform = projectData.humanTransforms.find((ht: any) =>
                ht.derived_jsondoc_id === patchJsondocId
            );

            if (humanTransform && humanTransform.source_jsondoc_id) {
                // Use the source jsondoc from the human transform (the original AI-generated patch)
                originalPatchJsondocId = humanTransform.source_jsondoc_id;
                console.log('[PatchApprovalEditor] Found original patch jsondoc via human transform:', originalPatchJsondocId);
            }
        }

        // Find the transform that created the ORIGINAL patch jsondoc
        if (!Array.isArray(projectData.transforms) || !Array.isArray(projectData.transformOutputs)) {
            return null;
        }

        const creatingTransform = projectData.transforms.find((t: any) =>
            (projectData.transformOutputs as any[]).some((output: any) =>
                output.transform_id === t.id && output.jsondoc_id === originalPatchJsondocId
            )
        );

        if (!creatingTransform) {
            console.log('[PatchApprovalEditor] No creating transform found for original patch:', originalPatchJsondocId);
            return null;
        }

        console.log('[PatchApprovalEditor] Found creating transform:', {
            id: creatingTransform.id,
            type: creatingTransform.type,
            execution_context: creatingTransform.execution_context
        });

        // Find the input brainstorm_idea for that transform
        if (!Array.isArray(projectData.transformInputs)) {
            return null;
        }

        const transformInputs = projectData.transformInputs.filter((input: any) =>
            input.transform_id === creatingTransform.id
        );

        console.log('[PatchApprovalEditor] Transform inputs for transform', creatingTransform.id, ':', transformInputs);

        // Try to find brainstorm input with various role patterns
        let brainstormInputId = transformInputs.find((input: any) =>
            input.input_role === 'source'
        )?.jsondoc_id;

        // If not found, try any input (there should only be one for patch generation)
        if (!brainstormInputId && transformInputs.length > 0) {
            console.log('[PatchApprovalEditor] Trying fallback approach. All available inputs:', transformInputs);

            // Try to find brainstorm_idea by checking jsondoc types
            for (const input of transformInputs) {
                const inputJsondoc = projectData.getJsondocById(input.jsondoc_id);
                console.log(`[PatchApprovalEditor] Checking input ${input.jsondoc_id}:`, {
                    schema_type: inputJsondoc?.schema_type,
                    input_role: input.input_role
                });

                if (inputJsondoc?.schema_type === 'brainstorm_idea') {
                    brainstormInputId = input.jsondoc_id;
                    console.log('[PatchApprovalEditor] Found brainstorm_idea via fallback:', brainstormInputId);
                    break;
                }
            }

            // If still not found, use first input as last resort
            if (!brainstormInputId) {
                brainstormInputId = transformInputs[0].jsondoc_id;
                console.log('[PatchApprovalEditor] Using first available input as final fallback:', transformInputs[0]);
            }
        }

        if (!brainstormInputId) {
            console.log('[PatchApprovalEditor] No brainstorm input found for transform. Available inputs:', transformInputs.map((input: any) => ({
                jsondoc_id: input.jsondoc_id,
                input_role: input.input_role,
                jsondoc_path: input.jsondoc_path
            })));
            return null;
        }

        const originalJsondoc = projectData.getJsondocById(brainstormInputId);
        if (!originalJsondoc || originalJsondoc.schema_type !== 'brainstorm_idea') {
            console.log('[PatchApprovalEditor] Original jsondoc not found or wrong type:', originalJsondoc?.schema_type);
            return null;
        }

        console.log('[PatchApprovalEditor] Found original brainstorm_idea:', originalJsondoc.id);
        return originalJsondoc;
    }, [patchJsondoc, projectData, patchJsondocId]);

    // Parse the patch data
    const patchData = useMemo(() => {
        if (!patchJsondoc?.data) return null;

        try {
            return typeof patchJsondoc.data === 'string'
                ? JSON.parse(patchJsondoc.data)
                : patchJsondoc.data;
        } catch (error) {
            console.error('[PatchApprovalEditor] Failed to parse patch data:', error);
            return null;
        }
    }, [patchJsondoc]);

    // Extract the paths that are modified by the patches
    const patchPaths = useMemo(() => {
        if (!patchData?.patches) return [];
        return [...new Set(patchData.patches.map((patch: any) => patch.path))];
    }, [patchData]);

    // Calculate the original values for diff comparison
    const originalValues = useMemo(() => {
        if (!originalBrainstormIdea?.data || !patchPaths.length) {
            return {};
        }

        try {
            const originalData = typeof originalBrainstormIdea.data === 'string'
                ? JSON.parse(originalBrainstormIdea.data)
                : originalBrainstormIdea.data;

            // Extract original values for paths that are modified by patches
            const originalValues: Record<string, any> = {};
            for (const path of patchPaths) {
                if (typeof path === 'string') {
                    const value = getValueAtPath(originalData, path);
                    originalValues[path] = value;
                }
            }

            return originalValues;
        } catch (error) {
            console.error('[PatchApprovalEditor] Failed to extract original values:', error);
            return {};
        }
    }, [originalBrainstormIdea, patchPaths]);

    // Calculate the current "after" state by applying patches to original
    const currentAfterState = useMemo(() => {
        if (!originalBrainstormIdea?.data || !patchData?.patches) {
            return null;
        }

        try {
            const originalData = typeof originalBrainstormIdea.data === 'string'
                ? JSON.parse(originalBrainstormIdea.data)
                : originalBrainstormIdea.data;

            // Apply current patches to get the "after" state
            const afterState = applyPatch(originalData, patchData.patches, false, false).newDocument;

            // Extract only the values for paths that are modified by patches
            const patchedValues: Record<string, any> = {};
            for (const path of patchPaths) {
                if (typeof path === 'string') {
                    const value = getValueAtPath(afterState, path);
                    patchedValues[path] = value;
                }
            }

            return patchedValues;
        } catch (error) {
            console.error('[PatchApprovalEditor] Failed to apply patches:', error);
            return null;
        }
    }, [originalBrainstormIdea, patchData, patchPaths]);

    // Initialize edited content when currentAfterState changes
    useEffect(() => {
        if (currentAfterState) {
            setEditedContent(currentAfterState);
            initializedRef.current = true;
        }
    }, [currentAfterState]);

    // Auto-save function
    const saveChanges = useCallback(async (content: Record<string, any>) => {
        if (!content || !originalBrainstormIdea?.data || !patchJsondoc || isSaving) {
            return;
        }

        setIsSaving(true);
        try {
            // Get the original data
            const originalData = typeof originalBrainstormIdea.data === 'string'
                ? JSON.parse(originalBrainstormIdea.data)
                : originalBrainstormIdea.data;

            // Reconstruct the full object by applying edited values to original
            let reconstructedObject = JSON.parse(JSON.stringify(originalData));
            for (const [path, value] of Object.entries(content)) {
                reconstructedObject = setValueAtPath(reconstructedObject, path, value);
            }

            // Generate new patches from original to reconstructed object
            const newPatches = jsonpatch.compare(originalData, reconstructedObject);

            // Update the patch jsondoc with new patches
            const updatedPatchData = {
                ...patchData,
                patches: newPatches
            };

            const response = await fetch(`/api/jsondocs/${patchJsondocId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                credentials: 'include',
                body: JSON.stringify({
                    data: updatedPatchData
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            console.log('[PatchApprovalEditor] Auto-saved changes');
        } catch (error) {
            console.error('[PatchApprovalEditor] Auto-save error:', error);
        } finally {
            setIsSaving(false);
        }
    }, [originalBrainstormIdea, patchData, patchJsondocId, isSaving]);

    // Create debounced save function
    const debouncedSave = useMemo(
        () => debounce(saveChanges, 1000),
        [saveChanges]
    );

    // Auto-save when editedContent changes (but not on initialization)
    useEffect(() => {
        if (initializedRef.current && editedContent && Object.keys(editedContent).length > 0) {
            debouncedSave(editedContent);
        }
    }, [editedContent, debouncedSave]);

    // Handle revert to AI suggestion
    const handleRevertToAI = useCallback(() => {
        if (currentAfterState) {
            setEditedContent(currentAfterState);
            message.info('已恢复AI建议');
        }
    }, [currentAfterState]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    if (!patchJsondoc || !originalBrainstormIdea || !currentAfterState) {
        return (
            <Card>
                <Text type="secondary">加载补丁编辑器中...</Text>
            </Card>
        );
    }

    return (
        <Card
            title={
                <Space>
                    <Title level={4} style={{ margin: 0 }}>补丁编辑器</Title>
                    <Text type="secondary">编辑完整文档，系统将生成新的补丁</Text>
                </Space>
            }
            extra={
                <Space>
                    <Button
                        icon={<UndoOutlined />}
                        onClick={onCancel}
                    >
                        取消
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRevertToAI}
                    >
                        恢复AI建议
                    </Button>
                </Space>
            }
        >
            <Row gutter={24} style={{ height: '500px' }}>
                {/* Left Column - Editor */}
                <Col span={12}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Title level={5} style={{ marginBottom: '16px', color: '#fff' }}>编辑器</Title>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {patchPaths.map((path) => {
                                if (typeof path !== 'string') return null;

                                const value = editedContent[path] || '';
                                const isLongText = typeof value === 'string' && value.length > 100;

                                return (
                                    <div key={path} style={{ marginBottom: '16px' }}>
                                        <Text strong>{path}:</Text>
                                        {isLongText ? (
                                            <TextArea
                                                value={String(value)}
                                                onChange={(e) => setEditedContent(prev => ({ ...prev, [path]: e.target.value }))}
                                                placeholder={`请输入 ${path} 的内容`}
                                                rows={12}
                                                style={{ marginTop: '8px' }}
                                            />
                                        ) : (
                                            <Input
                                                value={String(value)}
                                                onChange={(e) => setEditedContent(prev => ({ ...prev, [path]: e.target.value }))}
                                                placeholder={`请输入 ${path} 的内容`}
                                                style={{ marginTop: '8px' }}
                                            />
                                        )}
                                    </div>
                                );
                            })}

                            {patchPaths.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#999', padding: '32px' }}>
                                    <Text type="secondary">没有找到可编辑的补丁字段</Text>
                                </div>
                            )}
                        </div>
                    </div>
                </Col>

                {/* Right Column - Diff Preview */}
                <Col span={12}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Title level={5} style={{ marginBottom: '16px', color: '#fff' }}>差异预览</Title>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {patchPaths.map((path) => {
                                if (typeof path !== 'string') return null;

                                const originalValue = String(originalValues[path] || '');
                                const currentValue = String(editedContent[path] || '');

                                return (
                                    <div key={path} style={{ marginBottom: '16px' }}>
                                        <Text strong style={{ color: '#fff' }}>{path}:</Text>
                                        <div style={{ marginTop: '8px' }}>
                                            <DiffPreview
                                                oldValue={originalValue}
                                                newValue={currentValue}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {patchPaths.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#999', padding: '32px' }}>
                                    <Text type="secondary">没有差异可显示</Text>
                                </div>
                            )}
                        </div>
                    </div>
                </Col>
            </Row>

            <Divider />

            <div style={{ fontSize: '12px', color: '#666' }}>
                <Text type="secondary">
                    原始内容: {originalBrainstormIdea.data ?
                        JSON.parse(typeof originalBrainstormIdea.data === 'string' ? originalBrainstormIdea.data : JSON.stringify(originalBrainstormIdea.data)).title
                        : '无标题'
                    }
                </Text>
            </div>
        </Card>
    );
}; 