import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Space, Button } from 'antd';
import { NodeIndexOutlined, MessageOutlined, FileTextOutlined } from '@ant-design/icons';

interface DebugMenuProps {
    isMobile?: boolean;
    onMobileRightDrawerOpen?: () => void;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({
    isMobile = false,
    onMobileRightDrawerOpen
}) => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Debug toggles
    const showRawGraph = searchParams.get('raw-graph') === '1';
    const showRawChat = searchParams.get('raw-chat') === '1';
    const showRawContext = searchParams.get('raw-context') === '1';

    // Debug toggle handlers
    const toggleRawGraph = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showRawGraph) {
            newSearchParams.delete('raw-graph');
        } else {
            newSearchParams.set('raw-graph', '1');
            // Clear other debug views
            newSearchParams.delete('raw-chat');
            newSearchParams.delete('raw-context');
        }
        setSearchParams(newSearchParams);
    }, [showRawGraph, searchParams, setSearchParams]);

    const toggleRawChat = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showRawChat) {
            newSearchParams.delete('raw-chat');
        } else {
            newSearchParams.set('raw-chat', '1');
            // Clear other debug views
            newSearchParams.delete('raw-graph');
            newSearchParams.delete('raw-context');
        }
        setSearchParams(newSearchParams);
    }, [showRawChat, searchParams, setSearchParams]);

    const toggleRawContext = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showRawContext) {
            newSearchParams.delete('raw-context');
        } else {
            newSearchParams.set('raw-context', '1');
            // Clear other debug views
            newSearchParams.delete('raw-graph');
            newSearchParams.delete('raw-chat');
        }
        setSearchParams(newSearchParams);
    }, [showRawContext, searchParams, setSearchParams]);

    return (
        <Space size={isMobile ? 'small' : 'middle'}>
            {isMobile && onMobileRightDrawerOpen && (
                <Button
                    type="text"
                    icon={<NodeIndexOutlined />}
                    onClick={onMobileRightDrawerOpen}
                    style={{ color: '#1890ff' }}
                    size="small"
                />
            )}
            <Button
                type="text"
                icon={<NodeIndexOutlined />}
                onClick={toggleRawGraph}
                style={{ color: showRawGraph ? '#52c41a' : '#1890ff' }}
                size={isMobile ? 'small' : 'middle'}
            >
                {isMobile ? '' : (showRawGraph ? '关闭图谱' : '打开图谱')}
            </Button>

            <Button
                type="text"
                icon={<FileTextOutlined />}
                onClick={toggleRawContext}
                style={{ color: showRawContext ? '#52c41a' : '#1890ff' }}
                size={isMobile ? 'small' : 'middle'}
            >
                {isMobile ? '' : (showRawContext ? '关闭上下文' : '打开上下文')}
            </Button>
            <Button
                type="text"
                icon={<MessageOutlined />}
                onClick={toggleRawChat}
                style={{ color: showRawChat ? '#52c41a' : '#1890ff' }}
                size={isMobile ? 'small' : 'middle'}
            >
                {isMobile ? '' : (showRawChat ? '关闭内部对话' : '打开内部对话')}
            </Button>
        </Space>
    );
};

// Hook to get debug state
export const useDebugState = () => {
    const [searchParams] = useSearchParams();

    return {
        showRawGraph: searchParams.get('raw-graph') === '1',
        showRawChat: searchParams.get('raw-chat') === '1',
        showRawContext: searchParams.get('raw-context') === '1',
        isDebugMode: searchParams.get('raw-graph') === '1' ||
            searchParams.get('raw-chat') === '1' ||
            searchParams.get('raw-context') === '1'
    };
}; 