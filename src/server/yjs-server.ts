import * as Y from 'yjs';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';

interface Document {
    id: string;
    ydoc: Y.Doc;
}

// In-memory document store (should be replaced with a database in production)
const documents = new Map<string, Document>();

// Custom implementation of YJS WebSocket connection handling
const setupWSConnection = (ws: WebSocket, req: any, { docName, gc = true }) => {
    const doc = documents.get(docName)?.ydoc;
    if (!doc) {
        console.error(`Document not found for room: ${docName}`);
        ws.close();
        return;
    }

    // Create awareness instance
    const awareness = new awarenessProtocol.Awareness(doc);

    // Handle WebSocket messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'sync') {
                // Process sync message
                const content = data.content;
                if (content && content.type === 'update') {
                    // Apply updates to the document
                    Y.applyUpdate(doc, new Uint8Array(content.update));
                }
            } else if (data.type === 'awareness') {
                // Process awareness update
                awarenessProtocol.applyAwarenessUpdate(
                    awareness,
                    new Uint8Array(data.update),
                    data.client
                );
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    // Send initial sync when client connects
    const initialSync = Y.encodeStateAsUpdate(doc);
    ws.send(JSON.stringify({
        type: 'sync',
        content: {
            type: 'update',
            update: Array.from(initialSync)
        }
    }));

    // Handle disconnect
    ws.on('close', () => {
        awareness.destroy();
    });
};

export const setupYjsWebSocketServer = (httpServer: HttpServer) => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req, roomName) => {
        console.log(`New YJS connection for room: ${roomName}`);

        // Create or get the document for this room
        if (!documents.has(roomName)) {
            console.log(`Creating new YJS document for room: ${roomName}`);
            const ydoc = new Y.Doc();
            documents.set(roomName, { id: roomName, ydoc });
        }

        // Set up Y.js WebSocket connection
        setupWSConnection(ws, req, {
            docName: roomName,
            gc: true
        });
    });

    // Handle the upgrade
    httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const pathname = url.pathname;

        if (pathname.startsWith('/yjs')) {
            const roomName = pathname.slice(5); // Remove '/yjs/' prefix

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request, roomName);
            });
        }
    });

    return wss;
};

// Function to get the Y.Doc for a room
export const getYDoc = (roomId: string): Y.Doc | null => {
    const document = documents.get(roomId);
    return document ? document.ydoc : null;
};

// Function to apply LLM-generated edits to a Y.Doc
export const applyEditsToYDoc = (
    roomId: string,
    edits: Array<{ position: number, insert?: string, delete?: number }>
): boolean => {
    const document = documents.get(roomId);
    if (!document) return false;

    const { ydoc } = document;
    const ytext = ydoc.getText('content');

    // Apply the edits as a single transaction
    ydoc.transact(() => {
        // Sort edits in reverse order to avoid position shifts
        const sortedEdits = [...edits].sort((a, b) => b.position - a.position);

        for (const edit of sortedEdits) {
            if (edit.delete && edit.delete > 0) {
                ytext.delete(edit.position, edit.delete);
            }
            if (edit.insert) {
                ytext.insert(edit.position, edit.insert);
            }
        }
    });

    return true;
}; 