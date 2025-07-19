import React, { useState, useCallback, useMemo } from 'react';
import { Card, Button, Space, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import * as jsonpatch from 'fast-json-patch';
import { YJSJsondocProvider } from '../transform-jsondoc-framework/contexts/YJSJsondocContext';
import { YJSTextField, YJSTextAreaField } from '../transform-jsondoc-framework/components/YJSField';
import type { ElectricJsondoc } from '../../common/types';
import * as Diff from 'diff';

const { Title, Text } = Typography;

// Diff view component to show changes
const DiffView: React.FC<{ oldValue: string; newValue: string }> = ({ oldValue, newValue }) => {
    const diff = Diff.diffWords(oldValue || '', newValue || '');

    return (
        <div style={{
            background: '#1a1a1a',
            border: '1px solid #434343',
            borderRadius: '4px',
            padding: '8px',
            marginTop: '4px',
            maxHeight: '150px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.4'
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

interface PatchApprovalEditorProps {
    originalJsondoc: ElectricJsondoc;
    aiPatchJsondoc: ElectricJsondoc;
    projectId: string;
    onApprove: (humanEditedJsondoc: any) => Promise<void>;
    onReject: (reason?: string) => Promise<void>;
}

export const PatchApprovalEditor: React.FC<PatchApprovalEditorProps> = ({
    originalJsondoc,
    aiPatchJsondoc,
    projectId,
    onApprove,
    onReject
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [humanEditedJsondocId, setHumanEditedJsondocId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Parse original document data
    const originalData = useMemo(() => {
        try {
            return typeof originalJsondoc.data === 'string'
                ? JSON.parse(originalJsondoc.data)
                : originalJsondoc.data;
        } catch (e) {
            console.error('Failed to parse original data:', e);
            return {};
        }
    }, [originalJsondoc.data]);

    // Parse AI-generated patches
    const aiPatches = useMemo(() => {
        try {
            const patchData = typeof aiPatchJsondoc.data === 'string'
                ? JSON.parse(aiPatchJsondoc.data)
                : aiPatchJsondoc.data;
            return patchData.patches || [];
        } catch (e) {
            console.error('Failed to parse AI patches:', e);
            return [];
        }
    }, [aiPatchJsondoc.data]);

    // Apply AI patches to get the AI-suggested version
    const aiSuggestedData = useMemo(() => {
        try {
            // Clone original data
            let result = JSON.parse(JSON.stringify(originalData));

            // Apply each patch
            for (const patch of aiPatches) {
                if (patch.op === 'replace') {
                    const pathParts = patch.path.replace(/^\//, '').split('/');
                    let current = result;

                    // Navigate to the parent object
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        if (!current[pathParts[i]]) {
                            current[pathParts[i]] = {};
                        }
                        current = current[pathParts[i]];
                    }

                    // Set the value
                    const lastKey = pathParts[pathParts.length - 1];
                    current[lastKey] = patch.value;
                }
            }

            return result;
        } catch (e) {
            console.error('Failed to apply AI patches:', e);
            return originalData;
        }
    }, [originalData, aiPatches]);

    // Start editing mode - create a human-editable jsondoc with AI-suggested content
    const handleStartEdit = useCallback(async () => {
        setIsProcessing(true);
        try {
            // Create a new user_input jsondoc with the AI-suggested content
            const response = await fetch('/api/jsondocs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                credentials: 'include',
                body: JSON.stringify({
                    schema_type: 'user_input',
                    origin_type: 'user_input',
                    data: aiSuggestedData,
                    project_id: projectId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create editable jsondoc');
            }

            const result = await response.json();
            setHumanEditedJsondocId(result.jsondoc.id);
            setIsEditing(true);
            message.success('已创建可编辑版本，您可以开始编辑');
        } catch (error) {
            console.error('Failed to start editing:', error);
            message.error('创建可编辑版本失败');
        } finally {
            setIsProcessing(false);
        }
    }, [aiSuggestedData, projectId]);

    // Handle approval - compute patches from human edits
    const handleApprove = useCallback(async () => {
        if (!humanEditedJsondocId) {
            // User didn't edit, just approve AI suggestions
            await onApprove(aiSuggestedData);
            return;
        }

        setIsProcessing(true);
        try {
            // Get the human-edited jsondoc
            const response = await fetch(`/api/jsondocs/${humanEditedJsondocId}`, {
                headers: {
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to get human-edited jsondoc');
            }

            const { jsondoc } = await response.json();
            const humanEditedData = typeof jsondoc.data === 'string'
                ? JSON.parse(jsondoc.data)
                : jsondoc.data;

            // Approve with human-edited data
            await onApprove(humanEditedData);
        } catch (error) {
            console.error('Failed to approve with human edits:', error);
            message.error('批准失败');
        } finally {
            setIsProcessing(false);
        }
    }, [humanEditedJsondocId, aiSuggestedData, onApprove]);

    return (
        <div>
            <Card
                title={
                    <Space>
                        <Text strong>补丁审核</Text>
                        <Text type="secondary">
                            ({aiPatches.length} 个修改建议)
                        </Text>
                    </Space>
                }
                extra={
                    <Space>
                        <Button
                            icon={<EditOutlined />}
                            onClick={handleStartEdit}
                            loading={isProcessing}
                            disabled={isEditing}
                        >
                            {isEditing ? '编辑中' : '编辑内容'}
                        </Button>
                    </Space>
                }
            >
                {/* Show AI-suggested changes */}
                <div style={{ marginBottom: '16px' }}>
                    <Text strong>AI建议的修改:</Text>
                    {aiPatches.map((patch: any, index: number) => {
                        const pathDisplay = patch.path.replace(/^\//, '').replace(/\//g, ' → ');
                        const originalValue = patch.path === '/title' ? originalData.title :
                            patch.path === '/body' ? originalData.body :
                                'Unknown field';

                        return (
                            <div key={index} style={{ marginTop: '8px' }}>
                                <Text type="secondary">{pathDisplay}:</Text>
                                <DiffView
                                    oldValue={String(originalValue || '')}
                                    newValue={String(patch.value || '')}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Full document editor (only show when editing) */}
                {isEditing && humanEditedJsondocId && (
                    <div style={{ marginTop: '16px', padding: '16px', border: '2px solid #52c41a', borderRadius: '8px' }}>
                        <Text strong>编辑完整文档:</Text>
                        <div style={{ marginTop: '8px' }}>
                            <YJSJsondocProvider jsondocId={humanEditedJsondocId}>
                                <div style={{ marginBottom: '12px' }}>
                                    <Text>标题:</Text>
                                    <YJSTextField
                                        path="title"
                                        placeholder="编辑标题..."
                                    />
                                </div>
                                <div>
                                    <Text>内容:</Text>
                                    <YJSTextAreaField
                                        path="body"
                                        placeholder="编辑内容..."
                                        rows={6}
                                    />
                                </div>
                            </YJSJsondocProvider>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                    <Space>
                        <Button
                            icon={<CloseOutlined />}
                            onClick={() => onReject()}
                            disabled={isProcessing}
                        >
                            拒绝修改
                        </Button>
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleApprove}
                            loading={isProcessing}
                        >
                            批准修改 {isEditing ? '(包含您的编辑)' : '(AI建议)'}
                        </Button>
                    </Space>
                </div>
            </Card>
        </div>
    );
}; 