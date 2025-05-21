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

    constructor(roomId: string, doc: Y.Doc, onStatusChange: (status: { status: string }) => void) {
        this.doc = doc;
        this.roomId = roomId || 'default-script-room'; // Fallback if no roomId provided
        this.awareness = new awarenessProtocol.Awareness(doc);
        this.onStatusChange = onStatusChange;
        // Construct URL with room as a query parameter, targeting the current host (Vite dev server)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/yjs?room=${encodeURIComponent(this.roomId)}`;
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
        // Remove event listeners to prevent memory leaks
        if (this.doc) {
            this.doc.off('update', null);
        }

        // Clean up the awareness
        if (this.awareness) {
            this.awareness.off('update', null);
            this.awareness.destroy();
        }

        // Close the websocket connection
        if (this.ws) {
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }

        this.connected = false;
    }

    off(event: string, callback: any) {
        // No-op for compatibility
    }
}

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({ roomId }) => {
    const [connected, setConnected] = useState(false);
    const [sharedType, setSharedType] = useState<Y.XmlText | null>(null);
    const [provider, setProvider] = useState<CustomWebsocketProvider | null>(null);
    const [initialSyncComplete, setInitialSyncComplete] = useState(false);

    // Set up Yjs document and provider
    useEffect(() => {
        console.log(`Creating YJS doc for room: ${roomId}`);
        const yDoc = new Y.Doc();
        // Get the shared XmlText from the YDoc
        const sharedDoc = yDoc.get('slate', Y.XmlText);

        const handleStatusChange = (event: { status: string }) => {
            console.log('YJS Connection status:', event.status);
            if (event.status === 'connected') {
                setConnected(true);
                // When connected, mark sync as complete after a small delay
                // to allow initial data to load
                setTimeout(() => {
                    setInitialSyncComplete(true);
                }, 500);
            } else {
                setConnected(false);
            }
        };

        // Connect to WebSocket provider
        const wsProvider = new CustomWebsocketProvider(
            roomId,
            yDoc,
            handleStatusChange
        );

        setSharedType(sharedDoc);
        setProvider(wsProvider);

        return () => {
            console.log(`Cleaning up YJS resources for room: ${roomId}`);
            yDoc?.destroy();
            wsProvider?.destroy();
            setInitialSyncComplete(false);
        };
    }, [roomId]);

    if (!connected || !sharedType || !provider || !initialSyncComplete) {
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
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [editorValue, setEditorValue] = useState(initialValue);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

        // Only add normalizeNode handler to ensure editor has content
        // but NOT to add extra paragraphs on each load
        const { normalizeNode } = slateEditor;
        slateEditor.normalizeNode = entry => {
            const [node] = entry;

            // Only add initialValue if the editor is completely empty
            if (Editor.isEditor(node) && node.children.length === 0) {
                Transforms.insertNodes(slateEditor, initialValue, { at: [0] });
                return;
            }

            return normalizeNode(entry);
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
        // Store the value for initializing Slate (though YJS will override this)
        setEditorValue(newValue);
    }, []);

    // Custom rendering functions
    const renderElement = useCallback(props => <Element {...props} />, []);
    const renderLeaf = useCallback(props => <Leaf {...props} />, []);

    return (
        <div className="slate-editor-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!isMobile && <EditorToolbar editor={editor} />}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                <Slate editor={editor} initialValue={editorValue} onChange={onChange}>
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