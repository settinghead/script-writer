import { ConversationId, MessageId } from './ConversationManager.js';

// Message version types
export interface MessageVersion {
    id: string;
    message_id: MessageId;
    version_number: number;
    content: string;
    content_delta?: string; // Only the changed part
    chunk_index?: number; // For streaming chunks
    timestamp: string;
    reason: VersionReason;
    metadata: Record<string, any>;
}

export type VersionReason =
    | 'initial'          // First version of the message
    | 'streaming_chunk'  // Streaming content update
    | 'streaming_complete' // Final streaming version
    | 'edit'            // Manual edit
    | 'retry'           // Retry operation
    | 'correction'      // Error correction
    | 'enhancement';    // Content enhancement

export interface MessageVersionHistory {
    messageId: MessageId;
    conversationId: ConversationId;
    versions: MessageVersion[];
    currentVersion: number;
    totalVersions: number;
    firstCreated: string;
    lastUpdated: string;
}

export interface StreamingState {
    messageId: MessageId;
    currentContent: string;
    chunkCount: number;
    isStreaming: boolean;
    startTime: string;
    lastChunkTime?: string;
    expectedChunks?: number;
}

// In-memory version storage (in production, this would be in database)
const messageVersions = new Map<MessageId, MessageVersion[]>();
const streamingStates = new Map<MessageId, StreamingState>();

/**
 * Create initial version of a message
 */
export function createInitialVersion(
    messageId: MessageId,
    content: string,
    metadata: Record<string, any> = {}
): MessageVersion {
    const version: MessageVersion = {
        id: `${messageId}_v1_${Date.now()}`,
        message_id: messageId,
        version_number: 1,
        content,
        timestamp: new Date().toISOString(),
        reason: 'initial',
        metadata: {
            ...metadata,
            contentLength: content.length,
            wordCount: content.split(/\s+/).length
        }
    };

    // Store version
    messageVersions.set(messageId, [version]);

    console.log(`[Versioning] Created initial version for message ${messageId}`);
    return version;
}

/**
 * Start streaming for a message
 */
export function startStreaming(
    messageId: MessageId,
    expectedChunks?: number
): void {
    const streamingState: StreamingState = {
        messageId,
        currentContent: '',
        chunkCount: 0,
        isStreaming: true,
        startTime: new Date().toISOString(),
        expectedChunks
    };

    streamingStates.set(messageId, streamingState);

    console.log(`[Versioning] Started streaming for message ${messageId}`, {
        expectedChunks
    });
}

/**
 * Add streaming chunk version
 */
export function addStreamingChunk(
    messageId: MessageId,
    chunkContent: string,
    chunkIndex: number,
    metadata: Record<string, any> = {}
): MessageVersion {
    const streamingState = streamingStates.get(messageId);
    if (!streamingState) {
        throw new Error(`No streaming state found for message ${messageId}`);
    }

    // Update streaming state
    streamingState.currentContent += chunkContent;
    streamingState.chunkCount++;
    streamingState.lastChunkTime = new Date().toISOString();

    // Get existing versions
    const existingVersions = messageVersions.get(messageId) || [];
    const versionNumber = existingVersions.length + 1;

    // Create streaming chunk version
    const version: MessageVersion = {
        id: `${messageId}_v${versionNumber}_${Date.now()}`,
        message_id: messageId,
        version_number: versionNumber,
        content: streamingState.currentContent,
        content_delta: chunkContent,
        chunk_index: chunkIndex,
        timestamp: new Date().toISOString(),
        reason: 'streaming_chunk',
        metadata: {
            ...metadata,
            chunkIndex,
            chunkLength: chunkContent.length,
            totalLength: streamingState.currentContent.length,
            streamingProgress: streamingState.expectedChunks
                ? (chunkIndex + 1) / streamingState.expectedChunks
                : undefined
        }
    };

    // Store version
    existingVersions.push(version);
    messageVersions.set(messageId, existingVersions);

    console.log(`[Versioning] Added streaming chunk ${chunkIndex} for message ${messageId}`, {
        chunkLength: chunkContent.length,
        totalLength: streamingState.currentContent.length
    });

    return version;
}

/**
 * Complete streaming for a message
 */
export function completeStreaming(
    messageId: MessageId,
    finalContent?: string,
    metadata: Record<string, any> = {}
): MessageVersion {
    const streamingState = streamingStates.get(messageId);
    if (!streamingState) {
        throw new Error(`No streaming state found for message ${messageId}`);
    }

    // Use final content or current accumulated content
    const content = finalContent || streamingState.currentContent;

    // Get existing versions
    const existingVersions = messageVersions.get(messageId) || [];
    const versionNumber = existingVersions.length + 1;

    // Create completion version
    const version: MessageVersion = {
        id: `${messageId}_v${versionNumber}_${Date.now()}`,
        message_id: messageId,
        version_number: versionNumber,
        content,
        timestamp: new Date().toISOString(),
        reason: 'streaming_complete',
        metadata: {
            ...metadata,
            totalChunks: streamingState.chunkCount,
            streamingDurationMs: new Date().getTime() - new Date(streamingState.startTime).getTime(),
            finalContentLength: content.length,
            averageChunkSize: streamingState.chunkCount > 0
                ? Math.round(content.length / streamingState.chunkCount)
                : 0
        }
    };

    // Store version
    existingVersions.push(version);
    messageVersions.set(messageId, existingVersions);

    // Mark streaming as complete
    streamingState.isStreaming = false;

    console.log(`[Versioning] Completed streaming for message ${messageId}`, {
        totalChunks: streamingState.chunkCount,
        finalLength: content.length,
        durationMs: version.metadata.streamingDurationMs
    });

    return version;
}

/**
 * Create a new version for message edit
 */
export function createEditVersion(
    messageId: MessageId,
    newContent: string,
    reason: VersionReason = 'edit',
    metadata: Record<string, any> = {}
): MessageVersion {
    const existingVersions = messageVersions.get(messageId) || [];
    const versionNumber = existingVersions.length + 1;
    const previousContent = existingVersions[existingVersions.length - 1]?.content || '';

    // Calculate content delta
    const contentDelta = calculateContentDelta(previousContent, newContent);

    const version: MessageVersion = {
        id: `${messageId}_v${versionNumber}_${Date.now()}`,
        message_id: messageId,
        version_number: versionNumber,
        content: newContent,
        content_delta: contentDelta,
        timestamp: new Date().toISOString(),
        reason,
        metadata: {
            ...metadata,
            previousLength: previousContent.length,
            newLength: newContent.length,
            lengthDelta: newContent.length - previousContent.length,
            editType: classifyEdit(previousContent, newContent)
        }
    };

    // Store version
    existingVersions.push(version);
    messageVersions.set(messageId, existingVersions);

    console.log(`[Versioning] Created ${reason} version for message ${messageId}`, {
        lengthDelta: version.metadata.lengthDelta,
        editType: version.metadata.editType
    });

    return version;
}

/**
 * Get version history for a message
 */
export function getMessageVersionHistory(messageId: MessageId): MessageVersionHistory | null {
    const versions = messageVersions.get(messageId);
    if (!versions || versions.length === 0) {
        return null;
    }

    return {
        messageId,
        conversationId: '', // Would be populated from database in real implementation
        versions: [...versions],
        currentVersion: versions.length,
        totalVersions: versions.length,
        firstCreated: versions[0].timestamp,
        lastUpdated: versions[versions.length - 1].timestamp
    };
}

/**
 * Get specific version of a message
 */
export function getMessageVersion(messageId: MessageId, versionNumber: number): MessageVersion | null {
    const versions = messageVersions.get(messageId);
    if (!versions) {
        return null;
    }

    return versions.find(v => v.version_number === versionNumber) || null;
}

/**
 * Get current (latest) version of a message
 */
export function getCurrentMessageVersion(messageId: MessageId): MessageVersion | null {
    const versions = messageVersions.get(messageId);
    if (!versions || versions.length === 0) {
        return null;
    }

    return versions[versions.length - 1];
}

/**
 * Get streaming state for a message
 */
export function getStreamingState(messageId: MessageId): StreamingState | null {
    return streamingStates.get(messageId) || null;
}

/**
 * Check if message is currently streaming
 */
export function isMessageStreaming(messageId: MessageId): boolean {
    const state = streamingStates.get(messageId);
    return state?.isStreaming || false;
}

/**
 * Calculate content delta between two versions
 */
function calculateContentDelta(oldContent: string, newContent: string): string {
    // Simple implementation - in production, use proper diff algorithm
    if (oldContent === newContent) {
        return '';
    }

    if (newContent.startsWith(oldContent)) {
        // Addition at the end
        return `+${newContent.substring(oldContent.length)}`;
    }

    if (oldContent.startsWith(newContent)) {
        // Deletion from the end
        return `-${oldContent.substring(newContent.length)}`;
    }

    // Complex change - return indication
    return `~${Math.abs(newContent.length - oldContent.length)} chars changed`;
}

/**
 * Classify the type of edit made
 */
function classifyEdit(oldContent: string, newContent: string): string {
    if (oldContent === newContent) {
        return 'no_change';
    }

    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const lengthDiff = Math.abs(newLength - oldLength);
    const similarityRatio = calculateSimilarity(oldContent, newContent);

    if (newLength > oldLength && newContent.includes(oldContent)) {
        return 'addition';
    }

    if (newLength < oldLength && oldContent.includes(newContent)) {
        return 'deletion';
    }

    if (lengthDiff < oldLength * 0.1 && similarityRatio > 0.8) {
        return 'minor_edit';
    }

    if (similarityRatio > 0.5) {
        return 'modification';
    }

    return 'major_rewrite';
}

/**
 * Calculate similarity ratio between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);

    return totalWords > 0 ? commonWords.length / totalWords : 0;
}

/**
 * Get version statistics for a message
 */
export function getVersionStatistics(messageId: MessageId): {
    totalVersions: number;
    streamingChunks: number;
    edits: number;
    averageVersionSize: number;
    streamingDuration?: number;
    editFrequency: number;
} | null {
    const versions = messageVersions.get(messageId);
    if (!versions) {
        return null;
    }

    const streamingChunks = versions.filter(v => v.reason === 'streaming_chunk').length;
    const edits = versions.filter(v => v.reason === 'edit' || v.reason === 'correction').length;
    const averageVersionSize = versions.reduce((sum, v) => sum + v.content.length, 0) / versions.length;

    const streamingComplete = versions.find(v => v.reason === 'streaming_complete');
    const streamingDuration = streamingComplete?.metadata.streamingDurationMs;

    const timeSpan = new Date(versions[versions.length - 1].timestamp).getTime() -
        new Date(versions[0].timestamp).getTime();
    const editFrequency = timeSpan > 0 ? (edits / timeSpan) * 60000 : 0; // edits per minute

    return {
        totalVersions: versions.length,
        streamingChunks,
        edits,
        averageVersionSize: Math.round(averageVersionSize),
        streamingDuration,
        editFrequency: Math.round(editFrequency * 100) / 100
    };
}

/**
 * Clean up old versions to prevent memory leaks
 */
export function cleanupOldVersions(
    maxVersionsPerMessage: number = 50,
    maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): number {
    let cleanedCount = 0;
    const now = new Date().getTime();

    for (const [messageId, versions] of messageVersions.entries()) {
        const originalCount = versions.length;

        // Remove old versions
        const filteredVersions = versions.filter(version => {
            const age = now - new Date(version.timestamp).getTime();
            return age <= maxAgeMs;
        });

        // Keep only recent versions if still too many
        if (filteredVersions.length > maxVersionsPerMessage) {
            filteredVersions.splice(0, filteredVersions.length - maxVersionsPerMessage);
        }

        // Update storage
        if (filteredVersions.length < originalCount) {
            if (filteredVersions.length === 0) {
                messageVersions.delete(messageId);
                streamingStates.delete(messageId);
            } else {
                messageVersions.set(messageId, filteredVersions);
            }

            cleanedCount += originalCount - filteredVersions.length;
        }
    }

    if (cleanedCount > 0) {
        console.log(`[Versioning] Cleaned up ${cleanedCount} old message versions`);
    }

    return cleanedCount;
}

/**
 * Export message version history for analysis
 */
export function exportVersionHistory(messageId: MessageId): {
    messageId: MessageId;
    timeline: Array<{
        version: number;
        timestamp: string;
        reason: VersionReason;
        contentLength: number;
        delta?: string;
        metadata: Record<string, any>;
    }>;
    statistics: ReturnType<typeof getVersionStatistics>;
} | null {
    const history = getMessageVersionHistory(messageId);
    const statistics = getVersionStatistics(messageId);

    if (!history) {
        return null;
    }

    const timeline = history.versions.map(version => ({
        version: version.version_number,
        timestamp: version.timestamp,
        reason: version.reason,
        contentLength: version.content.length,
        delta: version.content_delta,
        metadata: version.metadata
    }));

    return {
        messageId,
        timeline,
        statistics
    };
}

/**
 * Compare two versions of a message
 */
export function compareVersions(
    messageId: MessageId,
    version1: number,
    version2: number
): {
    version1Content: string;
    version2Content: string;
    contentDelta: string;
    lengthDelta: number;
    changeType: string;
    timeDelta: number;
} | null {
    const v1 = getMessageVersion(messageId, version1);
    const v2 = getMessageVersion(messageId, version2);

    if (!v1 || !v2) {
        return null;
    }

    const contentDelta = calculateContentDelta(v1.content, v2.content);
    const lengthDelta = v2.content.length - v1.content.length;
    const changeType = classifyEdit(v1.content, v2.content);
    const timeDelta = new Date(v2.timestamp).getTime() - new Date(v1.timestamp).getTime();

    return {
        version1Content: v1.content,
        version2Content: v2.content,
        contentDelta,
        lengthDelta,
        changeType,
        timeDelta
    };
}

/**
 * Revert message to a previous version
 */
export function revertToVersion(
    messageId: MessageId,
    targetVersion: number,
    metadata: Record<string, any> = {}
): MessageVersion | null {
    const targetVersionData = getMessageVersion(messageId, targetVersion);
    if (!targetVersionData) {
        return null;
    }

    return createEditVersion(
        messageId,
        targetVersionData.content,
        'edit',
        {
            ...metadata,
            revertedFrom: getCurrentMessageVersion(messageId)?.version_number,
            revertedTo: targetVersion,
            isRevert: true
        }
    );
}

/**
 * Get all messages with version history
 */
export function getAllMessageVersions(): Map<MessageId, MessageVersion[]> {
    return new Map(messageVersions);
}

/**
 * Database integration functions (for production implementation)
 */
export const DatabaseVersioning = {
    /**
     * Save version to database
     */
    async saveVersionToDatabase(version: MessageVersion): Promise<void> {
        // In production, implement database save
        console.log(`[Versioning] Would save version to database:`, version.id);
    },

    /**
     * Load versions from database
     */
    async loadVersionsFromDatabase(messageId: MessageId): Promise<MessageVersion[]> {
        // In production, implement database load
        console.log(`[Versioning] Would load versions from database for message:`, messageId);
        return messageVersions.get(messageId) || [];
    },

    /**
     * Clean up database versions
     */
    async cleanupDatabaseVersions(maxAge: number): Promise<number> {
        // In production, implement database cleanup
        console.log(`[Versioning] Would clean up database versions older than ${maxAge}ms`);
        return 0;
    }
}; 