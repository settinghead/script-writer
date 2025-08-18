import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Typography, Table, Button, Space, message, Tag, Modal } from 'antd';

const { Title, Text } = Typography;

interface PendingPatchItem {
    patchJsondoc: { id: string; schema_type: string; created_at?: string };
    originalJsondoc: { id: string; schema_type: string };
    sourceTransformId: string;
    sourceTransformMetadata: any;
    patchIndex: number;
}

interface PatchApprovalPanelProps {
    projectId: string;
}

export const PatchApprovalPanel: React.FC<PatchApprovalPanelProps> = ({ projectId }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<PendingPatchItem[]>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewContent, setPreviewContent] = useState<any[]>([]);

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/patches/pending/${projectId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            setData(body.patches || []);
        } catch (e: any) {
            console.error('Failed to load pending patches:', e);
            message.error('加载待审批补丁失败');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchPending(); }, [fetchPending]);

    const approveSelected = useCallback(async () => {
        if (selectedRowKeys.length === 0) return;
        setApproving(true);
        try {
            const res = await fetch('/api/patches/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                credentials: 'include',
                body: JSON.stringify({ projectId, selectedPatchIds: selectedRowKeys })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            message.success(`已批准 ${body.totalApprovedPatches} 个补丁`);
            setSelectedRowKeys([]);
            fetchPending();
        } catch (e: any) {
            console.error('Approve failed:', e);
            message.error('批准补丁失败');
        } finally {
            setApproving(false);
        }
    }, [selectedRowKeys, projectId, fetchPending]);

    const rejectSelected = useCallback(async () => {
        if (selectedRowKeys.length === 0) return;
        setRejecting(true);
        try {
            const res = await fetch('/api/patches/reject', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                credentials: 'include',
                body: JSON.stringify({ projectId, selectedPatchIds: selectedRowKeys, rejectionReason: '用户拒绝' })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            message.success(`已拒绝 ${selectedRowKeys.length} 个补丁`);
            setSelectedRowKeys([]);
            fetchPending();
        } catch (e: any) {
            console.error('Reject failed:', e);
            message.error('拒绝补丁失败');
        } finally {
            setRejecting(false);
        }
    }, [selectedRowKeys, projectId, fetchPending]);

    // RFC6902 JSON Pointer resolver
    const jsonPointerGet = (obj: any, pointer: string): any => {
        try {
            if (pointer === '' || pointer === '/') return obj;
            const parts = pointer.split('/').slice(1).map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
            return parts.reduce((acc: any, key: string) => {
                if (acc == null) return undefined;
                const idx = Number(key);
                if (Array.isArray(acc) && !Number.isNaN(idx)) {
                    return acc[idx];
                }
                return acc[key];
            }, obj);
        } catch {
            return undefined;
        }
    };

    const openPreview = useCallback(async (record: PendingPatchItem) => {
        try {
            // Fetch patch jsondoc
            const patchRes = await fetch(`/api/jsondocs/${record.patchJsondoc.id}`, { credentials: 'include' });
            if (!patchRes.ok) throw new Error(`HTTP ${patchRes.status}`);
            const patchJsondoc = await patchRes.json();

            // Fetch original jsondoc
            const origRes = await fetch(`/api/jsondocs/${record.originalJsondoc.id}`, { credentials: 'include' });
            if (!origRes.ok) throw new Error(`HTTP ${origRes.status}`);
            const originalJsondoc = await origRes.json();

            let patchData = patchJsondoc?.data;
            if (typeof patchData === 'string') {
                try { patchData = JSON.parse(patchData); } catch { }
            }
            const ops = Array.isArray(patchData?.patches) ? patchData.patches : [];

            let originalData = originalJsondoc?.data;
            if (typeof originalData === 'string') {
                try { originalData = JSON.parse(originalData); } catch { }
            }

            const enhanced = ops.map((op: any) => {
                const beforeVal = (op.op === 'add') ? undefined : jsonPointerGet(originalData, op.path);
                const afterVal = (op.op === 'remove') ? undefined : op.value;
                return { ...op, before: beforeVal, after: afterVal };
            });

            setPreviewContent(enhanced);
            setPreviewOpen(true);
        } catch (e: any) {
            console.error('Preview failed:', e);
            message.error('加载补丁内容失败');
        }
    }, []);

    const columns = [
        {
            title: '补丁ID',
            dataIndex: ['patchJsondoc', 'id'],
            key: 'patchId',
            width: 220,
            render: (val: string) => <Text style={{ color: '#bbb' }}>{val}</Text>
        },
        {
            title: '目标类型',
            dataIndex: ['originalJsondoc', 'schema_type'],
            key: 'targetType',
            width: 120,
            render: (val: string) => <Tag color="geekblue">{val}</Tag>
        },
        {
            title: '来源变换',
            dataIndex: 'sourceTransformId',
            key: 'transform',
            width: 200,
            render: (val: string) => <Text style={{ color: '#888' }}>{val}</Text>
        },
        {
            title: '创建时间',
            dataIndex: ['patchJsondoc', 'created_at'],
            key: 'createdAt',
            width: 180,
            render: (val: string) => <Text style={{ color: '#888' }}>{val ? new Date(val).toLocaleString() : '-'}</Text>
        },
        {
            title: '预览',
            key: 'preview',
            width: 100,
            render: (_: any, record: PendingPatchItem) => (
                <Button size="small" onClick={() => openPreview(record)}>预览</Button>
            )
        }
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys)
    };

    return (
        <Card
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #333' }}
            title={<Title level={5} style={{ color: '#fff', margin: 0 }}>待审批补丁</Title>}
            extra={(
                <Space>
                    <Button onClick={fetchPending} disabled={loading}>刷新</Button>
                    <Button type="primary" onClick={approveSelected} loading={approving} disabled={selectedRowKeys.length === 0}>批准</Button>
                    <Button danger onClick={rejectSelected} loading={rejecting} disabled={selectedRowKeys.length === 0}>拒绝</Button>
                </Space>
            )}
        >
            <Table
                rowKey={(r) => r.patchJsondoc.id}
                size="small"
                loading={loading}
                dataSource={data}
                columns={columns as any}
                rowSelection={rowSelection as any}
                pagination={{ pageSize: 5 }}
                style={{ color: '#ddd' }}
            />
            <Modal
                open={previewOpen}
                onCancel={() => setPreviewOpen(false)}
                footer={<Button onClick={() => setPreviewOpen(false)}>关闭</Button>}
                title={<Text style={{ color: '#fff' }}>补丁预览</Text>}
            >
                <div style={{ maxHeight: 360, overflow: 'auto' }}>
                    {previewContent.length === 0 ? (
                        <Text type="secondary">无可用补丁操作</Text>
                    ) : (
                        <Table
                            size="small"
                            pagination={false}
                            rowKey={(_, idx) => String(idx)}
                            dataSource={previewContent}
                            columns={[
                                { title: '操作', dataIndex: 'op', key: 'op', width: 100 },
                                { title: '路径', dataIndex: 'path', key: 'path', width: 240 },
                                { title: '原值', dataIndex: 'before', key: 'before', render: (val: any) => <Text style={{ color: '#f5222d' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</Text> },
                                { title: '新值', dataIndex: 'after', key: 'after', render: (val: any) => <Text style={{ color: '#52c41a' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</Text> }
                            ] as any}
                        />
                    )}
                </div>
            </Modal>
        </Card>
    );
}

export default PatchApprovalPanel;


