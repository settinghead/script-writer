import { z } from 'zod';

// Raw chat message schema (backend only)
export const ChatMessageRawSchema = z.object({
    id: z.string(),
    project_id: z.string(),
    role: z.enum(['user', 'assistant', 'tool', 'system']),
    content: z.string(),
    tool_name: z.string().optional(),
    tool_parameters: z.record(z.any()).optional(),
    tool_result: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    created_at: z.string(),
    updated_at: z.string()
});

// Display chat message schema (Electric SQL synced, user-facing)
export const ChatMessageDisplaySchema = z.object({
    id: z.string(),
    project_id: z.string(),
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.string(),
    display_type: z.enum(['message', 'tool_summary', 'thinking']).default('message'),
    status: z.enum(['pending', 'streaming', 'completed', 'failed']).default('completed'),
    raw_message_id: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string()
});

// Type exports
export type ChatMessageRaw = z.infer<typeof ChatMessageRawSchema>;
export type ChatMessageDisplay = z.infer<typeof ChatMessageDisplaySchema>;

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