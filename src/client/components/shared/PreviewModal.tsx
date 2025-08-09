import React, { useEffect, useMemo, useRef } from 'react';
import { Modal, Typography, Spin, Button, Tooltip } from 'antd';
import { CopyOutlined, SelectOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

const { Text } = Typography;

interface PreviewModalProps {
    open: boolean;
    onClose: () => void;
    content: string;
    loading: boolean;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
    open,
    onClose,
    content,
    loading
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const preRef = useRef<HTMLPreElement | null>(null);

    // Reflect open state in URL (?export-preview=1)
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        if (open) {
            params.set('export-preview', '1');
        } else {
            params.delete('export-preview');
        }
        setSearchParams(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Title with copy button (icon-only)
    const selectAll = () => {
        const el = preRef.current;
        if (!el) return;
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.addRange(range);
    };

    const copySelectedOrAll = () => {
        const container = preRef.current;
        if (!container) return;
        const selection = window.getSelection();
        let textToCopy = '';
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (container.contains(range.commonAncestorContainer)) {
                textToCopy = selection.toString();
            }
        }
        if (!textToCopy) {
            textToCopy = container.textContent || '';
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(textToCopy).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = textToCopy;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (_) { /* noop */ }
                document.body.removeChild(ta);
            });
        } else {
            const ta = document.createElement('textarea');
            ta.value = textToCopy;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (_) { /* noop */ }
            document.body.removeChild(ta);
        }
    };

    const modalTitle = useMemo(() => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 40 }}>
            <span>导出预览</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                <Tooltip title="全选">
                    <Button type="text" size="small" icon={<SelectOutlined />} onClick={selectAll} />
                </Tooltip>
                <Tooltip title="复制选中或全部">
                    <Button type="text" size="small" icon={<CopyOutlined />} onClick={copySelectedOrAll} />
                </Tooltip>
            </div>
        </div>
    ), []);

    return (
        <Modal
            title={modalTitle}
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
            style={{ top: 20 }}
        >
            <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: '16px' }}>
                            <Text type="secondary">正在生成预览...</Text>
                        </div>
                    </div>
                ) : (
                    <pre
                        ref={preRef}
                        tabIndex={0}
                        onFocus={() => {
                            const el = preRef.current;
                            if (!el) return;
                            const selection = window.getSelection();
                            if (!selection) return;
                            selection.removeAllRanges();
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            selection.addRange(range);
                        }}
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                            backgroundColor: '#1f1f1f',
                            color: '#ffffff',
                            padding: '16px',
                            borderRadius: '6px',
                            border: '1px solid #434343'
                        }}
                    >
                        {content}
                    </pre>
                )}
            </div>
        </Modal>
    );
}; 