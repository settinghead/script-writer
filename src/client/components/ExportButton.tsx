import React, { useState } from 'react';
import { Button } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ExportModal } from './ExportModal';

interface ExportButtonProps {
    projectId: string;
    isMobile?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    projectId,
    isMobile = false
}) => {
    const [showExportModal, setShowExportModal] = useState(false);

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

    return (
        <>
            <Button
                type="text"
                icon={<ExportOutlined />}
                onClick={handleExportClick}
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
                projectId={projectId}
            />
        </>
    );
}; 