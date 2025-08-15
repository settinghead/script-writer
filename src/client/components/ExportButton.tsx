import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { ExportModal } from './ExportModal';
import { useSearchParams } from 'react-router-dom';
import { SettingOutlined } from '@ant-design/icons';

interface ExportButtonProps {
    projectId: string;
    isMobile?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    projectId,
    isMobile = false
}) => {
    const [showExportModal, setShowExportModal] = useState(false);
    const [searchParams] = useSearchParams();

    const handleExportClick = () => {
        setShowExportModal(true);
    };

    const handleCloseModal = () => {
        setShowExportModal(false);
    };

    // Auto-open from URL (?export=1)
    useEffect(() => {
        if (searchParams.get('export') === '1') {
            setShowExportModal(true);
        }
    }, [searchParams]);

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

            {/* Quick access to project settings via URL param toggle */}
            <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => {
                    const sp = new URLSearchParams(searchParams);
                    sp.set('projectSettings', '1');
                    window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
                    // Trigger modal open via searchParams effect
                    // Force a re-read by dispatching a popstate
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                style={{ color: '#1890ff' }}
                size={isMobile ? 'small' : 'middle'}
            >
                {isMobile ? '' : '设置'}
            </Button>

            <ExportModal
                visible={showExportModal}
                onClose={handleCloseModal}
                projectId={projectId}
            />
        </>
    );
}; 