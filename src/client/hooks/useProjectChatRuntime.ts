import { apiService } from '../services/apiService';

// Type definitions for assistant-ui (since imports are problematic)
interface ChatModelAdapter {
    run: (options: {
        messages: any[];
        abortSignal?: AbortSignal;
    }) => Promise<{ content: { type: string; text: string }[] }>;
}

export function useProjectChatRuntime(projectId: string) {
    const adapter: ChatModelAdapter = {
        async run({ messages, abortSignal }) {
            // Convert assistant-ui messages to our internal format
            const lastMessage = messages[messages.length - 1];

            if (lastMessage?.role !== 'user') {
                throw new Error('Last message must be from user');
            }

            // Extract text content from the message
            const textContent = lastMessage.content
                ?.filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('\n') || lastMessage.content || '';

            // Send message to our existing backend
            try {
                await apiService.sendChatMessage(projectId, textContent, {
                    timestamp: new Date().toISOString(),
                    source: 'assistant-ui'
                });

                // Return a simple response - the real streaming happens via Electric SQL
                // and will be handled by our existing real-time subscription system
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: '消息已发送，正在处理...'
                        }
                    ]
                };
            } catch (error) {
                console.error('Failed to send message:', error);
                throw new Error('发送消息失败，请重试');
            }
        }
    };

    // For now, return a placeholder that we'll replace once ES modules are working
    return {
        adapter,
        // TODO: Replace with actual useLocalRuntime once ES module issues are resolved
        isReady: false,
        error: 'ES module compatibility issue - useLocalRuntime not available'
    };
} 