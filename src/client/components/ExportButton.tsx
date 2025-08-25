import React from 'react';
import { Button } from 'antd';
import { ExportOutlined, SettingOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { ExportModal } from './ExportModal';

interface ExportButtonProps {
    projectId: string;
    isMobile?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    projectId,
    isMobile = false
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [closing, setClosing] = React.useState(false);
    const isOpen = !closing && searchParams.get('export') === '1';

    const handleExportClick = () => {
        const sp = new URLSearchParams(searchParams);
        sp.set('export', '1');
        setSearchParams(sp);
    };

    const handleCloseModal = () => {
        // Optimistically close immediately; URL update will follow
        setClosing(true);
        // Clear URL params that auto-open the modal so it doesn't pop back up
        const sp = new URLSearchParams(searchParams);
        sp.delete('export');
        sp.delete('export-format');
        setSearchParams(sp);
    };

    // When URL no longer has export flag, allow reopening by clearing closing guard
    React.useEffect(() => {
        if (searchParams.get('export') !== '1') {
            setClosing(false);
        }
    }, [searchParams]);

    // Don't render anything if no projectId
    if (!projectId) {
        return null;
    }

    // On mobile, these actions live in the burger menu; avoid rendering inline buttons
    if (isMobile) {
        return (
            <>
                <ExportModal visible={isOpen} onClose={handleCloseModal} projectId={projectId} />
            </>
        );
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
                size={'middle'}
            >
                导出
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
                size={'middle'}
            >
                设置
            </Button>

            <ExportModal visible={isOpen} onClose={handleCloseModal} projectId={projectId} />
        </>
    );
}; 