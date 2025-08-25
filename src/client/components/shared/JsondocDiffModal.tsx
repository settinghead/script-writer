import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Typography, Spin, message } from 'antd';
import yaml from 'js-yaml';
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

    const toYaml = (value: unknown): string => {
        try {
            let data: unknown = value;
            if (typeof value === 'string') {
                try {
                    data = JSON.parse(value);
                } catch {
                    // If it's not JSON, assume it's already a readable string (possibly YAML)
                    return value;
                }
            }
            const normalized = data == null ? {} : data;
            return yaml.dump(normalized, { sortKeys: false, noRefs: true, lineWidth: 120 });
        } catch (err) {
            try {
                return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
            } catch {
                return '';
            }
        }
    };

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

                const bt = toYaml(before.data);
                const at = toYaml(after.data);
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

    const noChanges = useMemo(() => {
        return beforeText.trim() === afterText.trim();
    }, [beforeText, afterText]);

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
                <>
                    <DiffView oldValue={beforeText} newValue={afterText} />
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: '#ff4d4f', borderRadius: 2, marginRight: 8 }} />
                                <Text type="secondary">删除</Text>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: '#52c41a', borderRadius: 2, marginRight: 8 }} />
                                <Text type="secondary">新增</Text>
                            </div>
                        </div>
                        {noChanges && (
                            <Text type="secondary">暂无变更</Text>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
};

export default JsondocDiffModal;


