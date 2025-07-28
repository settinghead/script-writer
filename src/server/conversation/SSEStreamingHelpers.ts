import { Response } from 'express';
import { ConversationId, MessageId } from './ConversationManager.js';

// SSE event types for conversation streaming
export type SSEEventType =
    | 'conversation_started'    // New conversation initiated
    | 'message_chunk'          // Streaming message content chunk
    | 'message_complete'       // Message streaming completed
    | 'tool_call_start'        // Tool call initiated
    | 'tool_call_result'       // Tool call completed
    | 'cache_hit'              // Cache hit detected
    | 'error'                  // Error occurred
    | 'conversation_end'       // Conversation ended
    | 'heartbeat';             // Keep-alive ping

// SSE event data structure
export interface SSEEvent {
    type: SSEEventType;
    data: any;
    id?: string;
    retry?: number;
}

// Conversation-specific SSE event data types
export interface ConversationStartedData {
    conversationId: ConversationId;
    projectId: string;
    timestamp: string;
}

export interface MessageChunkData {
    conversationId: ConversationId;
    messageId: MessageId;
    chunk: string;
    chunkIndex: number;
    timestamp: string;
}

export interface MessageCompleteData {
    conversationId: ConversationId;
    messageId: MessageId;
    finalContent: string;
    wordCount: number;
    timestamp: string;
}

export interface ToolCallData {
    conversationId: ConversationId;
    toolName: string;
    toolCallId: string;
    parameters?: any;
    result?: any;
    timestamp: string;
}

export interface CacheHitData {
    conversationId: ConversationId;
    contentHash: string;
    cachedTokens: number;
    timestamp: string;
}

export interface ConversationErrorData {
    conversationId: ConversationId;
    error: string;
    errorType: string;
    timestamp: string;
}

// SSE connection management
export interface SSEConnection {
    conversationId: ConversationId;
    response: Response;
    isActive: boolean;
    lastHeartbeat: Date;
    clientId: string;
}

// Active SSE connections registry
const activeConnections = new Map<string, SSEConnection>();

/**
 * Initialize SSE connection for conversation streaming
 */
export function initializeSSEConnection(
    conversationId: ConversationId,
    response: Response,
    clientId?: string
): SSEConnection {
    const connectionId = clientId || `${conversationId}_${Date.now()}`;

    // Set SSE headers
    response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const connection: SSEConnection = {
        conversationId,
        response,
        isActive: true,
        lastHeartbeat: new Date(),
        clientId: connectionId
    };

    // Register connection
    activeConnections.set(connectionId, connection);

    // Send initial connection event
    sendSSEEvent(connection, {
        type: 'conversation_started',
        data: {
            conversationId,
            timestamp: new Date().toISOString()
        } as ConversationStartedData,
        id: `start_${Date.now()}`
    });

    // Handle client disconnect
    response.on('close', () => {
        connection.isActive = false;
        activeConnections.delete(connectionId);
        console.log(`[SSE] Client disconnected: ${connectionId}`);
    });

    console.log(`[SSE] Connection initialized: ${connectionId} for conversation ${conversationId}`);
    return connection;
}

/**
 * Send SSE event to a specific connection
 */
export function sendSSEEvent(connection: SSEConnection, event: SSEEvent): boolean {
    if (!connection.isActive) {
        return false;
    }

    try {
        const eventString = formatSSEEvent(event);
        connection.response.write(eventString);
        return true;
    } catch (error) {
        console.error(`[SSE] Failed to send event:`, error);
        connection.isActive = false;
        return false;
    }
}

/**
 * Send SSE event to all connections for a conversation
 */
export function broadcastToConversation(conversationId: ConversationId, event: SSEEvent): number {
    let sentCount = 0;

    for (const connection of activeConnections.values()) {
        if (connection.conversationId === conversationId && connection.isActive) {
            if (sendSSEEvent(connection, event)) {
                sentCount++;
            }
        }
    }

    return sentCount;
}

/**
 * Send message chunk via SSE
 */
export function streamMessageChunk(
    conversationId: ConversationId,
    messageId: MessageId,
    chunk: string,
    chunkIndex: number
): number {
    return broadcastToConversation(conversationId, {
        type: 'message_chunk',
        data: {
            conversationId,
            messageId,
            chunk,
            chunkIndex,
            timestamp: new Date().toISOString()
        } as MessageChunkData,
        id: `chunk_${messageId}_${chunkIndex}`
    });
}

/**
 * Send message completion via SSE
 */
export function streamMessageComplete(
    conversationId: ConversationId,
    messageId: MessageId,
    finalContent: string
): number {
    return broadcastToConversation(conversationId, {
        type: 'message_complete',
        data: {
            conversationId,
            messageId,
            finalContent,
            wordCount: finalContent.split(/\s+/).length,
            timestamp: new Date().toISOString()
        } as MessageCompleteData,
        id: `complete_${messageId}`
    });
}

/**
 * Send tool call events via SSE
 */
export function streamToolCall(
    conversationId: ConversationId,
    toolName: string,
    toolCallId: string,
    parameters?: any,
    result?: any
): number {
    const eventType = result ? 'tool_call_result' : 'tool_call_start';

    return broadcastToConversation(conversationId, {
        type: eventType,
        data: {
            conversationId,
            toolName,
            toolCallId,
            parameters,
            result,
            timestamp: new Date().toISOString()
        } as ToolCallData,
        id: `tool_${toolCallId}_${Date.now()}`
    });
}

/**
 * Send cache hit notification via SSE
 */
export function streamCacheHit(
    conversationId: ConversationId,
    contentHash: string,
    cachedTokens: number
): number {
    return broadcastToConversation(conversationId, {
        type: 'cache_hit',
        data: {
            conversationId,
            contentHash: contentHash.substring(0, 8) + '...',
            cachedTokens,
            timestamp: new Date().toISOString()
        } as CacheHitData,
        id: `cache_${Date.now()}`
    });
}

/**
 * Send error via SSE
 */
export function streamError(
    conversationId: ConversationId,
    error: string,
    errorType: string = 'unknown'
): number {
    return broadcastToConversation(conversationId, {
        type: 'error',
        data: {
            conversationId,
            error,
            errorType,
            timestamp: new Date().toISOString()
        } as ConversationErrorData,
        id: `error_${Date.now()}`
    });
}

/**
 * Close SSE connection
 */
export function closeSSEConnection(connectionId: string): boolean {
    const connection = activeConnections.get(connectionId);
    if (!connection) {
        return false;
    }

    // Send final event
    sendSSEEvent(connection, {
        type: 'conversation_end',
        data: {
            conversationId: connection.conversationId,
            timestamp: new Date().toISOString()
        },
        id: `end_${Date.now()}`
    });

    // Close connection
    connection.response.end();
    connection.isActive = false;
    activeConnections.delete(connectionId);

    return true;
}

/**
 * Format SSE event according to specification
 */
function formatSSEEvent(event: SSEEvent): string {
    let eventString = '';

    if (event.id) {
        eventString += `id: ${event.id}\n`;
    }

    eventString += `event: ${event.type}\n`;

    if (event.retry) {
        eventString += `retry: ${event.retry}\n`;
    }

    const dataString = typeof event.data === 'string'
        ? event.data
        : JSON.stringify(event.data);

    // Handle multi-line data
    dataString.split('\n').forEach(line => {
        eventString += `data: ${line}\n`;
    });

    eventString += '\n'; // Empty line to end event

    return eventString;
}

/**
 * Start heartbeat mechanism to keep connections alive
 */
export function startHeartbeat(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
        const now = new Date();

        for (const [connectionId, connection] of activeConnections.entries()) {
            if (!connection.isActive) {
                activeConnections.delete(connectionId);
                continue;
            }

            // Send heartbeat
            const heartbeatSent = sendSSEEvent(connection, {
                type: 'heartbeat',
                data: { timestamp: now.toISOString() },
                id: `heartbeat_${now.getTime()}`
            });

            if (heartbeatSent) {
                connection.lastHeartbeat = now;
            } else {
                // Connection failed, remove it
                connection.isActive = false;
                activeConnections.delete(connectionId);
            }
        }

        console.log(`[SSE] Heartbeat sent to ${activeConnections.size} active connections`);
    }, intervalMs);
}

/**
 * Get statistics about active SSE connections
 */
export function getSSEConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    connectionsByConversation: Record<string, number>;
} {
    const stats = {
        totalConnections: activeConnections.size,
        activeConnections: 0,
        connectionsByConversation: {} as Record<string, number>
    };

    for (const connection of activeConnections.values()) {
        if (connection.isActive) {
            stats.activeConnections++;

            const convId = connection.conversationId;
            stats.connectionsByConversation[convId] =
                (stats.connectionsByConversation[convId] || 0) + 1;
        }
    }

    return stats;
}

/**
 * Clean up inactive connections
 */
export function cleanupInactiveConnections(): number {
    const beforeSize = activeConnections.size;

    for (const [connectionId, connection] of activeConnections.entries()) {
        if (!connection.isActive) {
            activeConnections.delete(connectionId);
        }
    }

    const cleanedCount = beforeSize - activeConnections.size;

    if (cleanedCount > 0) {
        console.log(`[SSE] Cleaned up ${cleanedCount} inactive connections`);
    }

    return cleanedCount;
} 