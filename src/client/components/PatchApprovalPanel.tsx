import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Typography, Table, Button, Space, message, Tag } from 'antd';

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
        </Card>
    );
};

export default PatchApprovalPanel;


