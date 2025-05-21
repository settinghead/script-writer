import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createEditor, Editor, Transforms } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { withYjs, YjsEditor, withCursors } from '@slate-yjs/core';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import EditorToolbar from './EditorToolbar';
import { Cursors } from './Cursors';
import { Element, Leaf } from './ScriptElements';
import '../cursor-styles.css';

// Initial value for the editor
const initialValue = [{ type: 'paragraph', children: [{ text: '' }] }];

interface CollaborativeEditorProps {
    roomId: string;
}

// Custom WebSocket provider since we're not using y-websocket's provider
class CustomWebsocketProvider {
    awareness: awarenessProtocol.Awareness;
    ws: WebSocket | null = null;
    connected = false;
    doc: Y.Doc;
    roomId: string;
    onStatusChange: (status: { status: string }) => void;

    constructor(url: string, roomId: string, doc: Y.Doc, onStatusChange: (status: { status: string }) => void) {
        this.doc = doc;
        this.roomId = roomId;
        this.awareness = new awarenessProtocol.Awareness(doc);
        this.onStatusChange = onStatusChange;
        this.connect(url);
    }

    connect(url: string) {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.connected = true;
            this.onStatusChange({ status: 'connected' });
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.connected = false;
            this.onStatusChange({ status: 'disconnected' });
            // Try to reconnect after a delay
            setTimeout(() => {
                this.connect(url);
            }, 3000);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'sync' && data.content?.type === 'update') {
                    Y.applyUpdate(this.doc, new Uint8Array(data.content.update));
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        // Listen for document updates and send them to the server
        this.doc.on('update', (update: Uint8Array) => {
            if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'sync',
                    content: {
                        type: 'update',
                        update: Array.from(update)
                    }
                }));
            }
        });

        // Listen for awareness updates and broadcast them
        this.awareness.on('update', ({ added, updated, removed }) => {
            const changedClients = added.concat(updated).concat(removed);
            if (changedClients.length > 0 && this.connected && this.ws?.readyState === WebSocket.OPEN) {
                const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
                this.ws.send(JSON.stringify({
                    type: 'awareness',
                    update: Array.from(awarenessUpdate),
                    client: this.doc.clientID
                }));
            }
        });
    }

    destroy() {
        this.awareness.destroy();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    off(event: string, callback: any) {
        // No-op for compatibility
    }
}

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({ roomId }) => {
    const [connected, setConnected] = useState(false);
    const [sharedType, setSharedType] = useState<Y.XmlText | null>(null);
    const [provider, setProvider] = useState<CustomWebsocketProvider | null>(null);

    // Set up Yjs document and provider
    useEffect(() => {
        const yDoc = new Y.Doc();
        const sharedDoc = yDoc.get('slate', Y.XmlText);

        // Custom status change handler
        const handleStatusChange = (event: { status: string }) => {
            console.log('Connection status:', event.status);
            if (event.status === 'connected') {
                setConnected(true);
            } else {
                setConnected(false);
            }
        };

        // Connect to WebSocket provider
        const wsProvider = new CustomWebsocketProvider(
            `ws://${window.location.host}/yjs/${roomId}`,
            roomId,
            yDoc,
            handleStatusChange
        );

        setSharedType(sharedDoc);
        setProvider(wsProvider);

        return () => {
            yDoc?.destroy();
            wsProvider?.destroy();
        };
    }, [roomId]);

    if (!connected || !sharedType || !provider) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                正在连接协作会话...
            </div>
        );
    }

    return <SlateEditor sharedType={sharedType} provider={provider} />;
};

interface SlateEditorProps {
    sharedType: Y.XmlText;
    provider: CustomWebsocketProvider;
}

const SlateEditor: React.FC<SlateEditorProps> = ({ sharedType, provider }) => {
    // Create and configure the editor
    const editor = useMemo(() => {
        // Create Slate editor with history, React, and Yjs integrations
        const slateEditor = withReact(
            withCursors(
                withYjs(
                    withHistory(createEditor()),
                    sharedType
                ),
                provider.awareness,
                {
                    // Current user's cursor data
                    data: {
                        name: '你',
                        color: '#1890ff',
                    },
                }
            )
        );

        // Ensure editor always has at least 1 valid child
        const { normalizeNode } = slateEditor;
        slateEditor.normalizeNode = entry => {
            const [node] = entry;

            if (!Editor.isEditor(node) || node.children.length > 0) {
                return normalizeNode(entry);
            }

            Transforms.insertNodes(slateEditor, initialValue, { at: [0] });
        };

        return slateEditor;
    }, [sharedType, provider]);

    // Connect/disconnect editor when component mounts/unmounts
    useEffect(() => {
        YjsEditor.connect(editor);
        return () => YjsEditor.disconnect(editor);
    }, [editor]);

    // We need an onChange handler even if we don't use it directly
    const onChange = useCallback(newValue => {
        // This function body can be empty since YJS handles the updates
        // But we need the function to satisfy Slate's API
    }, []);

    // Custom rendering functions
    const renderElement = useCallback(props => <Element {...props} />, []);
    const renderLeaf = useCallback(props => <Leaf {...props} />, []);

    return (
        <div className="slate-editor-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <EditorToolbar editor={editor} />
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
                    <Cursors>
                        <Editable
                            className="editor-content"
                            renderElement={renderElement}
                            renderLeaf={renderLeaf}
                            style={{ minHeight: '100%' }}
                            placeholder="开始编写剧本..."
                        />
                    </Cursors>
                </Slate>
            </div>
        </div>
    );
};

export default CollaborativeEditor; 