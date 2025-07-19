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

        // Find the transform that created this patch jsondoc
        if (!Array.isArray(projectData.transforms) || !Array.isArray(projectData.transformOutputs)) {
            return null;
        }

        const creatingTransform = projectData.transforms.find((t: any) =>
            (projectData.transformOutputs as any[]).some((output: any) =>
                output.transform_id === t.id && output.jsondoc_id === patchJsondocId
            )
        );

        if (!creatingTransform) {
            console.log('[PatchApprovalEditor] No creating transform found for patch');
            return null;
        }

        // Find the input brainstorm_idea for that transform
        if (!Array.isArray(projectData.transformInputs)) {
            return null;
        }

        const transformInputs = projectData.transformInputs.filter((input: any) =>
            input.transform_id === creatingTransform.id
        );

        const brainstormInputId = transformInputs.find((input: any) =>
            input.input_role === 'source' || !input.input_role
        )?.jsondoc_id;

        if (!brainstormInputId) {
            console.log('[PatchApprovalEditor] No brainstorm input found for transform');
            return null;
        }

        const originalJsondoc = projectData.getJsondocById(brainstormInputId);
        if (!originalJsondoc || originalJsondoc.schema_type !== 'brainstorm_idea') {
            console.log('[PatchApprovalEditor] Original jsondoc not found or wrong type:', originalJsondoc?.schema_type);
            return null;
        }

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