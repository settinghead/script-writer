import React, { useState, useCallback, useMemo } from 'react';
import { Modal, Button, Space, Card, Typography, Checkbox, Input, message, Divider } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { usePendingPatchApproval, type PendingPatchGroup } from '../hooks/usePendingPatchApproval';
import { YJSJsondocProvider } from '../transform-jsondoc-framework/contexts/YJSJsondocContext';
import { YJSTextField, YJSTextAreaField } from '../transform-jsondoc-framework/components/YJSField';
import type { ElectricJsondoc } from '../../common/types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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
    const [editMode, setEditMode] = useState(false);

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

    // Get value preview
    const getValuePreview = (value: any) => {
        if (value === null || value === undefined) return '(空)';
        if (typeof value === 'string') return value.length > 100 ? value.substring(0, 100) + '...' : value;
        return JSON.stringify(value);
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
                    onClick={() => setEditMode(!editMode)}
                >
                    {editMode ? '完成编辑' : '编辑'}
                </Button>
            }
        >
            <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                    <Text strong>原值:</Text>
                    <div style={{
                        background: '#2a1d1d',
                        border: '1px solid #5c4040',
                        borderRadius: '4px',
                        padding: '8px',
                        marginTop: '4px',
                        whiteSpace: 'pre-wrap',
                        color: '#ffcccc'
                    }}>
                        {getValuePreview(originalValue)}
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <Text strong>新值:</Text>
                    <div style={{ marginTop: '4px' }}>
                        {editMode ? (
                            <div className="yjs-field-dark-theme">
                                <YJSJsondocProvider
                                    jsondocId={patchJsondoc.id}
                                >
                                    {typeof newValue === 'string' && newValue.length > 50 ? (
                                        <YJSTextAreaField
                                            path="patches.0.value"
                                            placeholder="编辑新值..."
                                            rows={4}
                                        />
                                    ) : (
                                        <YJSTextField
                                            path="patches.0.value"
                                            placeholder="编辑新值..."
                                        />
                                    )}
                                </YJSJsondocProvider>
                            </div>
                        ) : (
                            <div style={{
                                background: '#1d2a1d',
                                border: '1px solid #405c40',
                                borderRadius: '4px',
                                padding: '8px',
                                whiteSpace: 'pre-wrap',
                                color: '#ccffcc'
                            }}>
                                {getValuePreview(newValue)}
                            </div>
                        )}
                    </div>
                </div>
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
                    <Title level={5}>编辑请求</Title>
                    <Paragraph>
                        <Text strong>原始文档:</Text> {pendingPatches.originalJsondoc.schema_type}
                    </Paragraph>
                    {pendingPatches.editRequirements && (
                        <Paragraph>
                            <Text strong>编辑要求:</Text> {pendingPatches.editRequirements}
                        </Paragraph>
                    )}
                    <Paragraph>
                        <Text strong>创建时间:</Text> {new Date(pendingPatches.createdAt).toLocaleString('zh-CN')}
                    </Paragraph>
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