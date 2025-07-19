import React, { useState, useCallback, useMemo } from 'react';
import { Modal, Button, Space, Card, Typography, Checkbox, Input, message, Divider } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { usePendingPatchApproval, type PendingPatchGroup } from '../hooks/usePendingPatchApproval';
import { YJSJsondocProvider } from '../transform-jsondoc-framework/contexts/YJSJsondocContext';
import { YJSTextField, YJSTextAreaField } from '../transform-jsondoc-framework/components/YJSField';
import { PatchApprovalEditor } from './PatchApprovalEditor';
import { useProjectData } from '../contexts/ProjectDataContext';
import type { ElectricJsondoc } from '../../common/types';
import * as Diff from 'diff';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Diff view component
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

interface PatchReviewCardProps {
    patchJsondoc: ElectricJsondoc;
    originalJsondoc: ElectricJsondoc;
    selected: boolean;
    onSelectionChange: (selected: boolean) => void;
    projectId: string;
}

const PatchReviewCard: React.FC<PatchReviewCardProps> = ({
    patchJsondoc,
    originalJsondoc,
    selected,
    onSelectionChange,
    projectId
}) => {
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);
    const projectData = useProjectData();

    // Parse patch data
    const patchData = useMemo(() => {
        try {
            return typeof patchJsondoc.data === 'string'
                ? JSON.parse(patchJsondoc.data)
                : patchJsondoc.data;
        } catch (e) {
            console.error('Failed to parse patch data:', e);
            return {};
        }
    }, [patchJsondoc.data]);

    // Check if this patch has a human transform (derived edit mode from DB state)
    const hasHumanTransform = useMemo(() => {
        if (!Array.isArray(projectData.humanTransforms)) {
            console.log('[PatchReviewModal] No humanTransforms array available');
            return false;
        }

        // Look for a human transform that has this patch jsondoc as source
        const found = projectData.humanTransforms.some(transform =>
            transform.source_jsondoc_id === patchJsondoc.id &&
            transform.derivation_path === '$'  // Changed from '$.patches' to '$'
        );

        console.log(`[PatchReviewModal] Checking for human transform for patch ${patchJsondoc.id}: ${found ? 'FOUND' : 'NOT FOUND'}`);
        console.log(`[PatchReviewModal] Available transforms:`, projectData.humanTransforms.map(t => ({
            id: t.id,
            source_jsondoc_id: t.source_jsondoc_id,
            derivation_path: t.derivation_path,
            status: t.status,
            type: t.type
        })));
        console.log(`[PatchReviewModal] Looking for source_jsondoc_id: ${patchJsondoc.id} with derivation_path: '$'`);

        return found;
    }, [projectData.humanTransforms, patchJsondoc.id]);

    // Get the derived jsondoc ID if human transform exists
    const derivedJsondocId = useMemo(() => {
        if (!Array.isArray(projectData.humanTransforms)) {
            return null;
        }

        const humanTransform = projectData.humanTransforms.find(transform =>
            transform.source_jsondoc_id === patchJsondoc.id &&
            transform.derivation_path === '$'  // Changed from '$.patches' to '$'
        );

        return humanTransform?.derived_jsondoc_id || null;
    }, [projectData.humanTransforms, patchJsondoc.id]);

    // Handle creating human transform for editing
    const handleStartEdit = useCallback(async () => {
        console.log(`[PatchReviewModal] handleStartEdit called for patch ${patchJsondoc.id}`);
        console.log(`[PatchReviewModal] hasHumanTransform: ${hasHumanTransform}, isCreatingTransform: ${isCreatingTransform}`);

        if (hasHumanTransform || isCreatingTransform) {
            console.log(`[PatchReviewModal] Skipping transform creation - already exists or in progress`);
            return;
        }

        setIsCreatingTransform(true);
        try {
            console.log(`[PatchReviewModal] Creating human transform for patch ${patchJsondoc.id}`);

            // Create human transform for this patch jsondoc
            const response = await fetch(`/api/jsondocs/${patchJsondoc.id}/human-transform`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                credentials: 'include',
                body: JSON.stringify({
                    transformName: 'edit_json_patch',
                    derivationPath: '$',
                    fieldUpdates: {}
                })
            });

            console.log(`[PatchReviewModal] API response status: ${response.status}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`[PatchReviewModal] API error:`, errorData);
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('[PatchReviewModal] Human transform created successfully:', result);
            console.log(`[PatchReviewModal] Transform ID: ${result.transform?.id}`);
            console.log(`[PatchReviewModal] Derived jsondoc ID: ${result.derivedJsondoc?.id}`);

            message.success('开始编辑模式');

            // Force a small delay to allow Electric SQL to sync
            setTimeout(() => {
                console.log(`[PatchReviewModal] After 1s delay - checking sync status`);
                console.log(`[PatchReviewModal] hasHumanTransform: ${hasHumanTransform}`);
                console.log(`[PatchReviewModal] Available transforms:`,
                    Array.isArray(projectData.humanTransforms)
                        ? projectData.humanTransforms.map((t: any) => ({
                            id: t.id,
                            source_jsondoc_id: t.source_jsondoc_id,
                            derivation_path: t.derivation_path,
                            transform_name: t.transform_name
                        }))
                        : projectData.humanTransforms
                );

                // Force re-render by updating a state variable
                setIsCreatingTransform(false);
                setIsCreatingTransform(false); // Double call to force re-render
            }, 1000);

            console.log('Human transform created for patch editing');
        } catch (error) {
            console.error('[PatchReviewModal] Failed to create human transform:', error);
            message.error('创建编辑版本失败');
        } finally {
            setIsCreatingTransform(false);
        }
    }, [patchJsondoc.id, hasHumanTransform, isCreatingTransform, projectData.humanTransforms]);

    // Extract the first patch operation from the patches array
    const operation = patchData.patches?.[0];
    const patchIndex = patchData.patchIndex ?? 0;

    // Helper function to get value at JSON path
    const getValueAtPath = (obj: any, path: string): any => {
        if (!path || !obj) return undefined;

        // Remove leading slash and split by slash
        const pathParts = path.replace(/^\//, '').split('/');
        let current = obj;

        for (const part of pathParts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
        }

        return current;
    };

    // Extract original and new values
    const newValue = operation?.value;
    const originalData = typeof originalJsondoc.data === 'string'
        ? JSON.parse(originalJsondoc.data)
        : originalJsondoc.data;
    const originalValue = operation ? getValueAtPath(originalData, operation.path) : undefined;

    // Format path for display
    const formatPath = (path: string) => {
        return path.replace(/^\//, '').replace(/\//g, ' → ');
    };

    // Helper function to format values for display
    const formatValue = (value: any) => {
        if (value === null || value === undefined) return '(空)';
        if (typeof value === 'string') return value;
        return JSON.stringify(value, null, 2);
    };

    return (
        <Card
            size="small"
            style={{ marginBottom: '12px' }}
            title={
                <Space>
                    <Checkbox
                        checked={selected}
                        onChange={(e) => onSelectionChange(e.target.checked)}
                    />
                    <Text strong>路径: {formatPath(operation?.path || '')}</Text>
                    <Text type="secondary">操作: {operation?.op || 'unknown'}</Text>
                </Space>
            }
            extra={
                <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                        console.log(`[PatchReviewModal] Edit button clicked - hasHumanTransform: ${hasHumanTransform}`);
                        handleStartEdit();
                    }}
                    loading={isCreatingTransform}
                    disabled={hasHumanTransform}
                >
                    {hasHumanTransform ? '编辑中' : '编辑'}
                </Button>
            }
        >
            <div>
                {(() => {
                    console.log(`[PatchReviewModal] Rendering content - hasHumanTransform: ${hasHumanTransform}, derivedJsondocId: ${derivedJsondocId}`);
                    return hasHumanTransform;
                })() ? (
                    <PatchApprovalEditor
                        patchJsondocId={derivedJsondocId || patchJsondoc.id}
                        onSave={() => {
                            console.log('[PatchReviewModal] Patch saved via special editor');
                            // The patch has been updated, UI should reflect changes automatically via Electric SQL
                        }}
                        onCancel={() => {
                            console.log('[PatchReviewModal] Patch editing cancelled');
                            // Could implement cancellation logic here if needed
                        }}
                    />
                ) : (
                    <div>
                        <Text strong>变更内容:</Text>
                        <DiffView
                            oldValue={formatValue(originalValue)}
                            newValue={formatValue(newValue)}
                        />
                    </div>
                )}
            </div>
        </Card>
    );
};

interface PatchReviewModalProps {
    projectId: string;
}

export const PatchReviewModal: React.FC<PatchReviewModalProps> = ({ projectId }) => {
    const { pendingPatches, isLoading, error } = usePendingPatchApproval(projectId);
    const [selectedPatches, setSelectedPatches] = useState<Set<string>>(new Set());
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionInput, setShowRejectionInput] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalVisible, setModalVisible] = useState(true);

    // Initialize selected patches when modal opens
    const handleModalOpen = useCallback(() => {
        if (pendingPatches) {
            // Select all patches by default
            const allPatchIds = new Set(pendingPatches.patchJsondocs.map(patch => patch.id));
            setSelectedPatches(allPatchIds);
        }
    }, [pendingPatches]);

    // Handle patch selection
    const handlePatchSelection = useCallback((patchId: string, selected: boolean) => {
        setSelectedPatches(prev => {
            const newSet = new Set(prev);
            if (selected) {
                newSet.add(patchId);
            } else {
                newSet.delete(patchId);
            }
            return newSet;
        });
    }, []);

    // Handle select all/none
    const handleSelectAll = useCallback((selectAll: boolean) => {
        if (pendingPatches) {
            if (selectAll) {
                setSelectedPatches(new Set(pendingPatches.patchJsondocs.map(patch => patch.id)));
            } else {
                setSelectedPatches(new Set());
            }
        }
    }, [pendingPatches]);

    // Handle approval
    const handleApprove = useCallback(async () => {
        if (!pendingPatches) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`/api/transforms/${pendingPatches.transformId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    selectedPatchIds: Array.from(selectedPatches)
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to approve patches');
            }

            const result = await response.json();
            console.log('Patches approved:', result);
            message.success(`补丁已批准！批准了 ${selectedPatches.size} 个补丁`);

            // Reset state
            setSelectedPatches(new Set());
            setRejectionReason('');
            setShowRejectionInput(false);
        } catch (error) {
            console.error('Failed to approve patches:', error);
            message.error(`批准失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsProcessing(false);
        }
    }, [pendingPatches, selectedPatches]);

    // Handle rejection
    const handleReject = useCallback(async () => {
        if (!pendingPatches) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`/api/transforms/${pendingPatches.transformId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    rejectionReason: rejectionReason || 'User rejected patches'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to reject patches');
            }

            const result = await response.json();
            console.log('Patches rejected:', result);
            message.success(`补丁已拒绝！删除了 ${result.deletedPatchIds?.length || 0} 个补丁`);

            // Reset state
            setSelectedPatches(new Set());
            setRejectionReason('');
            setShowRejectionInput(false);
        } catch (error) {
            console.error('Failed to reject patches:', error);
            message.error(`拒绝失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsProcessing(false);
        }
    }, [pendingPatches, rejectionReason]);

    // Handle modal close
    const handleClose = useCallback(() => {
        setModalVisible(false);
        // Modal will reappear when pendingPatches changes or on refresh
        // This is by design as per the requirements
    }, []);

    // Reset modal visibility when new pending patches appear
    React.useEffect(() => {
        if (pendingPatches) {
            setModalVisible(true);
        }
    }, [pendingPatches]);

    // Don't show modal if no pending patches or if user dismissed it
    if (!pendingPatches || !modalVisible) {
        return null;
    }

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined />
                    <span>补丁审核</span>
                    <Text type="secondary">({pendingPatches.patchJsondocs.length} 个补丁待审核)</Text>
                </Space>
            }
            open={true}
            onCancel={handleClose}
            afterOpenChange={(open) => {
                if (open) {
                    handleModalOpen();
                }
            }}
            width={800}
            footer={
                <Space>
                    <Button onClick={handleClose}>
                        稍后处理
                    </Button>
                    <Button
                        danger
                        onClick={() => setShowRejectionInput(true)}
                        loading={isProcessing}
                    >
                        拒绝选中的补丁
                    </Button>
                    <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={handleApprove}
                        loading={isProcessing}
                        disabled={selectedPatches.size === 0}
                    >
                        批准选中的补丁 ({selectedPatches.size})
                    </Button>
                </Space>
            }
        >
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {/* Header Info */}
                <Card size="small" style={{ marginBottom: '16px' }}>
                    <Paragraph>
                        <Text strong>原始文档:</Text> {pendingPatches.originalJsondoc.schema_type}
                    </Paragraph>
                    {pendingPatches.editRequirements && (
                        <Paragraph>
                            <Text strong>编辑要求:</Text> {pendingPatches.editRequirements}
                        </Paragraph>
                    )}

                </Card>

                {/* Patch Selection Controls */}
                <div style={{ marginBottom: '16px' }}>
                    <Space>
                        <Button
                            size="small"
                            onClick={() => handleSelectAll(true)}
                        >
                            全选
                        </Button>
                        <Button
                            size="small"
                            onClick={() => handleSelectAll(false)}
                        >
                            全不选
                        </Button>
                        <Text type="secondary">
                            已选择 {selectedPatches.size} / {pendingPatches.patchJsondocs.length} 个补丁
                        </Text>
                    </Space>
                </div>

                {/* Patch Cards */}
                {pendingPatches.patchJsondocs.map((patchJsondoc) => (
                    <PatchReviewCard
                        key={patchJsondoc.id}
                        patchJsondoc={patchJsondoc}
                        originalJsondoc={pendingPatches.originalJsondoc}
                        selected={selectedPatches.has(patchJsondoc.id)}
                        onSelectionChange={(selected) => handlePatchSelection(patchJsondoc.id, selected)}
                        projectId={projectId}
                    />
                ))}

                {/* Rejection Reason Input */}
                {showRejectionInput && (
                    <>
                        <Divider />
                        <Card size="small" title="拒绝原因">
                            <div className="yjs-field-dark-theme">
                                <TextArea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="请说明拒绝这些补丁的原因（可选）..."
                                    rows={3}
                                    style={{ marginBottom: '12px' }}
                                />
                            </div>
                            <Space>
                                <Button
                                    danger
                                    icon={<CloseOutlined />}
                                    onClick={handleReject}
                                    loading={isProcessing}
                                >
                                    确认拒绝
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShowRejectionInput(false);
                                        setRejectionReason('');
                                    }}
                                >
                                    取消
                                </Button>
                            </Space>
                        </Card>
                    </>
                )}
            </div>
        </Modal>
    );
}; 