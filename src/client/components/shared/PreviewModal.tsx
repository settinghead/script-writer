import React, { useEffect } from 'react';
import { Modal, Typography, Spin } from 'antd';
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

    return (
        <Modal
            title="导出预览"
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
                    <pre style={{
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
                    }}>
                        {content}
                    </pre>
                )}
            </div>
        </Modal>
    );
}; 