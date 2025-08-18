import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Typography, Spin, message } from 'antd';
import DiffView from './DiffView';

const { Text } = Typography;

interface JsondocDiffModalProps {
    open: boolean;
    onClose: () => void;
    beforeJsondocId: string; // required
    afterJsondocId: string;  // required
    title?: string;
}

export const JsondocDiffModal: React.FC<JsondocDiffModalProps> = ({ open, onClose, beforeJsondocId, afterJsondocId, title }) => {
    const [loading, setLoading] = useState(false);
    const [beforeText, setBeforeText] = useState('');
    const [afterText, setAfterText] = useState('');

    useEffect(() => {
        if (!open) return;

        const fetchBoth = async () => {
            setLoading(true);
            try {
                const [a, b] = await Promise.all([
                    fetch(`/api/jsondocs/${beforeJsondocId}`, {
                        headers: { 'Authorization': 'Bearer debug-auth-token-script-writer-dev' },
                        credentials: 'include'
                    }),
                    fetch(`/api/jsondocs/${afterJsondocId}`, {
                        headers: { 'Authorization': 'Bearer debug-auth-token-script-writer-dev' },
                        credentials: 'include'
                    })
                ]);

                if (!a.ok || !b.ok) {
                    throw new Error('加载对比数据失败');
                }
                const before = await a.json();
                const after = await b.json();

                const bt = typeof before.data === 'string' ? before.data : JSON.stringify(before.data ?? {}, null, 2);
                const at = typeof after.data === 'string' ? after.data : JSON.stringify(after.data ?? {}, null, 2);
                setBeforeText(bt);
                setAfterText(at);
            } catch (e: any) {
                console.error(e);
                message.error(e.message || '加载失败');
            } finally {
                setLoading(false);
            }
        };
        fetchBoth();
    }, [open, beforeJsondocId, afterJsondocId]);

    return (
        <Modal
            title={title || '修改总结'}
            open={open}
            onCancel={onClose}
            footer={null}
            width={900}
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                </div>
            ) : (
                <DiffView oldValue={beforeText} newValue={afterText} />
            )}
        </Modal>
    );
};

export default JsondocDiffModal;


