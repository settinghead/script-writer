import * as Y from 'yjs';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join('yjs-data'); // Store data in project_root/yjs-data

interface Document {
    id: string;
    ydoc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
    saveTimeout: NodeJS.Timeout | null;
}

// In-memory document store (should be replaced with a database in production)
const documents = new Map<string, Document>();

// Ensure data directory exists
const ensureDataDir = async () => {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
};
ensureDataDir();

const getDocPath = (roomId: string) => path.join(DATA_DIR, `${roomId}.json`);

const loadDoc = async (roomId: string): Promise<Y.Doc> => {
    const ydoc = new Y.Doc();
    const docPath = getDocPath(roomId);
    try {
        const fileContent = await fs.readFile(docPath, 'utf-8');
        const data = JSON.parse(fileContent);
        if (data.docUpdate) {
            Y.applyUpdate(ydoc, new Uint8Array(data.docUpdate));
        }
        console.log(`Loaded YJS document for room: ${roomId}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`No persisted data found for room: ${roomId}. Creating new document.`);
        } else {
            console.error(`Error loading document for room ${roomId}:`, error);
        }
    }
    return ydoc;
};

const scheduleSave = (docEntry: Document) => {
    if (docEntry.saveTimeout) {
        clearTimeout(docEntry.saveTimeout);
    }
    docEntry.saveTimeout = setTimeout(async () => {
        const docPath = getDocPath(docEntry.id);
        try {
            const docUpdate = Y.encodeStateAsUpdate(docEntry.ydoc);
            const dataToSave = { docUpdate: Array.from(docUpdate) }; // Store as array of numbers
            await fs.writeFile(docPath, JSON.stringify(dataToSave, null, 2));
            console.log(`Saved YJS document for room: ${docEntry.id}`);
        } catch (error) {
            console.error(`Error saving document for room ${docEntry.id}:`, error);
        }
        docEntry.saveTimeout = null;
    }, 5000); // Save 5 seconds after the last change
};

// Custom implementation of YJS WebSocket connection handling
const setupWSConnection = (ws: WebSocket, req: any, { docName, gc = true }) => {
    const docEntry = documents.get(docName);
    if (!docEntry) {
        console.error(`Document entry not found for room: ${docName}`);
        ws.close();
        return;
    }
    const { ydoc, awareness } = docEntry;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'sync' && data.content?.type === 'update') {
                Y.applyUpdate(ydoc, new Uint8Array(data.content.update));
                scheduleSave(docEntry);
            } else if (data.type === 'awareness' && data.update) {
                awarenessProtocol.applyAwarenessUpdate(
                    awareness,
                    new Uint8Array(data.update),
                    ws // Origin of the update
                );
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    // Send initial sync when client connects
    const docUpdate = Y.encodeStateAsUpdate(ydoc);
    ws.send(JSON.stringify({
        type: 'sync',
        content: { type: 'update', update: Array.from(docUpdate) }
    }));

    // Send initial awareness state
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()));
    ws.send(JSON.stringify({ type: 'awareness', update: Array.from(awarenessUpdate) }));

    ws.on('close', () => {
        awarenessProtocol.removeAwarenessStates(awareness, [ydoc.clientID], ws);
        // Optional: Consider saving immediately on last client disconnect
        // if (awareness.getStates().size === 0) { ... scheduleSave now or save directly ... }
    });
};

export const setupYjsWebSocketServer = (httpServer: HttpServer) => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', async (ws, req, roomName) => {
        console.log(`New YJS connection for room: ${roomName}`);

        let docEntry = documents.get(roomName);
        if (!docEntry) {
            const ydoc = await loadDoc(roomName);
            const awareness = new awarenessProtocol.Awareness(ydoc);
            docEntry = { id: roomName, ydoc, awareness, saveTimeout: null };
            documents.set(roomName, docEntry);
            // Initial save if it's a new or empty document from file
            if (ydoc.getSubdocs().size === 0 && ydoc.share.size === 0) scheduleSave(docEntry);
        }

        setupWSConnection(ws, req, { docName: roomName, gc: true });
    });

    // Handle the upgrade
    httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const pathname = url.pathname;

        if (pathname.startsWith('/yjs')) {
            const roomName = pathname.slice(5); // Remove '/yjs/' prefix
            if (roomName) { // Ensure roomName is not empty
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws, request, roomName);
                });
            } else {
                socket.destroy();
            }
        }
    });

    return wss;
};

// Function to get the Y.Doc for a room
export const getYDoc = (roomId: string): Y.Doc | null => {
    const docEntry = documents.get(roomId);
    return docEntry ? docEntry.ydoc : null;
};

// Function to apply LLM-generated edits to a Y.Doc
export const applyEditsToYDoc = (
    roomId: string,
    edits: Array<{ position: number, insert?: string, delete?: number }>
): boolean => {
    const docEntry = documents.get(roomId);
    if (!docEntry) return false;

    const { ydoc } = docEntry;
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
    scheduleSave(docEntry); // Schedule save after LLM edits
    return true;
}; 