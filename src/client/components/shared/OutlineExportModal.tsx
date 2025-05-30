import React, { useRef, useEffect } from 'react';
import { Modal, Button, Typography } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface OutlineExportModalProps {
    visible: boolean;
    onClose: () => void;
    exportText: string;
    title?: string;
}

export const OutlineExportModal: React.FC<OutlineExportModalProps> = ({
    visible,
    onClose,
    exportText,
    title = "导出大纲"
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Select all text when textarea is focused
    const handleTextareaFocus = () => {
        if (textareaRef.current) {
            textareaRef.current.select();
        }
    };

    // Copy to clipboard
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(exportText);
            // You could add a toast notification here
        } catch (error) {
            // Fallback for older browsers
            if (textareaRef.current) {
                textareaRef.current.select();
                document.execCommand('copy');
            }
        }
    };

    // Download as text file
    const handleDownload = () => {
        const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `outline-${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Auto-focus and select when modal opens
    useEffect(() => {
        if (visible && textareaRef.current) {
            setTimeout(() => {
                textareaRef.current?.focus();
                textareaRef.current?.select();
            }, 100);
        }
    }, [visible]);

    return (
        <Modal
            title={title}
            open={visible}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
                    复制文本
                </Button>,
                <Button key="download" icon={<DownloadOutlined />} onClick={handleDownload}>
                    下载文件
                </Button>,
                <Button key="close" type="primary" onClick={onClose}>
                    关闭
                </Button>
            ]}
            styles={{
                body: {
                    backgroundColor: '#1f1f1f',
                    maxHeight: '70vh',
                    overflow: 'hidden'
                }
            }}
        >
            <div style={{ marginBottom: '12px' }}>
                <Text type="secondary" style={{ color: '#888', fontSize: '14px' }}>
                    点击文本区域自动全选，可直接复制或下载
                </Text>
            </div>

            <textarea
                ref={textareaRef}
                value={exportText}
                readOnly
                onFocus={handleTextareaFocus}
                style={{
                    width: '100%',
                    height: '500px',
                    padding: '16px',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #404040',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#606060';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#404040';
                }}
            />
        </Modal>
    );
}; 