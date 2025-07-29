import { z } from 'zod';
import { JsondocReferencesSchema } from './common.js';

// Define intent types as Zod enum - matching the tool names from the existing system
export const IntentTypeSchema = z.enum([
    'generate_brainstorm',
    'generate_outline_settings',
    'generate_chronicles',
    'generate_episode_planning',
    'generate_episode_synopsis',
    'generate_episode_script'
]);

// Infer TypeScript type from Zod schema
export type IntentType = z.infer<typeof IntentTypeSchema>;

// Define intent context schema for handler input
export const IntentContextSchema = z.object({
    intent: IntentTypeSchema,
    metadata: z.record(z.any()),
    content: z.string(),
    conversationId: z.string(),
    projectId: z.string(),
    userId: z.string()
});

export type IntentContext = z.infer<typeof IntentContextSchema>;

// Define handler parameters schema - the data structure returned by parameter resolvers
export const IntentHandlerParamsSchema = z.object({
    jsondocs: JsondocReferencesSchema.optional(), // Array of JsondocReference objects, not strings
    episodeNumber: z.number().optional(),
    episodeSynopsisJsondocId: z.string().optional(),
    brainstormInputJsondocId: z.string().optional(), // For brainstorm generation
    outlineInputJsondocId: z.string().optional(), // For outline settings generation
    userRequirements: z.string().optional(),
    otherRequirements: z.string().optional(), // Alternative name used by some tools
    // Additional fields that different intents might need
    numberOfIdeas: z.number().optional(),
    platform: z.string().optional(),
    genre: z.string().optional()
});

export type IntentHandlerParams = z.infer<typeof IntentHandlerParamsSchema>;

// Define the response from an intent handler
export const IntentHandlerResponseSchema = z.object({
    toolName: z.string(),
    toolParams: z.record(z.any()),
    assistantMessages: z.object({
        thinking: z.string(),
        completion: z.string()
    })
});

export type IntentHandlerResponse = z.infer<typeof IntentHandlerResponseSchema>;

// Map intent types to their corresponding tool names
export const INTENT_TO_TOOL_MAP: Record<IntentType, string> = {
    'generate_brainstorm': 'generate_灵感创意s',
    'generate_outline_settings': 'generate_大纲设定',
    'generate_chronicles': 'generate_人物小传',
    'generate_episode_planning': 'generate_分集结构',
    'generate_episode_synopsis': 'generate_分集大纲',
    'generate_episode_script': 'generate_单集剧本'
};

// Helper function to check if an intent is supported
export function supportsIntent(intent: string): intent is IntentType {
    return IntentTypeSchema.safeParse(intent).success;
}

// Helper function to get tool name for an intent
export function getToolNameForIntent(intent: IntentType): string {
    return INTENT_TO_TOOL_MAP[intent];
} 