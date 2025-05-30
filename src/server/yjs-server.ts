import * as Y from 'yjs';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseCookie } from 'cookie';
import * as jwt from 'jsonwebtoken';
import { AuthDatabase } from './database/auth';

const DOC_STORAGE_PATH = path.join('data', 'yjs-docs');
fs.mkdirSync(DOC_STORAGE_PATH, { recursive: true });

interface DocumentDetail {
    id: string;
    ydoc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
    saveTimeout?: NodeJS.Timeout;
    updateListener?: () => void;
}

// In-memory document store
const documents = new Map<string, DocumentDetail>();
const SAVE_DEBOUNCE_TIME = 5000; // 5 seconds

const getDocumentFilePath = (roomId: string): string => {
    return path.join(DOC_STORAGE_PATH, `${roomId}.json`);
};

const loadDocument = (roomId: string): Y.Doc => {
    const filePath = getDocumentFilePath(roomId);
    const ydoc = new Y.Doc();

    // Initialize with default empty document structure for 'slate'
    ydoc.getArray('slate');

    // Try to load from disk if exists
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            if (data && data.docUpdate) {
                Y.applyUpdate(ydoc, new Uint8Array(data.docUpdate));
                console.log(`Loaded YJS document for room: ${roomId} from ${filePath}`);
            } else {
                console.log(`Document found for room ${roomId} but no updates to apply.`);
            }
        } catch (error) {
            console.error(`Error loading document for room ${roomId}:`, error);
        }
    } else {
        console.log(`No saved document for room ${roomId}. Creating new.`);
    }

    return ydoc;
};

const saveDocument = (roomId: string, ydoc: Y.Doc) => {
    const filePath = getDocumentFilePath(roomId);
    try {
        const docUpdate = Y.encodeStateAsUpdate(ydoc);
        const dataToSave = { docUpdate: Array.from(docUpdate) }; // Store as array for JSON compatibility
        fs.writeFileSync(filePath, JSON.stringify(dataToSave), 'utf-8');
        console.log(`Saved YJS document for room: ${roomId} to ${filePath}`);
    } catch (error) {
        console.error(`Error saving document for room ${roomId}:`, error);
    }
};

const scheduleSave = (roomId: string) => {
    const docDetail = documents.get(roomId);
    if (!docDetail) return;

    if (docDetail.saveTimeout) {
        clearTimeout(docDetail.saveTimeout);
    }

    docDetail.saveTimeout = setTimeout(() => {
        saveDocument(roomId, docDetail.ydoc);
    }, SAVE_DEBOUNCE_TIME);
};

const setupWSConnection = (ws: WebSocket, req: any, roomName: string) => {
    const docDetail = documents.get(roomName);
    if (!docDetail) {
        console.error(`Document detail not found for room: ${roomName} in setupWSConnection`);
        ws.close();
        return;
    }

    const { ydoc, awareness } = docDetail;

    ws.on('message', (messageData: Buffer | string) => {
        try {
            const message = typeof messageData === 'string' ? messageData : messageData.toString();
            const data = JSON.parse(message);
            if (data.type === 'sync' && data.content?.type === 'update') {
                Y.applyUpdate(ydoc, new Uint8Array(data.content.update), 'websocket');
            } else if (data.type === 'awareness' && data.update) {
                awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(data.update), ws);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error, messageData);
        }
    });

    const sendSyncMessage = (doc: Y.Doc) => {
        const update = Y.encodeStateAsUpdate(doc);
        ws.send(JSON.stringify({ type: 'sync', content: { type: 'update', update: Array.from(update) } }));
    };

    const sendAwarenessUpdate = () => {
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()));
        ws.send(JSON.stringify({ type: 'awareness', update: Array.from(update) }));
    };

    // Send initial sync and awareness state
    sendSyncMessage(ydoc);
    sendAwarenessUpdate();

    // Broadcast awareness changes
    const awarenessUpdateHandler = (changes: any, origin: any) => {
        if (origin !== ws) { // Don't send back to the originator
            sendAwarenessUpdate();
        }
    };
    awareness.on('update', awarenessUpdateHandler);

    ws.on('close', () => {
        awareness.off('update', awarenessUpdateHandler);
        awarenessProtocol.removeAwarenessStates(awareness, [ydoc.clientID], 'websocket');
        console.log(`Connection closed for room: ${roomName}, clientID: ${ydoc.clientID}`);
        // If no more connections, clear save timeout and potentially save one last time
        const roomConnections = wssConnections.get(roomName);
        if (roomConnections) {
            roomConnections.delete(ws);
            if (roomConnections.size === 0) {
                console.log(`Last client disconnected from room: ${roomName}. Final save scheduled.`);
                if (docDetail.saveTimeout) clearTimeout(docDetail.saveTimeout);
                saveDocument(roomName, ydoc); // Save immediately on last disconnect
                if (docDetail.updateListener) ydoc.off('update', docDetail.updateListener);
                // Optionally remove from memory if no connections and saved:
                // documents.delete(roomName);
            }
        }
    });
};

const wssConnections = new Map<string, Set<WebSocket>>(); // Track connections per room

interface AuthenticatedRequest {
    user?: { id: string; username: string; display_name: string };
}

const authenticateWebSocketUser = async (req: any, authDB: AuthDatabase): Promise<{ id: string; username: string; display_name: string } | null> => {
    try {
        const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
        const token = cookies.auth_token;

        if (!token) {
            console.log('No auth token in WebSocket cookies');
            return null;
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error('JWT_SECRET not configured');
            return null;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const sessionId = decoded.jti;

        if (!sessionId) {
            console.log('No session ID in JWT token');
            return null;
        }

        // Verify session is still valid
        const session = await authDB.getSession(sessionId);
        if (!session) {
            console.log('Session not found or expired');
            return null;
        }

        // Get user data
        const user = await authDB.getUserById(session.user_id);
        if (!user) {
            console.log('User not found for session');
            return null;
        }

        return {
            id: user.id,
            username: user.username,
            display_name: user.display_name || user.username
        };
    } catch (error) {
        console.error('Error authenticating WebSocket user:', error);
        return null;
    }
};

const verifyUserCanAccessRoom = async (roomId: string, userId: string, authDB: AuthDatabase): Promise<boolean> => {
    return await authDB.canUserAccessRoom(roomId, userId);
};

export const setupYjsWebSocketServer = (httpServer: HttpServer, authDB: AuthDatabase) => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', async (ws, req) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const roomName = url.searchParams.get('room'); // Assuming room is passed as a query param e.g., /yjs?room=myRoom

        if (!roomName) {
            console.error('Room name not provided in WebSocket connection');
            ws.close();
            return;
        }

        // Authenticate the user
        const user = await authenticateWebSocketUser(req, authDB);
        if (!user) {
            console.error(`Unauthenticated WebSocket connection attempt for room: ${roomName}`);
            ws.close();
            return;
        }

        // Verify user can access this room
        const canAccess = await verifyUserCanAccessRoom(roomName, user.id, authDB);
        if (!canAccess) {
            console.error(`User ${user.username} attempted to access unauthorized room: ${roomName}`);
            ws.close();
            return;
        }

        console.log(`Authenticated YJS connection for user ${user.username} to room: ${roomName}`);

        let docDetail = documents.get(roomName);

        if (!docDetail) {
            console.log(`No existing document in memory for room ${roomName}. Loading from disk or creating new.`);
            const ydoc = loadDocument(roomName); // Load from disk or get new Y.Doc
            const awareness = new awarenessProtocol.Awareness(ydoc);
            const updateListener = () => scheduleSave(roomName);
            ydoc.on('update', updateListener);
            docDetail = { id: roomName, ydoc, awareness, updateListener };
            documents.set(roomName, docDetail);
        } else {
            console.log(`Using existing document in memory for room: ${roomName}`);
        }

        // Track connection
        if (!wssConnections.has(roomName)) {
            wssConnections.set(roomName, new Set());
        }
        wssConnections.get(roomName)!.add(ws);

        setupWSConnection(ws, req, roomName);
    });

    httpServer.on('upgrade', (request, socket, head) => {
        // Only handle upgrades to the /yjs path
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const pathname = url.pathname;

        if (pathname === '/yjs') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                // We already extract the room name in the connection handler,
                // so we can just pass the request as is
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
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