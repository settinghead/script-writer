import React from 'react';
import { Modal, Typography, Spin } from 'antd';

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
                        backgroundColor: '#f5f5f5',
                        padding: '16px',
                        borderRadius: '6px',
                        border: '1px solid #d9d9d9'
                    }}>
                        {content}
                    </pre>
                )}
            </div>
        </Modal>
    );
}; 