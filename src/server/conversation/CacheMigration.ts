import * as fs from 'fs/promises';
import * as path from 'path';
import { ConversationId, addMessage, createConversation } from './ConversationManager.js';
import { calculateContentHash } from './ContentHasher.js';

// Legacy cache structures for migration
interface LegacyCachedStreamChunk {
    index: number;
    content: string;
    timestamp: string;
    type: 'text' | 'tool_call' | 'tool_result' | 'error';
    metadata?: Record<string, any>;
}

interface LegacyCacheData {
    cacheKey: string;
    chunks: LegacyCachedStreamChunk[];
    metadata: {
        model: string;
        temperature: number;
        prompt: string;
        createdAt: string;
        responseLength: number;
    };
}

interface MigrationResult {
    success: boolean;
    migratedFiles: number;
    migratedMessages: number;
    errors: string[];
    skippedFiles: number;
    totalSizeBytes: number;
}

interface CacheMigrationConfig {
    legacyCacheDir: string;
    batchSize: number;
    dryRun: boolean;
    preserveOriginalFiles: boolean;
    projectId: string; // All migrated cache entries will be assigned to this project
    migrationUserId: string; // User ID for migration metadata
}

// Export the interface
export type { CacheMigrationConfig };

// Default migration configuration
export const DEFAULT_MIGRATION_CONFIG: CacheMigrationConfig = {
    legacyCacheDir: './cache/llm-streams',
    batchSize: 50,
    dryRun: false,
    preserveOriginalFiles: true,
    projectId: 'cache-migration-project',
    migrationUserId: 'system-migration'
};

/**
 * Scan legacy cache directory for cache files
 */
export async function scanLegacyCache(cacheDir: string): Promise<{
    files: string[];
    totalSizeBytes: number;
    oldestFile: string | null;
    newestFile: string | null;
}> {
    try {
        const files = await fs.readdir(cacheDir);
        const cacheFiles = files.filter(file => file.endsWith('.json'));

        let totalSize = 0;
        let oldestTime = Infinity;
        let newestTime = 0;
        let oldestFile: string | null = null;
        let newestFile: string | null = null;

        for (const file of cacheFiles) {
            const filePath = path.join(cacheDir, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;

            if (stats.mtime.getTime() < oldestTime) {
                oldestTime = stats.mtime.getTime();
                oldestFile = file;
            }

            if (stats.mtime.getTime() > newestTime) {
                newestTime = stats.mtime.getTime();
                newestFile = file;
            }
        }

        console.log(`[Cache Migration] Found ${cacheFiles.length} cache files, total size: ${Math.round(totalSize / 1024)}KB`);

        return {
            files: cacheFiles,
            totalSizeBytes: totalSize,
            oldestFile,
            newestFile
        };

    } catch (error) {
        console.error('[Cache Migration] Error scanning legacy cache:', error);
        throw error;
    }
}

/**
 * Read and parse a legacy cache file
 */
export async function readLegacyCacheFile(filePath: string): Promise<LegacyCacheData | null> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Validate cache data structure
        if (!data.chunks || !Array.isArray(data.chunks) || !data.metadata) {
            console.warn(`[Cache Migration] Invalid cache format in ${filePath}`);
            return null;
        }

        return data as LegacyCacheData;

    } catch (error) {
        console.error(`[Cache Migration] Error reading cache file ${filePath}:`, error);
        return null;
    }
}

/**
 * Convert legacy cache data to conversation messages
 */
export async function convertLegacyCacheToMessages(
    cacheData: LegacyCacheData,
    conversationId: ConversationId,
    config: CacheMigrationConfig
): Promise<string[]> {
    const messageIds: string[] = [];

    try {
        // Create system message with cache metadata
        const systemMessageId = await addMessage(
            conversationId,
            'system',
            `[MIGRATED CACHE] Original prompt: ${cacheData.metadata.prompt}`,
            {
                modelName: cacheData.metadata.model,
                temperature: cacheData.metadata.temperature,
                contentHash: calculateContentHash([], {
                    modelName: cacheData.metadata.model,
                    temperature: cacheData.metadata.temperature,
                    systemPrompt: cacheData.metadata.prompt
                }),
                cacheHit: true, // This was originally cached
                cachedTokens: cacheData.metadata.responseLength,
                status: 'completed',
                metadata: {
                    migratedFrom: 'file_cache',
                    originalCacheKey: cacheData.cacheKey,
                    migrationDate: new Date().toISOString(),
                    originalCreatedAt: cacheData.metadata.createdAt
                }
            }
        );

        messageIds.push(systemMessageId);

        // Convert cached chunks to assistant message
        const assistantContent = cacheData.chunks
            .sort((a, b) => a.index - b.index)
            .map(chunk => chunk.content)
            .join('');

        const assistantMessageId = await addMessage(
            conversationId,
            'assistant',
            assistantContent,
            {
                modelName: cacheData.metadata.model,
                temperature: cacheData.metadata.temperature,
                contentHash: calculateContentHash([], {
                    modelName: cacheData.metadata.model,
                    temperature: cacheData.metadata.temperature,
                    systemPrompt: cacheData.metadata.prompt
                }, [{ role: 'assistant', content: assistantContent }]),
                cacheHit: true,
                cachedTokens: cacheData.metadata.responseLength,
                status: 'completed',
                metadata: {
                    migratedFrom: 'file_cache',
                    originalCacheKey: cacheData.cacheKey,
                    originalChunkCount: cacheData.chunks.length,
                    migrationDate: new Date().toISOString()
                }
            }
        );

        messageIds.push(assistantMessageId);

        console.log(`[Cache Migration] Converted cache ${cacheData.cacheKey.substring(0, 8)}... to ${messageIds.length} messages`);

    } catch (error) {
        console.error(`[Cache Migration] Error converting cache data:`, error);
        throw error;
    }

    return messageIds;
}

/**
 * Migrate all legacy cache files to database
 */
export async function migrateLegacyCache(config: CacheMigrationConfig = DEFAULT_MIGRATION_CONFIG): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: false,
        migratedFiles: 0,
        migratedMessages: 0,
        errors: [],
        skippedFiles: 0,
        totalSizeBytes: 0
    };

    try {
        console.log(`[Cache Migration] Starting migration from ${config.legacyCacheDir}`);
        console.log(`[Cache Migration] Config:`, {
            batchSize: config.batchSize,
            dryRun: config.dryRun,
            preserveOriginalFiles: config.preserveOriginalFiles
        });

        // Scan legacy cache directory
        const scanResult = await scanLegacyCache(config.legacyCacheDir);
        result.totalSizeBytes = scanResult.totalSizeBytes;

        if (scanResult.files.length === 0) {
            console.log('[Cache Migration] No cache files found to migrate');
            result.success = true;
            return result;
        }

        // Process files in batches
        const batches = [];
        for (let i = 0; i < scanResult.files.length; i += config.batchSize) {
            batches.push(scanResult.files.slice(i, i + config.batchSize));
        }

        console.log(`[Cache Migration] Processing ${scanResult.files.length} files in ${batches.length} batches`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`[Cache Migration] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);

            for (const fileName of batch) {
                const filePath = path.join(config.legacyCacheDir, fileName);

                try {
                    // Read legacy cache file
                    const cacheData = await readLegacyCacheFile(filePath);
                    if (!cacheData) {
                        result.skippedFiles++;
                        continue;
                    }

                    if (!config.dryRun) {
                        // Create conversation for this cache entry
                        const conversationId = await createConversation(
                            config.projectId,
                            'tool', // Mark as tool conversation since these are cached LLM calls
                            {
                                migratedFrom: 'file_cache',
                                originalFileName: fileName,
                                migrationDate: new Date().toISOString(),
                                migrationUserId: config.migrationUserId
                            }
                        );

                        // Convert cache data to messages
                        const messageIds = await convertLegacyCacheToMessages(
                            cacheData,
                            conversationId,
                            config
                        );

                        result.migratedMessages += messageIds.length;

                        // Delete original file if not preserving
                        if (!config.preserveOriginalFiles) {
                            await fs.unlink(filePath);
                            console.log(`[Cache Migration] Deleted original file: ${fileName}`);
                        }
                    } else {
                        console.log(`[Cache Migration] [DRY RUN] Would migrate ${fileName} (${cacheData.chunks.length} chunks)`);
                    }

                    result.migratedFiles++;

                } catch (error) {
                    const errorMsg = `Error migrating ${fileName}: ${(error as Error).message}`;
                    result.errors.push(errorMsg);
                    console.error(`[Cache Migration] ${errorMsg}`);
                }
            }

            // Small delay between batches to prevent overwhelming the database
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        result.success = result.errors.length === 0;

        console.log(`[Cache Migration] Migration completed:`, {
            success: result.success,
            migratedFiles: result.migratedFiles,
            migratedMessages: result.migratedMessages,
            skippedFiles: result.skippedFiles,
            errorCount: result.errors.length
        });

    } catch (error) {
        result.errors.push(`Migration failed: ${(error as Error).message}`);
        result.success = false;
        console.error('[Cache Migration] Migration failed:', error);
    }

    return result;
}

/**
 * Verify migrated cache data in database
 */
export async function verifyMigratedCache(projectId: string): Promise<{
    migratedConversations: number;
    migratedMessages: number;
    cacheHitMessages: number;
    totalCachedTokens: number;
}> {
    // This would query the database in a real implementation
    // For now, return placeholder data

    console.log(`[Cache Migration] Verifying migrated cache for project ${projectId}`);

    return {
        migratedConversations: 0,
        migratedMessages: 0,
        cacheHitMessages: 0,
        totalCachedTokens: 0
    };
}

/**
 * Clean up legacy cache directory after successful migration
 */
export async function cleanupLegacyCache(
    cacheDir: string,
    force: boolean = false
): Promise<{ deletedFiles: number; errors: string[] }> {
    const result: { deletedFiles: number; errors: string[] } = { deletedFiles: 0, errors: [] };

    try {
        const files = await fs.readdir(cacheDir);
        const cacheFiles = files.filter(file => file.endsWith('.json'));

        if (!force && cacheFiles.length > 0) {
            console.warn(`[Cache Migration] Cleanup requires force=true to delete ${cacheFiles.length} files`);
            return result;
        }

        for (const file of cacheFiles) {
            try {
                await fs.unlink(path.join(cacheDir, file));
                result.deletedFiles++;
            } catch (error) {
                result.errors.push(`Failed to delete ${file}: ${(error as Error).message}`);
            }
        }

        console.log(`[Cache Migration] Cleanup completed: deleted ${result.deletedFiles} files`);

    } catch (error) {
        result.errors.push(`Cleanup failed: ${(error as Error).message}`);
        console.error('[Cache Migration] Cleanup failed:', error);
    }

    return result;
}

/**
 * Generate migration report
 */
export async function generateMigrationReport(
    migrationResult: MigrationResult,
    verificationResult?: Awaited<ReturnType<typeof verifyMigratedCache>>
): Promise<string> {
    const report = `
# Cache Migration Report
Generated: ${new Date().toISOString()}

## Migration Summary
- **Status**: ${migrationResult.success ? '✅ SUCCESS' : '❌ FAILED'}
- **Files Processed**: ${migrationResult.migratedFiles}
- **Messages Created**: ${migrationResult.migratedMessages}
- **Files Skipped**: ${migrationResult.skippedFiles}
- **Total Size Migrated**: ${Math.round(migrationResult.totalSizeBytes / 1024)}KB
- **Errors**: ${migrationResult.errors.length}

## Error Details
${migrationResult.errors.length > 0
            ? migrationResult.errors.map(error => `- ${error}`).join('\n')
            : 'No errors occurred during migration.'
        }

## Verification Results
${verificationResult ? `
- **Migrated Conversations**: ${verificationResult.migratedConversations}
- **Migrated Messages**: ${verificationResult.migratedMessages}
- **Cache Hit Messages**: ${verificationResult.cacheHitMessages}
- **Total Cached Tokens**: ${verificationResult.totalCachedTokens}
` : 'Verification not performed.'}

## Recommendations
${migrationResult.success
            ? '- Migration completed successfully. Legacy cache files can be safely removed.\n- Consider running verification to ensure data integrity.'
            : '- Migration encountered errors. Review error details above.\n- Consider running migration again with different parameters.\n- Check database connectivity and permissions.'
        }
    `.trim();

    return report;
}

/**
 * Command-line interface for cache migration
 */
export async function runCacheMigrationCLI(args: string[]): Promise<void> {
    const config = { ...DEFAULT_MIGRATION_CONFIG };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--cache-dir':
                config.legacyCacheDir = args[++i];
                break;
            case '--project-id':
                config.projectId = args[++i];
                break;
            case '--batch-size':
                config.batchSize = parseInt(args[++i]);
                break;
            case '--dry-run':
                config.dryRun = true;
                break;
            case '--no-preserve':
                config.preserveOriginalFiles = false;
                break;
            default:
                break;
        }
    }

    console.log('[Cache Migration] Starting CLI migration with config:', config);

    try {
        // Run migration
        const migrationResult = await migrateLegacyCache(config);

        // Verify migration if successful and not dry run
        let verificationResult;
        if (migrationResult.success && !config.dryRun) {
            verificationResult = await verifyMigratedCache(config.projectId);
        }

        // Generate and display report
        const report = await generateMigrationReport(migrationResult, verificationResult);
        console.log('\n' + report);

        // Exit with appropriate code
        process.exit(migrationResult.success ? 0 : 1);

    } catch (error) {
        console.error('[Cache Migration] CLI failed:', error);
        process.exit(1);
    }
} 