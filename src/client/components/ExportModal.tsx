import React, { useState, useEffect } from 'react';
import { Modal, Checkbox, Radio, Input, Button, Space, Divider, message, Spin, Card, Row, Col } from 'antd';
import { DownloadOutlined, EyeOutlined, FileTextOutlined, VideoCameraOutlined } from '@ant-design/icons';
import {
    ExportableItem,
    exportService
} from '../services/exportService';
import { PreviewModal } from './shared/PreviewModal';
import { useLocalStorage } from '../hooks/useLocalStorage';

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
    const [initializedFromStorage, setInitializedFromStorage] = useState(false);

    type PersistState = {
        selectedItems: string[];
        format: 'markdown' | 'docx';
        filename: string;
        lastUpdated: number;
    };

    const storageKey = `export-modal-state-${projectId}`;
    const [persisted, setPersisted] = useLocalStorage<PersistState>(storageKey, {
        selectedItems: [],
        format: 'docx',
        filename: '',
        lastUpdated: 0
    });

    // URL syncing is controlled by parent (`ExportButton`). This component no longer
    // reads or writes query params to avoid race conditions.

    // Separate regular items from episode groups
    // Exclude per-episode items (单集大纲/单集剧本) from the regular list; they are controlled within episode cards
    const regularItems = exportableItems.filter((item) => {
        // TypeScript narrow: treat type as string for comparison to include new values from server
        const t = item.type as string;
        return t !== 'episode_group' && t !== '单集大纲' && t !== '单集剧本';
    });
    const episodeGroups = exportableItems.filter(item => item.type === 'episode_group');

    // Fetch exportable items when modal opens
    useEffect(() => {
        if (visible && projectId) {
            fetchExportableItems();
        }
    }, [visible, projectId]);

    // Initialize from localStorage (preferred), otherwise defaults
    useEffect(() => {
        if (exportableItems.length === 0) return;

        const idSet = new Set(exportableItems.map(i => i.id));
        const persistedSelected = (persisted?.selectedItems || []).filter(id => idSet.has(id));

        const initialSelected = persistedSelected.length > 0
            ? persistedSelected
            : exportableItems.filter(item => item.defaultSelected).map(item => item.id);
        setSelectedItems(initialSelected);

        const desiredFormat = persisted?.format || format;
        if (desiredFormat !== format) setFormat(desiredFormat);

        const ts = new Date().toISOString().slice(0, 10);
        const ext = (persisted?.format || desiredFormat) === 'markdown' ? 'md' : 'docx';
        const initialFilename = persisted?.filename && persisted.filename.trim().length > 0
            ? persisted.filename
            : `项目导出_${ts}.${ext}`;
        setFilename(initialFilename);

        setInitializedFromStorage(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exportableItems]);

    // Fallback: if storage not yet initialized, set a sensible default filename on format change
    useEffect(() => {
        if (!initializedFromStorage && exportableItems.length > 0) {
            const timestamp = new Date().toISOString().slice(0, 10);
            const extension = format === 'markdown' ? 'md' : 'docx';
            setFilename(prev => prev && prev.length > 0 ? prev : `项目导出_${timestamp}.${extension}`);
        }
    }, [exportableItems, format, initializedFromStorage]);

    // Persist whenever user changes options while modal is open
    useEffect(() => {
        if (!visible) return;
        setPersisted({
            selectedItems,
            format,
            filename,
            lastUpdated: Date.now()
        });
    }, [visible, selectedItems, format, filename, setPersisted]);

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
                                                            border: selectedItems.includes(item.id) ? '1px solid #434343' : '1px solid #303030',
                                                            backgroundColor: '#141414',
                                                            color: '#fff'
                                                        }}
                                                        onClick={() => handleItemChange(item.id, !selectedItems.includes(item.id))}
                                                        hoverable
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                                                                {item.name}
                                                            </div>
                                                            <Space direction="vertical" size="small">
                                                                <Checkbox
                                                                    checked={selectedItems.includes(item.id)}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        handleItemChange(item.id, e.target.checked);
                                                                    }}
                                                                    style={{ color: '#fff' }}
                                                                >
                                                                    整集（大纲+剧本）
                                                                </Checkbox>
                                                                {item.hasSynopsis && (
                                                                    <Checkbox
                                                                        checked={selectedItems.includes(`${item.id}-synopsis`)}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            handleItemChange(`${item.id}-synopsis`, e.target.checked);
                                                                        }}
                                                                        style={{ color: '#fff' }}
                                                                    >
                                                                        <FileTextOutlined /> 大纲
                                                                    </Checkbox>
                                                                )}
                                                                {item.hasScript && (
                                                                    <Checkbox
                                                                        checked={selectedItems.includes(`${item.id}-script`)}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            handleItemChange(`${item.id}-script`, e.target.checked);
                                                                        }}
                                                                        style={{ color: '#fff' }}
                                                                    >
                                                                        <VideoCameraOutlined /> 剧本
                                                                    </Checkbox>
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