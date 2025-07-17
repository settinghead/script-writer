import React, { useState, useEffect } from 'react';
import { Button, message } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ExportModal } from './ExportModal';
import { exportService, ExportableItem } from '../services/exportService';
import { useProjectData } from '../contexts/ProjectDataContext';

interface ExportButtonProps {
    projectId: string;
    isMobile?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    projectId,
    isMobile = false
}) => {
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportableItems, setExportableItems] = useState<ExportableItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const projectData = useProjectData();

    const handleExportClick = async () => {
        setIsLoading(true);
        try {
            const items = await exportService.getExportableItems(projectId);
            setExportableItems(items);
            setShowExportModal(true);
        } catch (error) {
            console.error('Failed to get exportable items:', error);
            message.error('获取导出项目失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowExportModal(false);
    };

    // Don't render anything if no projectId
    if (!projectId) {
        return null;
    }

    return (
        <>
            <Button
                type="text"
                icon={<ExportOutlined />}
                onClick={handleExportClick}
                loading={isLoading}
                style={{
                    color: '#1890ff'
                }}
                size={isMobile ? 'small' : 'middle'}
            >
                {isMobile ? '' : '导出'}
            </Button>

            <ExportModal
                visible={showExportModal}
                onClose={handleCloseModal}
                exportableItems={exportableItems}
                lineageGraph={projectData.lineageGraph}
                jsondocs={Array.isArray(projectData.jsondocs) ? projectData.jsondocs : []}
                projectId={projectId}
            />
        </>
    );
}; 