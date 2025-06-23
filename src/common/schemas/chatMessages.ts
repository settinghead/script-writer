import { z } from 'zod';

// Chat Event Types - these are the structured events stored in the database
export const ChatEventSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('user_message'),
        content: z.string(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal('agent_thinking_start'),
        task: z.string(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal('agent_thinking_end'),
        task: z.string(),
        duration_ms: z.number(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal('agent_tool_call'),
        tool: z.string(),
        description: z.string(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal('agent_response'),
        content: z.string(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal('agent_error'),
        message: z.string(),
        timestamp: z.string(),
    }),
]);

export type ChatEvent = z.infer<typeof ChatEventSchema>;

// Raw messages table (backend only, not exposed via Electric)
export const ChatMessageRawSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    role: z.enum(['user', 'assistant', 'tool', 'system']),
    content: z.string(),
    tool_name: z.string().optional(),
    tool_parameters: z.record(z.any()).optional(),
    tool_result: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    created_at: z.string()
});

// Display messages table (Electric SQL synced, user-facing)
export const ChatMessageDisplaySchema = z.object({
    id: z.string(),
    project_id: z.string(),
    role: z.enum(['user', 'assistant', 'tool']),
    // content is now a JSON array of ChatEvent objects
    content: z.string(), // JSON string containing ChatEvent[]
    display_type: z.enum(['message', 'tool_summary', 'thinking']).default('message'),
    status: z.enum(['pending', 'streaming', 'completed', 'failed']).default('completed'),
    raw_message_id: z.string().optional(),
    created_at: z.string()
});

export type ChatMessageRaw = z.infer<typeof ChatMessageRawSchema>;
export type ChatMessageDisplay = z.infer<typeof ChatMessageDisplaySchema>;

// Helper functions for working with event-based messages
export function createEventMessage(events: ChatEvent[]): string {
    return JSON.stringify(events);
}

export function parseEventMessage(content: string): ChatEvent[] {
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            return parsed.map(event => ChatEventSchema.parse(event));
        }
        return [ChatEventSchema.parse(parsed)];
    } catch (error) {
        console.error('Failed to parse chat event message:', error);
        return [];
    }
}

// Helper to create common event types
export const ChatEventHelpers = {
    userMessage: (content: string): ChatEvent => ({
        type: 'user_message',
        content,
        timestamp: new Date().toISOString(),
    }),

    agentThinkingStart: (task: string): ChatEvent => ({
        type: 'agent_thinking_start',
        task,
        timestamp: new Date().toISOString(),
    }),

    agentThinkingEnd: (task: string, startTime: string): ChatEvent => ({
        type: 'agent_thinking_end',
        task,
        duration_ms: Date.now() - new Date(startTime).getTime(),
        timestamp: new Date().toISOString(),
    }),

    agentToolCall: (tool: string, description: string): ChatEvent => ({
        type: 'agent_tool_call',
        tool,
        description,
        timestamp: new Date().toISOString(),
    }),

    agentResponse: (content: string): ChatEvent => ({
        type: 'agent_response',
        content,
        timestamp: new Date().toISOString(),
    }),

    agentError: (message: string): ChatEvent => ({
        type: 'agent_error',
        message,
        timestamp: new Date().toISOString(),
    }),
};

// Electric SQL compatible type (for frontend use)
export interface ElectricChatMessage extends ChatMessageDisplay {
    // Electric SQL may add additional fields
}

// OpenAI-compatible message format for agent integration
export const OpenAIChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'tool', 'system']),
    content: z.string(),
    tool_calls: z.array(z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
            name: z.string(),
            arguments: z.string()
        })
    })).optional(),
    tool_call_id: z.string().optional()
});

export type OpenAIChatMessage = z.infer<typeof OpenAIChatMessageSchema>; 