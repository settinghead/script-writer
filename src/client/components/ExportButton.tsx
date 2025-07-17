import React, { useState } from 'react';
import { Button } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ExportModal } from './ExportModal';
import { generateExportableItems } from '../services/exportService';
import { useProjectData } from '../contexts/ProjectDataContext';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';

interface ExportButtonProps {
    projectId: string;
    isMobile?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    projectId,
    isMobile = false
}) => {
    const [showExportModal, setShowExportModal] = useState(false);
    const projectData = useProjectData();

    const handleExportClick = () => {
        setShowExportModal(true);
    };

    const handleCloseModal = () => {
        setShowExportModal(false);
    };

    // Don't render anything if no projectId
    if (!projectId) {
        return null;
    }

    // Generate exportable items from current project state
    const workflowState = computeUnifiedWorkflowState(projectData, projectId);
    const exportableItems = generateExportableItems(
        workflowState.displayComponents,
        projectData.lineageGraph,
        Array.isArray(projectData.jsondocs) ? projectData.jsondocs : []
    );

    // Disable export if no exportable items
    const hasExportableItems = exportableItems.length > 0;

    return (
        <>
            <Button
                type="text"
                icon={<ExportOutlined />}
                onClick={handleExportClick}
                disabled={!hasExportableItems}
                style={{
                    color: hasExportableItems ? '#1890ff' : '#d9d9d9'
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
            />
        </>
    );
}; 