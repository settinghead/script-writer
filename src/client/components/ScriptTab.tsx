import React from 'react';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import ChatPanel from './ChatPanel';
import CollaborativeEditor from './CollaborativeEditor';

const ScriptTab: React.FC = () => {
    return (
        <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 100px)' }}>
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
                    top: 0
                }} />}
            >
                <ChatPanel />
            </ResizableBox>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <CollaborativeEditor roomId="default-script-room" />
            </div>
        </div>
    );
};

export default ScriptTab; 