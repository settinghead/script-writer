import * as express from 'express';
import { ChatService, SendMessageRequest } from '../services/ChatService';
import { AuthMiddleware } from '../middleware/auth';

export function createChatRoutes(
    authMiddleware: AuthMiddleware,
    chatService: ChatService
) {
    const router = express.Router();

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