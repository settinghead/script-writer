#!/usr/bin/env node

import {
    migrateLegacyCache,
    verifyMigratedCache,
    generateMigrationReport,
    cleanupLegacyCache,
    scanLegacyCache,
    DEFAULT_MIGRATION_CONFIG,
    type CacheMigrationConfig
} from '../conversation/CacheMigration.js';

/**
 * File Cache Migration Script
 * 
 * Migrates existing file-based cache entries to the new database-based conversation system.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/migrate-file-cache.ts [options]
 * 
 * Options:
 *   --cache-dir <path>     Path to legacy cache directory (default: ./cache/llm-streams)
 *   --project-id <id>      Project ID to assign migrated caches to (default: cache-migration-project)
 *   --batch-size <num>     Number of files to process per batch (default: 50)
 *   --dry-run              Perform dry run without actual migration
 *   --no-preserve          Delete original files after successful migration
 *   --force-cleanup        Force cleanup of legacy cache files after migration
 *   --report-file <path>   Save migration report to file
 *   --help                 Show this help message
 */

interface MigrationScriptOptions {
    cacheDir: string;
    projectId: string;
    batchSize: number;
    dryRun: boolean;
    preserveOriginalFiles: boolean;
    forceCleanup: boolean;
    reportFile?: string;
    showHelp: boolean;
}

function parseCommandLineArgs(args: string[]): MigrationScriptOptions {
    const options: MigrationScriptOptions = {
        cacheDir: DEFAULT_MIGRATION_CONFIG.legacyCacheDir,
        projectId: DEFAULT_MIGRATION_CONFIG.projectId,
        batchSize: DEFAULT_MIGRATION_CONFIG.batchSize,
        dryRun: false,
        preserveOriginalFiles: true,
        forceCleanup: false,
        showHelp: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--cache-dir':
                options.cacheDir = args[++i];
                if (!options.cacheDir) {
                    throw new Error('--cache-dir requires a path argument');
                }
                break;

            case '--project-id':
                options.projectId = args[++i];
                if (!options.projectId) {
                    throw new Error('--project-id requires an ID argument');
                }
                break;

            case '--batch-size':
                options.batchSize = parseInt(args[++i]);
                if (isNaN(options.batchSize) || options.batchSize < 1) {
                    throw new Error('--batch-size must be a positive number');
                }
                break;

            case '--dry-run':
                options.dryRun = true;
                break;

            case '--no-preserve':
                options.preserveOriginalFiles = false;
                break;

            case '--force-cleanup':
                options.forceCleanup = true;
                break;

            case '--report-file':
                options.reportFile = args[++i];
                if (!options.reportFile) {
                    throw new Error('--report-file requires a path argument');
                }
                break;

            case '--help':
            case '-h':
                options.showHelp = true;
                break;

            default:
                if (arg.startsWith('--')) {
                    console.warn(`Unknown option: ${arg}`);
                }
                break;
        }
    }

    return options;
}

function showHelp(): void {
    console.log(`
File Cache Migration Script

Migrates existing file-based cache entries to the new database-based conversation system.

Usage:
  ./run-ts src/server/scripts/migrate-file-cache.ts [options]

Options:
  --cache-dir <path>     Path to legacy cache directory (default: ./cache/llm-streams)
  --project-id <id>      Project ID to assign migrated caches to (default: cache-migration-project)
  --batch-size <num>     Number of files to process per batch (default: 50)
  --dry-run              Perform dry run without actual migration
  --no-preserve          Delete original files after successful migration
  --force-cleanup        Force cleanup of legacy cache files after migration
  --report-file <path>   Save migration report to file
  --help                 Show this help message

Examples:
  # Dry run to see what would be migrated
  ./run-ts src/server/scripts/migrate-file-cache.ts --dry-run

  # Migrate with specific project ID
  ./run-ts src/server/scripts/migrate-file-cache.ts --project-id my-project-123

  # Migrate and clean up original files
  ./run-ts src/server/scripts/migrate-file-cache.ts --no-preserve --force-cleanup

  # Generate migration report
  ./run-ts src/server/scripts/migrate-file-cache.ts --report-file migration-report.md
    `);
}

async function scanCacheDirectory(cacheDir: string): Promise<boolean> {
    try {
        console.log(`\n📁 Scanning cache directory: ${cacheDir}\n`);

        const scanResult = await scanLegacyCache(cacheDir);

        if (scanResult.files.length === 0) {
            console.log('ℹ️  No cache files found. Nothing to migrate.');
            return false;
        }

        console.log(`📊 Cache Directory Summary:`);
        console.log(`   Files found: ${scanResult.files.length}`);
        console.log(`   Total size: ${Math.round(scanResult.totalSizeBytes / 1024)} KB`);

        if (scanResult.oldestFile) {
            console.log(`   Oldest file: ${scanResult.oldestFile}`);
        }

        if (scanResult.newestFile) {
            console.log(`   Newest file: ${scanResult.newestFile}`);
        }

        console.log('');
        return true;

    } catch (error) {
        console.error('❌ Error scanning cache directory:', error);
        return false;
    }
}

async function performMigration(options: MigrationScriptOptions): Promise<boolean> {
    try {
        console.log(`\n🚀 Starting cache migration...\n`);

        const migrationConfig: CacheMigrationConfig = {
            legacyCacheDir: options.cacheDir,
            batchSize: options.batchSize,
            dryRun: options.dryRun,
            preserveOriginalFiles: options.preserveOriginalFiles,
            projectId: options.projectId,
            migrationUserId: 'system-migration'
        };

        const migrationResult = await migrateLegacyCache(migrationConfig);

        // Verify migration if successful and not dry run
        let verificationResult;
        if (migrationResult.success && !options.dryRun) {
            console.log('\n🔍 Verifying migrated data...\n');
            verificationResult = await verifyMigratedCache(options.projectId);
        }

        // Generate and display report
        const report = await generateMigrationReport(migrationResult, verificationResult);

        console.log('\n📋 Migration Report:\n');
        console.log(report);

        // Save report to file if specified
        if (options.reportFile && !options.dryRun) {
            const fs = await import('fs/promises');
            await fs.writeFile(options.reportFile, report);
            console.log(`\n💾 Report saved to: ${options.reportFile}`);
        }

        // Cleanup if requested and migration was successful
        if (options.forceCleanup && migrationResult.success && !options.dryRun) {
            console.log('\n🧹 Cleaning up legacy cache files...\n');

            const cleanupResult = await cleanupLegacyCache(options.cacheDir, true);

            if (cleanupResult.errors.length === 0) {
                console.log(`✅ Cleanup completed: removed ${cleanupResult.deletedFiles} files`);
            } else {
                console.log(`⚠️  Cleanup completed with errors:`);
                cleanupResult.errors.forEach(error => console.log(`   - ${error}`));
            }
        }

        return migrationResult.success;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return false;
    }
}

async function main(): Promise<void> {
    try {
        const args = process.argv.slice(2);
        const options = parseCommandLineArgs(args);

        if (options.showHelp) {
            showHelp();
            process.exit(0);
        }

        console.log('🗂️  File Cache Migration Tool');
        console.log('=====================================');

        console.log(`\n⚙️  Configuration:`);
        console.log(`   Cache directory: ${options.cacheDir}`);
        console.log(`   Project ID: ${options.projectId}`);
        console.log(`   Batch size: ${options.batchSize}`);
        console.log(`   Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
        console.log(`   Preserve files: ${options.preserveOriginalFiles ? 'Yes' : 'No'}`);
        console.log(`   Force cleanup: ${options.forceCleanup ? 'Yes' : 'No'}`);

        if (options.reportFile) {
            console.log(`   Report file: ${options.reportFile}`);
        }

        // Scan cache directory first
        const hasFiles = await scanCacheDirectory(options.cacheDir);

        if (!hasFiles) {
            console.log('✅ No migration needed.');
            process.exit(0);
        }

        // Confirm migration for non-dry-run
        if (!options.dryRun) {
            console.log('\n⚠️  This will migrate cache files to the database.');

            if (!options.preserveOriginalFiles) {
                console.log('⚠️  Original files will be DELETED after successful migration.');
            }

            if (options.forceCleanup) {
                console.log('⚠️  Legacy cache directory will be CLEANED UP after migration.');
            }

            // In a real script, you might want to prompt for confirmation
            console.log('\n▶️  Proceeding with migration...');
        }

        // Perform migration
        const success = await performMigration(options);

        if (success) {
            console.log('\n🎉 Migration completed successfully!');

            if (options.dryRun) {
                console.log('\nℹ️  This was a dry run. Run again without --dry-run to perform actual migration.');
            }

            process.exit(0);
        } else {
            console.log('\n💥 Migration failed. Check the logs above for details.');
            process.exit(1);
        }

    } catch (error) {
        console.error('💥 Script failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

export { main as runCacheMigration }; 