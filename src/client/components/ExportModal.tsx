import React, { useState, useEffect } from 'react';
import { Modal, Checkbox, Radio, Input, Button, Space, Divider, message, Spin, Card, Row, Col } from 'antd';
import { DownloadOutlined, EyeOutlined, FileTextOutlined, VideoCameraOutlined } from '@ant-design/icons';
import {
    ExportableItem,
    exportService
} from '../services/exportService';
import { PreviewModal } from './shared/PreviewModal';

interface ExportModalProps {
    visible: boolean;
    onClose: () => void;
    projectId: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
    visible,
    onClose,
    projectId
}) => {
    const [format, setFormat] = useState<'markdown' | 'docx'>('docx');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [filename, setFilename] = useState('');
    const [exportableItems, setExportableItems] = useState<ExportableItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewContent, setPreviewContent] = useState('');
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    // Separate regular items from episode groups
    const regularItems = exportableItems.filter(item => item.type !== 'episode_group');
    const episodeGroups = exportableItems.filter(item => item.type === 'episode_group');

    // Fetch exportable items when modal opens
    useEffect(() => {
        if (visible && projectId) {
            fetchExportableItems();
        }
    }, [visible, projectId]);

    // Initialize selected items and filename when exportable items are loaded
    useEffect(() => {
        if (exportableItems.length > 0) {
            const defaultSelected = exportableItems
                .filter(item => item.defaultSelected)
                .map(item => item.id);
            setSelectedItems(defaultSelected);

            // Generate a simple filename since we don't have access to lineage graph anymore
            const timestamp = new Date().toISOString().slice(0, 10);
            const extension = format === 'markdown' ? 'md' : 'docx';
            setFilename(`项目导出_${timestamp}.${extension}`);
        }
    }, [exportableItems, format]);

    const fetchExportableItems = async () => {
        setIsLoading(true);
        try {
            const items = await exportService.getExportableItems(projectId);
            setExportableItems(items);
        } catch (error) {
            console.error('Failed to fetch exportable items:', error);
            message.error('获取导出项目失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

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

    const handleSelectAllEpisodes = () => {
        const episodeIds = episodeGroups.map(item => item.id);
        const nonEpisodeSelected = selectedItems.filter(id => !episodeIds.includes(id));
        setSelectedItems([...nonEpisodeSelected, ...episodeIds]);
    };

    const handleSelectNoEpisodes = () => {
        const episodeIds = episodeGroups.map(item => item.id);
        setSelectedItems(selectedItems.filter(id => !episodeIds.includes(id)));
    };

    const handlePreview = async () => {
        if (selectedItems.length === 0) {
            message.warning('请先选择要预览的内容');
            return;
        }

        setIsLoadingPreview(true);
        setPreviewVisible(true);

        try {
            const content = await exportService.previewExport(projectId, selectedItems);
            setPreviewContent(content);
        } catch (error) {
            console.error('Preview failed:', error);
            message.error('预览失败，请重试');
            setPreviewVisible(false);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleExport = async () => {
        if (selectedItems.length === 0) {
            message.warning('请先选择要导出的内容');
            return;
        }

        if (!filename.trim()) {
            message.warning('请输入文件名');
            return;
        }

        setIsExporting(true);
        try {
            await exportService.exportProject(projectId, format, selectedItems, filename);
            message.success('导出成功！');
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            message.error('导出失败，请重试');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Modal
                title="导出项目"
                open={visible}
                onCancel={onClose}
                footer={[
                    <Button key="cancel" onClick={onClose}>
                        取消
                    </Button>,
                    <Button
                        key="preview"
                        icon={<EyeOutlined />}
                        onClick={handlePreview}
                        disabled={selectedItems.length === 0 || isLoading}
                    >
                        预览
                    </Button>,
                    <Button
                        key="export"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        loading={isExporting}
                        disabled={selectedItems.length === 0 || isLoading}
                    >
                        导出
                    </Button>
                ]}
                width={900}
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
                                <Button size="small" onClick={handleSelectDefault} disabled={isLoading}>
                                    默认选择
                                </Button>
                                <Button size="small" onClick={handleSelectAll} disabled={isLoading}>
                                    全选
                                </Button>
                                <Button size="small" onClick={handleSelectNone} disabled={isLoading}>
                                    全不选
                                </Button>
                            </Space>
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <Spin size="large" />
                                <div style={{ marginTop: 16, color: '#999' }}>
                                    正在加载导出项目...
                                </div>
                            </div>
                        ) : (
                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                {/* Regular Items */}
                                {regularItems.length > 0 && (
                                    <div>
                                        <h5>项目基础内容</h5>
                                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                            {regularItems.map(item => (
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
                                    </div>
                                )}

                                {/* Episode Groups */}
                                {episodeGroups.length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <h5>分集内容</h5>
                                            <Space>
                                                <Button size="small" onClick={handleSelectAllEpisodes} disabled={isLoading}>
                                                    全选分集
                                                </Button>
                                                <Button size="small" onClick={handleSelectNoEpisodes} disabled={isLoading}>
                                                    取消分集
                                                </Button>
                                            </Space>
                                        </div>
                                        <Row gutter={[12, 12]}>
                                            {episodeGroups.map(item => (
                                                <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                                                    <Card
                                                        size="small"
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: selectedItems.includes(item.id) ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                                            backgroundColor: selectedItems.includes(item.id) ? '#ffffff' : '#ffffff'
                                                        }}
                                                        onClick={() => handleItemChange(item.id, !selectedItems.includes(item.id))}
                                                        hoverable
                                                    >
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                                                                <Checkbox
                                                                    checked={selectedItems.includes(item.id)}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        handleItemChange(item.id, e.target.checked);
                                                                    }}
                                                                >
                                                                    {item.name}
                                                                </Checkbox>
                                                            </div>
                                                            <Space direction="vertical" size="small">
                                                                {item.hasSynopsis && (
                                                                    <div style={{ fontSize: '12px', color: '#52c41a' }}>
                                                                        <FileTextOutlined /> 大纲
                                                                    </div>
                                                                )}
                                                                {item.hasScript && (
                                                                    <div style={{ fontSize: '12px', color: '#1890ff' }}>
                                                                        <VideoCameraOutlined /> 剧本
                                                                    </div>
                                                                )}
                                                                {!item.hasSynopsis && !item.hasScript && (
                                                                    <div style={{ fontSize: '12px', color: '#999' }}>
                                                                        暂无内容
                                                                    </div>
                                                                )}
                                                            </Space>
                                                        </div>
                                                    </Card>
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>
                                )}

                                {exportableItems.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                        暂无可导出的内容
                                    </div>
                                )}
                            </Space>
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
                            disabled={isLoading}
                        />
                    </div>
                </Space>
            </Modal>

            <PreviewModal
                open={previewVisible}
                onClose={() => setPreviewVisible(false)}
                content={previewContent}
                loading={isLoadingPreview}
            />
        </>
    );
}; 