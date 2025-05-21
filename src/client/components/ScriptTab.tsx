import React, { useState, useEffect } from 'react';
import { ResizableBox } from 'react-resizable';
import { Button, Drawer } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import 'react-resizable/css/styles.css';
import ChatPanel from './ChatPanel';
import CollaborativeEditor from './CollaborativeEditor';

const ScriptTab: React.FC = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [chatVisible, setChatVisible] = useState(false);

    // Check if we're on mobile based on screen width
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // Initial check
        checkMobile();

        // Add listener for window resize
        window.addEventListener('resize', checkMobile);

        // Clean up
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // For mobile: we use a drawer for the chat
    if (isMobile) {
        return (
            <div style={{
                width: '100%',
                height: 'calc(100vh - 64px)', // Header height
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
            }}>
                <Button
                    type="primary"
                    icon={<MenuUnfoldOutlined />}
                    onClick={() => setChatVisible(true)}
                    style={{
                        position: 'absolute',
                        left: 16,
                        top: 16,
                        zIndex: 10
                    }}
                />

                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                    <CollaborativeEditor roomId="default-script-room" />
                </div>

                <Drawer
                    title="对话"
                    placement="left"
                    onClose={() => setChatVisible(false)}
                    open={chatVisible}
                    width="80%"
                    bodyStyle={{ padding: 0, height: '100%' }}
                >
                    <ChatPanel />
                </Drawer>
            </div>
        );
    }

    // For desktop: we use a resizable split layout
    return (
        <div style={{
            display: 'flex',
            width: '100%',
            height: 'calc(100vh - 64px)', // Header height
            overflow: 'hidden'
        }}>
            <ResizableBox
                width={300} // 30% of typical 1000px width
                height={Infinity}
                minConstraints={[200, Infinity]}
                maxConstraints={[500, Infinity]}
                resizeHandles={['e']}
                className="chat-panel-wrapper"
                handle={<div className="custom-handle" style={{
                    width: '5px',
                    height: '100%',
                    background: '#303030',
                    cursor: 'col-resize',
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    zIndex: 10
                }} />}
                axis="x"
            >
                <div style={{ height: '100%', overflow: 'hidden' }}>
                    <ChatPanel />
                </div>
            </ResizableBox>
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <CollaborativeEditor roomId="default-script-room" />
            </div>
        </div>
    );
};

export default ScriptTab; 