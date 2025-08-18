import crypto from 'crypto';
import type { ConversationMessage } from './ConversationManager.js';

// Parameters that affect LLM responses and should be included in hash
export interface LLMParameters {
    modelName?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
    tools?: Record<string, any>;
    systemPrompt?: string;
}

// Message structure for hashing
export interface MessageForHashing {
    role: string;
    content: string;
    tool_name?: string;
    tool_parameters?: Record<string, any>;
}

/**
 * Calculate content hash for conversation caching
 * Hash includes: conversation history + current LLM parameters
 * This enables context caching by identifying identical conversation prefixes
 */
export function calculateContentHash(
    conversationHistory: ConversationMessage[],
    currentParameters: LLMParameters,
    newMessages: MessageForHashing[] = []
): string {
    console.log(`[ContentHasher] Calculating hash for ${conversationHistory.length} history messages + ${newMessages.length} new messages`);

    // Normalize conversation history for hashing
    const normalizedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content.trim(),
        tool_name: msg.tool_name,
        tool_parameters: msg.tool_parameters
    }));

    // Normalize new messages
    const normalizedNew = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content.trim(),
        tool_name: msg.tool_name,
        tool_parameters: msg.tool_parameters
    }));

    // Combine all messages
    const allMessages = [...normalizedHistory, ...normalizedNew];

    // Normalize parameters (exclude undefined values)
    const normalizedParams: Record<string, any> = {};
    if (currentParameters.modelName) normalizedParams.modelName = currentParameters.modelName;
    if (currentParameters.temperature !== undefined) normalizedParams.temperature = currentParameters.temperature;
    if (currentParameters.topP !== undefined) normalizedParams.topP = currentParameters.topP;
    if (currentParameters.maxTokens !== undefined) normalizedParams.maxTokens = currentParameters.maxTokens;
    if (currentParameters.seed !== undefined) normalizedParams.seed = currentParameters.seed;
    if (currentParameters.systemPrompt) normalizedParams.systemPrompt = currentParameters.systemPrompt.trim();
    if (currentParameters.tools) normalizedParams.tools = currentParameters.tools;

    // Create hash input object
    const hashInput = {
        messages: allMessages,
        parameters: normalizedParams,
        version: '1.0' // Include version for future compatibility
    };

    // Convert to stable JSON string (sorted keys)
    const stableJson = JSON.stringify(hashInput, Object.keys(hashInput).sort());

    // Calculate SHA-256 hash
    const hash = crypto.createHash('sha256').update(stableJson).digest('hex');

    console.log(`[ContentHasher] ✅ Generated hash: ${hash.substring(0, 16)}...`);

    return hash;
}

/**
 * Calculate prefix hash for context caching
 * This enables caching of conversation prefixes that are reused
 */
export function calculatePrefixHash(
    conversationHistory: ConversationMessage[],
    prefixLength?: number
): string {
    const prefixMessages = prefixLength
        ? conversationHistory.slice(0, prefixLength)
        : conversationHistory;

    console.log(`[ContentHasher] Calculating prefix hash for ${prefixMessages.length} messages`);

    const normalizedMessages = prefixMessages.map(msg => ({
        role: msg.role,
        content: msg.content.trim(),
        tool_name: msg.tool_name,
        tool_parameters: msg.tool_parameters
    }));

    const hashInput = {
        messages: normalizedMessages,
        type: 'prefix',
        version: '1.0'
    };

    const stableJson = JSON.stringify(hashInput, Object.keys(hashInput).sort());
    const hash = crypto.createHash('sha256').update(stableJson).digest('hex');

    console.log(`[ContentHasher] ✅ Generated prefix hash: ${hash.substring(0, 16)}...`);

    return hash;
}

/**
 * Check if two conversation contexts would produce the same cache key
 * Useful for cache hit detection
 */
export function areContextsEquivalent(
    context1: {
        history: ConversationMessage[];
        parameters: LLMParameters;
        newMessages?: MessageForHashing[];
    },
    context2: {
        history: ConversationMessage[];
        parameters: LLMParameters;
        newMessages?: MessageForHashing[];
    }
): boolean {
    const hash1 = calculateContentHash(
        context1.history,
        context1.parameters,
        context1.newMessages
    );

    const hash2 = calculateContentHash(
        context2.history,
        context2.parameters,
        context2.newMessages
    );

    return hash1 === hash2;
}

/**
 * Extract cacheable content from conversation messages
 * Removes timestamps and IDs that don't affect LLM behavior
 */
export function extractCacheableContent(
    messages: ConversationMessage[]
): MessageForHashing[] {
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_name: msg.tool_name || undefined,
        tool_parameters: msg.tool_parameters || undefined
    }));
}

/**
 * Generate cache key for Alibaba Cloud Context Cache
 * Format: conv_{project_id}_{hash}
 */
export function generateCacheKey(
    projectId: string,
    contentHash: string
): string {
    return `conv_${projectId}_${contentHash}`;
}

/**
 * Parse cache key to extract components
 */
export function parseCacheKey(
    cacheKey: string
): { projectId: string; contentHash: string } | null {
    const match = cacheKey.match(/^conv_([^_]+)_(.+)$/);
    if (!match) {
        return null;
    }

    return {
        projectId: match[1],
        contentHash: match[2]
    };
}

/**
 * Calculate similarity score between two conversation contexts
 * Returns 0-1 score indicating how similar they are
 * Useful for partial cache hits
 */
export function calculateContextSimilarity(
    context1: ConversationMessage[],
    context2: ConversationMessage[]
): number {
    if (context1.length === 0 && context2.length === 0) {
        return 1.0;
    }

    if (context1.length === 0 || context2.length === 0) {
        return 0.0;
    }

    // Find common prefix length
    let commonPrefixLength = 0;
    const minLength = Math.min(context1.length, context2.length);

    for (let i = 0; i < minLength; i++) {
        const msg1 = context1[i];
        const msg2 = context2[i];

        if (msg1.role === msg2.role &&
            msg1.content.trim() === msg2.content.trim() &&
            msg1.tool_name === msg2.tool_name) {
            commonPrefixLength++;
        } else {
            break;
        }
    }

    // Calculate similarity as ratio of common prefix to longer conversation
    const maxLength = Math.max(context1.length, context2.length);
    const similarity = commonPrefixLength / maxLength;

    console.log(`[ContentHasher] Context similarity: ${similarity.toFixed(2)} (${commonPrefixLength}/${maxLength} messages)`);

    return similarity;
} 