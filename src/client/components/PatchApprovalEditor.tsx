import React, { useState, useMemo, useCallback } from 'react';
import { Card, Button, message, Divider, Typography, Space } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { YJSJsondocProvider } from '../transform-jsondoc-framework/contexts/YJSJsondocContext';
import { YJSTextField, YJSTextAreaField } from '../transform-jsondoc-framework/components/YJSField';
import { applyPatch } from 'fast-json-patch';
import * as jsonpatch from 'fast-json-patch';

const { Title, Text } = Typography;

interface PatchApprovalEditorProps {
    patchJsondocId: string;
    onSave?: () => void;
    onCancel?: () => void;
}

interface OriginalContent {
    title: string;
    body: string;
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

    // Calculate the current "after" state by applying patches to original
    const currentAfterState = useMemo<OriginalContent | null>(() => {
        if (!originalBrainstormIdea?.data || !patchData?.patches) {
            return null;
        }

        try {
            const originalData = typeof originalBrainstormIdea.data === 'string'
                ? JSON.parse(originalBrainstormIdea.data)
                : originalBrainstormIdea.data;

            // Apply current patches to get the "after" state
            const afterState = applyPatch(originalData, patchData.patches, false, false).newDocument;

            return {
                title: afterState.title || '',
                body: afterState.body || ''
            };
        } catch (error) {
            console.error('[PatchApprovalEditor] Failed to apply patches:', error);
            // Fallback to original content
            const originalData = typeof originalBrainstormIdea.data === 'string'
                ? JSON.parse(originalBrainstormIdea.data)
                : originalBrainstormIdea.data;

            return {
                title: originalData.title || '',
                body: originalData.body || ''
            };
        }
    }, [originalBrainstormIdea, patchData]);

    // Handle saving changes
    const handleSave = useCallback(async () => {
        if (!currentAfterState || !originalBrainstormIdea?.data || !patchJsondoc || isSaving) {
            return;
        }

        setIsSaving(true);
        try {
            // Get the original data
            const originalData = typeof originalBrainstormIdea.data === 'string'
                ? JSON.parse(originalBrainstormIdea.data)
                : originalBrainstormIdea.data;

            // Generate new patches from original to current edited state
            const newPatches = jsonpatch.compare(originalData, currentAfterState);

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

            message.success('补丁已更新');
            onSave?.();
        } catch (error) {
            console.error('[PatchApprovalEditor] Failed to save patch:', error);
            message.error('保存失败');
        } finally {
            setIsSaving(false);
        }
    }, [currentAfterState, originalBrainstormIdea, patchData, patchJsondocId, onSave, isSaving]);

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
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={isSaving}
                        onClick={handleSave}
                    >
                        保存补丁
                    </Button>
                </Space>
            }
        >
            <div className="yjs-field-dark-theme">
                <YJSJsondocProvider jsondocId={patchJsondocId}>
                    <div style={{ marginBottom: '16px' }}>
                        <Text strong>标题:</Text>
                        <YJSTextField
                            path="title"
                            placeholder="请输入标题"
                        />
                    </div>

                    <div>
                        <Text strong>内容:</Text>
                        <YJSTextAreaField
                            path="body"
                            placeholder="请输入故事内容"
                            rows={6}
                        />
                    </div>
                </YJSJsondocProvider>
            </div>

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