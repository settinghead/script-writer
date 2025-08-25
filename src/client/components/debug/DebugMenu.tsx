import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Space, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { NodeIndexOutlined, MessageOutlined, FileTextOutlined, ToolOutlined, SearchOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

interface DebugMenuProps {
    isMobile?: boolean;
    onMobileRightDrawerOpen?: () => void;
    onHideDebug?: () => void;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({
    isMobile = false,
    onMobileRightDrawerOpen,
    onHideDebug
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

    const items: MenuProps['items'] = [
        {
            key: 'raw-graph',
            label: showRawGraph ? '关闭图谱' : '打开图谱',
            icon: <NodeIndexOutlined />,
        },
        {
            key: 'agent-context',
            label: showAgentContext ? '关闭Agent上下文' : 'Agent上下文',
            icon: <ToolOutlined />,
        },
        {
            key: 'raw-context',
            label: showRawContext ? '关闭工具调用' : '工具调用',
            icon: <FileTextOutlined />,
        },
        {
            key: 'raw-chat',
            label: showRawChat ? '关闭内部对话' : '打开内部对话',
            icon: <MessageOutlined />,
        },
        {
            key: 'particle-debug',
            label: showParticleDebug ? '关闭粒子搜索' : '粒子搜索',
            icon: <SearchOutlined />,
        },
        { type: 'divider' },
        {
            key: 'hide',
            label: '隐藏调试工具',
            icon: <EyeInvisibleOutlined />,
            danger: true
        }
    ];

    const onMenuClick: MenuProps['onClick'] = ({ key }) => {
        switch (key) {
            case 'raw-graph':
                toggleRawGraph();
                break;
            case 'agent-context':
                toggleAgentContext();
                break;
            case 'raw-context':
                toggleRawContext();
                break;
            case 'raw-chat':
                toggleRawChat();
                break;
            case 'particle-debug':
                toggleParticleDebug();
                break;
            case 'hide':
                onHideDebug?.();
                break;
            default:
                break;
        }
    };

    return (
        <Space size={'middle'}>
            <Dropdown menu={{ items, onClick: onMenuClick }} trigger={["click"]}>
                <Button type="text" icon={<ToolOutlined />} style={{ color: '#1890ff' }}>
                    调试
                </Button>
            </Dropdown>
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