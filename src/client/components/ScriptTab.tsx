import React, { useState, useEffect } from 'react';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import ChatPanel from './ChatPanel';
import CollaborativeEditor from './CollaborativeEditor';
import { Button } from 'antd';
import { MessageOutlined, CloseOutlined } from '@ant-design/icons';

const ScriptTab: React.FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [chatVisible, setChatVisible] = useState(false);
    const [roomId, setRoomId] = useState<string>('');

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setChatVisible(false); // Close pop-out chat if resizing to desktop
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Check URL for room ID parameter
        const urlParams = new URLSearchParams(window.location.search);
        let id = urlParams.get('room');

        // If no room ID in URL, use default or generate a new one
        if (!id) {
            id = 'default-script-room';

            // Update URL with the room ID for sharing
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('room', id);
            window.history.replaceState({}, '', newUrl.toString());
        }

        setRoomId(id);
    }, []);

    const toggleChat = () => {
        setChatVisible(!chatVisible);
    };

    // Don't render editor until we have a room ID
    if (!roomId) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                Loading script room...
            </div>
        );
    }

    return (
        <div className="script-tab-container">
            {isMobile ? (
                <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <Button
                        type="primary"
                        shape="circle"
                        icon={chatVisible ? <CloseOutlined /> : <MessageOutlined />}
                        onClick={toggleChat}
                        className="mobile-chat-toggle-button"
                        style={{
                            position: 'absolute',
                            bottom: chatVisible ? '50%' : '20px',
                            right: '20px',
                            zIndex: 1000,
                            transition: 'bottom 0.3s ease'
                        }}
                    />

                    <div
                        className="editor-main-area"
                        style={{
                            flex: chatVisible ? '0 0 50%' : 1,
                            transition: 'flex 0.3s ease',
                            overflow: 'hidden'
                        }}
                    >
                        <CollaborativeEditor roomId={roomId} />
                    </div>

                    <div
                        className="chat-panel-container"
                        style={{
                            flex: chatVisible ? '0 0 50%' : '0 0 0%',
                            overflow: 'hidden',
                            transition: 'flex 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            height: chatVisible ? '50%' : '0',
                            borderTop: chatVisible ? '1px solid #303030' : 'none'
                        }}
                    >
                        {chatVisible && <ChatPanel />}
                    </div>
                </div>
            ) : (
                <>
                    <ResizableBox
                        width={300} // 30% of typical 1000px width
                        height={Infinity} // This will be constrained by the parent flex container
                        minConstraints={[200, Infinity]}
                        maxConstraints={[500, Infinity]}
                        resizeHandles={['e']}
                        className="chat-panel-wrapper"
                        axis="x" // Ensure resizing is only horizontal
                        handle={<div className="custom-handle" style={{
                            width: '5px',
                            height: '100%',
                            background: '#303030',
                            cursor: 'col-resize',
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            zIndex: 1 // Ensure handle is above other content
                        }} />}
                    >
                        <ChatPanel />
                    </ResizableBox>
                    <div className="editor-main-area">
                        <CollaborativeEditor roomId={roomId} />
                    </div>
                </>
            )}
        </div>
    );
};

export default ScriptTab; 