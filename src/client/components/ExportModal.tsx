import React, { useState, useEffect } from 'react';
import { Modal, Checkbox, Radio, Input, Button, Space, Divider, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import {
    ExportableItem,
    generateExportFilename,
    exportProject
} from '../services/exportService';

interface ExportModalProps {
    visible: boolean;
    onClose: () => void;
    exportableItems: ExportableItem[];
    lineageGraph: any;
    jsondocs: any[];
    projectId: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
    visible,
    onClose,
    exportableItems,
    lineageGraph,
    jsondocs,
    projectId
}) => {
    const [format, setFormat] = useState<'markdown' | 'docx'>('docx');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [filename, setFilename] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Initialize selected items and filename when modal opens
    useEffect(() => {
        if (visible) {
            const defaultSelected = exportableItems
                .filter(item => item.defaultSelected)
                .map(item => item.id);
            setSelectedItems(defaultSelected);

            const defaultFilename = generateExportFilename(lineageGraph, jsondocs, format);
            setFilename(defaultFilename);
        }
    }, [visible, exportableItems, lineageGraph, jsondocs, format]);

    // Update filename when format changes
    useEffect(() => {
        if (visible) {
            const newFilename = generateExportFilename(lineageGraph, jsondocs, format);
            setFilename(newFilename);
        }
    }, [format, lineageGraph, jsondocs, visible]);

    const handleItemChange = (itemId: string, checked: boolean) => {
        if (checked) {
            setSelectedItems([...selectedItems, itemId]);
        } else {
            setSelectedItems(selectedItems.filter(id => id !== itemId));
        }
    };

    const handleSelectAll = () => {
        setSelectedItems(exportableItems.map(item => item.id));
    };

    const handleSelectNone = () => {
        setSelectedItems([]);
    };

    const handleSelectDefault = () => {
        const defaultSelected = exportableItems
            .filter(item => item.defaultSelected)
            .map(item => item.id);
        setSelectedItems(defaultSelected);
    };

    const handleExport = async () => {
        if (selectedItems.length === 0) {
            message.warning('请选择要导出的内容');
            return;
        }

        if (!filename.trim()) {
            message.warning('请输入文件名');
            return;
        }

        setIsExporting(true);
        try {
            await exportProject(projectId, format, selectedItems, filename);
            message.success(format === 'markdown' ? 'Markdown 文件导出成功' : 'Word 文档导出成功');
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            message.error('导出失败，请重试');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Modal
            title="导出项目"
            open={visible}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    取消
                </Button>,
                <Button
                    key="export"
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    loading={isExporting}
                    disabled={selectedItems.length === 0}
                >
                    导出
                </Button>
            ]}
            width={600}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Format Selection */}
                <div>
                    <h4>导出格式</h4>
                    <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)}>
                        <Radio value="docx">Word 文档 (.docx)</Radio>
                        <Radio value="markdown">Markdown (.md)</Radio>
                    </Radio.Group>
                </div>

                <Divider />

                {/* Content Selection */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h4>选择导出内容</h4>
                        <Space>
                            <Button size="small" onClick={handleSelectDefault}>
                                默认选择
                            </Button>
                            <Button size="small" onClick={handleSelectAll}>
                                全选
                            </Button>
                            <Button size="small" onClick={handleSelectNone}>
                                全不选
                            </Button>
                        </Space>
                    </div>

                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {exportableItems.map(item => (
                            <Checkbox
                                key={item.id}
                                checked={selectedItems.includes(item.id)}
                                onChange={(e) => handleItemChange(item.id, e.target.checked)}
                            >
                                <span style={{ fontWeight: item.defaultSelected ? 'bold' : 'normal' }}>
                                    {item.name}
                                </span>
                                {!item.defaultSelected && (
                                    <span style={{ color: '#999', marginLeft: 8 }}>
                                        (前期准备)
                                    </span>
                                )}
                            </Checkbox>
                        ))}
                    </Space>

                    {exportableItems.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                            暂无可导出的内容
                        </div>
                    )}
                </div>

                <Divider />

                {/* Filename Input */}
                <div>
                    <h4>文件名</h4>
                    <Input
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="请输入文件名"
                        suffix={`.${format === 'markdown' ? 'md' : 'docx'}`}
                    />
                </div>
            </Space>
        </Modal>
    );
}; 