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

    const toggleChat = () => {
        setChatVisible(!chatVisible);
    };

    return (
        <div className="script-tab-container">
            {isMobile ? (
                <>
                    <Button
                        type="primary"
                        shape="circle"
                        icon={chatVisible ? <CloseOutlined /> : <MessageOutlined />}
                        onClick={toggleChat}
                        className="mobile-chat-toggle-button"
                    />
                    <div className={`chat-panel-wrapper ${chatVisible ? 'visible' : ''}`}>
                        <ChatPanel />
                    </div>
                    <div className="editor-main-area">
                        <CollaborativeEditor roomId="default-script-room" />
                    </div>
                </>
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
                        <CollaborativeEditor roomId="default-script-room" />
                    </div>
                </>
            )}
        </div>
    );
};

export default ScriptTab; 