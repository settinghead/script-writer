import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Space, Button } from 'antd';
import { NodeIndexOutlined, MessageOutlined, FileTextOutlined, ToolOutlined, SearchOutlined } from '@ant-design/icons';

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
    const showParticleDebug = searchParams.get('particle-debug') === '1';
    const showAgentContext = searchParams.get('agent-context') === '1';

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
            newSearchParams.delete('agent-context');
            newSearchParams.delete('particle-debug');
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
            newSearchParams.delete('agent-context');
            newSearchParams.delete('particle-debug');
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
            newSearchParams.delete('agent-context');
            newSearchParams.delete('particle-debug');
        }
        setSearchParams(newSearchParams);
    }, [showRawContext, searchParams, setSearchParams]);

    const toggleAgentContext = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showAgentContext) {
            newSearchParams.delete('agent-context');
        } else {
            newSearchParams.set('agent-context', '1');
            // Clear other debug views
            newSearchParams.delete('raw-graph');
            newSearchParams.delete('raw-chat');
            newSearchParams.delete('raw-context');
            newSearchParams.delete('particle-debug');
        }
        setSearchParams(newSearchParams);
    }, [showAgentContext, searchParams, setSearchParams]);

    const toggleParticleDebug = useCallback(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (showParticleDebug) {
            newSearchParams.delete('particle-debug');
        } else {
            newSearchParams.set('particle-debug', '1');
            // Clear other debug views
            newSearchParams.delete('raw-graph');
            newSearchParams.delete('raw-chat');
            newSearchParams.delete('raw-context');
            newSearchParams.delete('agent-context');
        }
        setSearchParams(newSearchParams);
    }, [showParticleDebug, searchParams, setSearchParams]);

    // On mobile, hide the toolbar icons entirely (we'll expose these in burger menu)
    if (isMobile) {
        return (
            <Space size={'small'}>
                {onMobileRightDrawerOpen && (
                    <Button
                        type="text"
                        icon={<NodeIndexOutlined />}
                        onClick={onMobileRightDrawerOpen}
                        style={{ color: '#1890ff' }}
                        size="small"
                    />
                )}
            </Space>
        );
    }

    return (
        <Space size={'middle'}>
            <Button
                type="text"
                icon={<NodeIndexOutlined />}
                onClick={toggleRawGraph}
                style={{ color: showRawGraph ? '#52c41a' : '#1890ff' }}
            >
                {showRawGraph ? '关闭图谱' : '打开图谱'}
            </Button>

            <Button
                type="text"
                icon={<ToolOutlined />}
                onClick={toggleAgentContext}
                style={{ color: showAgentContext ? '#52c41a' : '#1890ff' }}
            >
                {showAgentContext ? '关闭Agent上下文' : 'Agent上下文'}
            </Button>
            <Button
                type="text"
                icon={<FileTextOutlined />}
                onClick={toggleRawContext}
                style={{ color: showRawContext ? '#52c41a' : '#1890ff' }}
            >
                {showRawContext ? '关闭工具调用' : '工具调用'}
            </Button>
            <Button
                type="text"
                icon={<MessageOutlined />}
                onClick={toggleRawChat}
                style={{ color: showRawChat ? '#52c41a' : '#1890ff' }}
            >
                {showRawChat ? '关闭内部对话' : '打开内部对话'}
            </Button>


            <Button
                type="text"
                icon={<SearchOutlined />}
                onClick={toggleParticleDebug}
                style={{ color: showParticleDebug ? '#52c41a' : '#1890ff' }}
            >
                {showParticleDebug ? '关闭粒子搜索' : '粒子搜索'}
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
        showAgentContext: searchParams.get('agent-context') === '1',
        showParticleDebug: searchParams.get('particle-debug') === '1',
        isDebugMode: searchParams.get('raw-graph') === '1' ||
            searchParams.get('raw-chat') === '1' ||
            searchParams.get('raw-context') === '1' ||
            searchParams.get('agent-context') === '1' ||
            searchParams.get('particle-debug') === '1'
    };
}; 