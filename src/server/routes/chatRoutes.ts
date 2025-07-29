import * as express from 'express';
import { ChatService, SendMessageRequest } from '../transform-jsondoc-framework/ChatService';
import { AuthMiddleware } from '../middleware/auth';
import {
    getConversationsByProject,
    getConversationMessages,
    userHasConversationAccess,
    getCurrentConversation,
    setCurrentConversation,
    createAndSetCurrentConversation,
    getDisplayMessages
} from '../conversation/ConversationManager';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';

export function createChatRoutes(
    authMiddleware: AuthMiddleware,
    chatService: ChatService
) {
    const router = express.Router();

    // Get all conversations for a project
    router.get('/conversations/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Check if user has access to the project
            const { db } = await import('../database/connection.js');
            const jsondocRepo = new TransformJsondocRepository(db);
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);

            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this project' });
            }

            const conversations = await getConversationsByProject(projectId);

            // Sort by created_at descending (most recent first)
            conversations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            res.json(conversations);

        } catch (error) {
            console.error('Error getting conversations:', error);
            res.status(500).json({ error: 'Failed to get conversations' });
        }
    });

    // Get messages for a specific conversation
    router.get('/conversations/:conversationId/messages', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { conversationId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Check if user has access to this conversation
            // For now, we'll validate through the conversation's project access
            const { db } = await import('../database/connection.js');
            const jsondocRepo = new TransformJsondocRepository(db);

            // Get conversation to check project access
            const conversation = await db
                .selectFrom('conversations')
                .selectAll()
                .where('id', '=', conversationId)
                .executeTakeFirst();

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, conversation.project_id);

            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this conversation' });
            }

            const messages = await getConversationMessages(conversationId);

            // Sort by created_at ascending (chronological order for conversation flow)
            messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            res.json(messages);

        } catch (error) {
            console.error('Error getting conversation messages:', error);
            res.status(500).json({ error: 'Failed to get conversation messages' });
        }
    });

    // Send user message (triggers agent processing)
    router.post('/:projectId/messages', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;
            const { content, metadata }: SendMessageRequest = req.body;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return res.status(400).json({ error: 'Message content is required' });
            }

            if (content.length > 5000) {
                return res.status(400).json({ error: 'Message content too long (max 5000 characters)' });
            }

            // Send message and trigger agent processing
            await chatService.sendUserMessage(projectId, user.id, { content: content.trim(), metadata });

            res.json({
                success: true,
                message: 'Message sent successfully'
            });

        } catch (error) {
            console.error('Error sending chat message:', error);

            if (error instanceof Error && error.message.includes('access')) {
                return res.status(403).json({ error: 'Access denied to this project' });
            }

            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    // Get chat history (display messages only)
    // Note: This is mainly for initial load - real-time updates use Electric SQL
    router.get('/:projectId/messages', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const messages = await chatService.getChatMessages(projectId, user.id);

            res.json({
                messages,
                total: messages.length,
                note: 'For real-time updates, use Electric SQL subscription to chat_messages_display table'
            });

        } catch (error) {
            console.error('Error getting chat messages:', error);

            if (error instanceof Error && error.message.includes('access')) {
                return res.status(403).json({ error: 'Access denied to this project' });
            }

            res.status(500).json({ error: 'Failed to get chat messages' });
        }
    });

    // Get chat message count
    router.get('/:projectId/messages/count', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const count = await chatService.getChatMessageCount(projectId, user.id);

            res.json({ count });

        } catch (error) {
            console.error('Error getting chat message count:', error);

            if (error instanceof Error && error.message.includes('access')) {
                return res.status(403).json({ error: 'Access denied to this project' });
            }

            res.status(500).json({ error: 'Failed to get message count' });
        }
    });

    // Delete all chat messages for a project
    router.delete('/:projectId/messages', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            await chatService.deleteProjectChat(projectId, user.id);

            res.json({
                success: true,
                message: 'Chat history deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting chat messages:', error);

            if (error instanceof Error && error.message.includes('access')) {
                return res.status(403).json({ error: 'Access denied to this project' });
            }

            res.status(500).json({ error: 'Failed to delete chat messages' });
        }
    });

    // Get current conversation for project
    router.get('/projects/:projectId/current-conversation', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Validate project access (simplified - could use jsondocRepo)
            const conversationId = await getCurrentConversation(projectId);

            res.json({
                conversationId,
                hasConversation: !!conversationId
            });

        } catch (error) {
            console.error('Error getting current conversation:', error);
            res.status(500).json({ error: 'Failed to get current conversation' });
        }
    });

    // Set current conversation for project
    router.put('/projects/:projectId/current-conversation', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;
            const { conversationId } = req.body;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!conversationId) {
                return res.status(400).json({ error: 'conversationId is required' });
            }

            // Validate conversation access
            const hasAccess = await userHasConversationAccess(user.id, conversationId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this conversation' });
            }

            await setCurrentConversation(projectId, conversationId);

            res.json({
                success: true,
                conversationId
            });

        } catch (error) {
            console.error('Error setting current conversation:', error);
            res.status(500).json({ error: 'Failed to set current conversation' });
        }
    });

    // Create new conversation and set as current
    router.post('/projects/:projectId/conversations/new', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const conversationId = await createAndSetCurrentConversation(projectId, 'agent', {
                userId: user.id,
                createdBy: 'user_request'
            });

            res.json({
                success: true,
                conversationId
            });

        } catch (error) {
            console.error('Error creating new conversation:', error);
            res.status(500).json({ error: 'Failed to create new conversation' });
        }
    });

    // Get display messages for current conversation
    router.get('/projects/:projectId/display-messages', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const conversationId = await getCurrentConversation(projectId);
            if (!conversationId) {
                return res.json({ messages: [] });
            }

            // Validate conversation access
            const hasAccess = await userHasConversationAccess(user.id, conversationId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this conversation' });
            }

            const messages = await getDisplayMessages(conversationId);

            res.json({
                messages,
                conversationId
            });

        } catch (error) {
            console.error('Error getting display messages:', error);
            res.status(500).json({ error: 'Failed to get display messages' });
        }
    });

    // Health check endpoint
    router.get('/health', (req: any, res: any) => {
        res.json({
            status: 'ok',
            service: 'chat',
            timestamp: new Date().toISOString()
        });
    });

    return router;
} 