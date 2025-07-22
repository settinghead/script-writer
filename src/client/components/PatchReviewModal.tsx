import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Modal, Button, Space, Card, Typography, Checkbox, message, Tag, Divider } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { usePendingPatchApproval, type PendingPatchItem } from '../hooks/usePendingPatchApproval';

import * as Diff from 'diff';

const { Title, Text, Paragraph } = Typography;

// Helper function to format values for display
const formatValueForDisplay = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // For objects and arrays, format as JSON with proper indentation
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
};

// Diff view component
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
            wordBreak: 'break-word'
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

// Individual patch card component
const PatchCard: React.FC<{
    patchItem: PendingPatchItem;
    isSelected: boolean;
    onSelectionChange: (selected: boolean) => void;
}> = ({ patchItem, isSelected, onSelectionChange }) => {
    const { patchJsondoc, originalJsondoc, sourceTransformMetadata } = patchItem;

    // Parse patch data
    const patchData = useMemo(() => {
        try {
            const data = typeof patchJsondoc.data === 'string'
                ? JSON.parse(patchJsondoc.data)
                : patchJsondoc.data;
            return data;
        } catch (error) {
            console.error('Failed to parse patch data:', error);
            return { patches: [] };
        }
    }, [patchJsondoc.data]);

    // Parse original data
    const originalData = useMemo(() => {
        try {
            const data = typeof originalJsondoc.data === 'string'
                ? JSON.parse(originalJsondoc.data)
                : originalJsondoc.data;
            return data;
        } catch (error) {
            console.error('Failed to parse original data:', error);
            return {};
        }
    }, [originalJsondoc.data]);

    // Generate human-readable path for the first patch (for title display)
    const generateHumanReadablePath = (path: string[], originalData: any, includeSchemaType: boolean = true) => {
        const pathParts: string[] = includeSchemaType ? [originalJsondoc.schema_type] : []; // Start with schema type if requested

        for (let i = 0; i < path.length; i++) {
            const segment = path[i];

            if (segment === 'characters') {
                pathParts.push('角色');
            } else if (segment === 'selling_points') {
                pathParts.push('卖点');
            } else if (segment === 'satisfaction_points') {
                pathParts.push('爽点');
            } else if (segment === 'target_audience') {
                pathParts.push('目标受众');
            } else if (segment === 'setting') {
                pathParts.push('设定');
            } else if (segment === 'key_scenes') {
                pathParts.push('关键场景');
            } else if (segment === 'core_themes') {
                pathParts.push('核心主题');
            } else if (segment === 'personality_traits') {
                pathParts.push('性格特征');
            } else if (segment === 'relationships') {
                pathParts.push('人际关系');
            } else if (segment === 'character_arc') {
                pathParts.push('角色弧光');
            } else if (segment === 'description') {
                pathParts.push('描述');
            } else if (segment === 'name') {
                pathParts.push('姓名');
            } else if (segment === 'age') {
                pathParts.push('年龄');
            } else if (segment === 'gender') {
                pathParts.push('性别');
            } else if (segment === 'occupation') {
                pathParts.push('职业');
            } else if (segment === 'type') {
                pathParts.push('类型');
            } else if (segment === 'demographic') {
                pathParts.push('人口统计');
            } else if (segment === 'core_setting_summary') {
                pathParts.push('核心设定概要');
            } else if (!isNaN(Number(segment))) {
                // This is an array index, try to get a meaningful name
                const parentPath = path.slice(0, i);
                const parentObj = parentPath.reduce((obj: any, key: string) => obj?.[key], originalData);

                if (Array.isArray(parentObj) && parentObj[Number(segment)]) {
                    const item = parentObj[Number(segment)];
                    // Try to get a name or title for the item
                    const itemName = item?.name || item?.title || `第${Number(segment) + 1}项`;
                    pathParts.push(itemName);
                } else {
                    pathParts.push(`第${Number(segment) + 1}项`);
                }
            } else {
                // Keep original segment as fallback
                pathParts.push(segment);
            }
        }

        return pathParts.join(' → ');
    };

    // Get the first patch for title display
    const firstPatch = patchData.patches?.[0];
    const titlePath = firstPatch ? generateHumanReadablePath(
        firstPatch.path.replace(/^\//, '').split('/'),
        originalData,
        false // Don't include schema type in path since we show it as a pill
    ) : '';

    const patchOperation = firstPatch?.op === 'replace' ? '修改' : firstPatch?.op === 'add' ? '添加' : '删除';

    return (
        <Card
            size="small"
            style={{
                marginBottom: 12,
                border: isSelected ? '2px solid #1890ff' : '1px solid #434343',
                backgroundColor: isSelected ? '#001529' : '#141414'
            }}
            title={
                <Space wrap>
                    <Checkbox
                        checked={isSelected}
                        onChange={(e) => onSelectionChange(e.target.checked)}
                    />
                    <Text strong>修改提议 #{patchItem.patchIndex + 1}</Text>
                    <Tag color="blue">{originalJsondoc.schema_type}</Tag>
                    {sourceTransformMetadata?.toolName && (
                        <Tag color="green">{sourceTransformMetadata.toolName}</Tag>
                    )}
                    {titlePath && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            {patchOperation}: {titlePath}
                        </Text>
                    )}
                </Space>
            }
        >
            {patchData.patches && patchData.patches.length > 0 ? (
                patchData.patches.map((patch: any, index: number) => {
                    const fieldPath = patch.path.replace(/^\//, '').split('/');
                    const currentValue = fieldPath.reduce((obj: any, key: string) => obj?.[key], originalData);
                    const newValue = patch.value;

                    return (
                        <div key={index} style={{ marginBottom: 16 }}>
                            {patch.op === 'replace' && (
                                <DiffView
                                    oldValue={formatValueForDisplay(currentValue)}
                                    newValue={formatValueForDisplay(newValue)}
                                />
                            )}

                            {patch.op === 'add' && (
                                <pre style={{
                                    background: '#1a4a1a',
                                    border: '1px solid #52c41a',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    marginTop: '4px',
                                    color: '#95f985',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    {formatValueForDisplay(newValue)}
                                </pre>
                            )}

                            {patch.op === 'remove' && (
                                <pre style={{
                                    background: '#4a1a1a',
                                    border: '1px solid #ff4d4f',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    marginTop: '4px',
                                    color: '#ff7875',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    textDecoration: 'line-through',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    {formatValueForDisplay(currentValue)}
                                </pre>
                            )}
                        </div>
                    );
                })
            ) : (
                <Text type="secondary">无修改提议数据</Text>
            )}

            {/* Show metadata if available */}
            {sourceTransformMetadata?.editRequirements && (
                <div style={{ marginTop: 12, padding: 8, background: '#262626', borderRadius: 4 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        编辑要求: {sourceTransformMetadata.editRequirements}
                    </Text>
                </div>
            )}
        </Card>
    );
};

interface PatchReviewModalProps {
    projectId: string;
}

export const PatchReviewModal: React.FC<PatchReviewModalProps> = ({ projectId }) => {
    const { patches, isLoading, error } = usePendingPatchApproval(projectId);
    const [selectedPatches, setSelectedPatches] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalVisible, setModalVisible] = useState(true);

    // Reset modal visibility when new patches arrive
    useEffect(() => {
        if (patches && patches.length > 0) {
            setModalVisible(true);
            console.log(`[PatchReviewModal] New patches detected: ${patches.length}, showing modal`);
        }
    }, [patches?.length]); // Only depend on patch count to avoid excessive re-renders

    // Auto-select all patches when they load
    useEffect(() => {
        if (patches && patches.length > 0 && selectedPatches.size === 0) {
            const allPatchIds = new Set(patches.map(patch => patch.patchJsondoc.id));
            setSelectedPatches(allPatchIds);
        }
    }, [patches, selectedPatches.size]);

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
        if (patches && patches.length > 0) {
            if (selectAll) {
                setSelectedPatches(new Set(patches.map(patch => patch.patchJsondoc.id)));
            } else {
                setSelectedPatches(new Set());
            }
        }
    }, [patches]);

    // Handle approval
    const handleApprove = useCallback(async () => {
        if (!patches || patches.length === 0 || selectedPatches.size === 0) return;

        setIsProcessing(true);
        try {
            const response = await fetch('/api/patches/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    selectedPatchIds: Array.from(selectedPatches),
                    projectId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to approve patches');
            }

            const result = await response.json();
            console.log('Patches approved:', result);
            message.success(`修改提议已批准！批准了 ${selectedPatches.size} 个修改提议`);

            // Close modal
            setModalVisible(false);
        } catch (error) {
            console.error('Failed to approve patches:', error);
            message.error(`批准失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsProcessing(false);
        }
    }, [patches, selectedPatches, projectId]);

    // Handle rejection
    const handleReject = useCallback(async () => {
        if (!patches || patches.length === 0 || selectedPatches.size === 0) return;

        setIsProcessing(true);
        try {
            const response = await fetch('/api/patches/reject', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    selectedPatchIds: Array.from(selectedPatches),
                    projectId,
                    rejectionReason: 'User rejected patches'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to reject patches');
            }

            const result = await response.json();
            console.log('Patches rejected:', result);
            message.success(`修改提议已拒绝！拒绝了 ${selectedPatches.size} 个修改提议`);

            // Close modal
            setModalVisible(false);
        } catch (error) {
            console.error('Failed to reject patches:', error);
            message.error(`拒绝失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsProcessing(false);
        }
    }, [patches, selectedPatches, projectId]);

    // Don't show modal if no patches
    if (!patches || patches.length === 0) {
        return null;
    }

    const selectedCount = selectedPatches.size;
    const totalCount = patches.length;

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined />
                    <span>修改提议审核</span>
                    <Tag color="blue">{totalCount} 个待审核修改提议</Tag>
                </Space>
            }
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            width="100vw"
            style={{ top: 0, paddingBottom: 0, maxWidth: 'none', height: '100vh' }}
            styles={{
                body: { height: 'calc(100vh - 110px)', padding: 0, maxHeight: 'none' },
                content: { height: '100vh', maxHeight: 'none' },
                mask: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }
            }}
            footer={
                <Space>
                    <Checkbox
                        checked={selectedCount === totalCount}
                        indeterminate={selectedCount > 0 && selectedCount < totalCount}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                    >
                        全选 ({selectedCount}/{totalCount})
                    </Checkbox>

                    <Divider type="vertical" />

                    <Button
                        onClick={() => setModalVisible(false)}
                        disabled={isProcessing}
                    >
                        取消
                    </Button>
                    <Button
                        danger
                        icon={<CloseOutlined />}
                        onClick={handleReject}
                        disabled={selectedCount === 0 || isProcessing}
                        loading={isProcessing}
                    >
                        拒绝选中 ({selectedCount})
                    </Button>
                    <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={handleApprove}
                        disabled={selectedCount === 0 || isProcessing}
                        loading={isProcessing}
                    >
                        批准选中 ({selectedCount})
                    </Button>
                </Space>
            }
        >
            {isLoading && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Text>加载修改提议中...</Text>
                </div>
            )}

            {error && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Text type="danger">加载修改提议失败: {error.message}</Text>
                </div>
            )}

            {patches && patches.length > 0 && (
                <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
                    {patches.map((patchItem, index) => (
                        <PatchCard
                            key={patchItem.patchJsondoc.id}
                            patchItem={{ ...patchItem, patchIndex: index }}
                            isSelected={selectedPatches.has(patchItem.patchJsondoc.id)}
                            onSelectionChange={(selected) =>
                                handlePatchSelection(patchItem.patchJsondoc.id, selected)
                            }
                        />
                    ))}
                </div>
            )}
        </Modal>
    );
}; 