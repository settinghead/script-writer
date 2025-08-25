import 'dotenv/config';
import db from '../database/connection';
import { sql } from 'kysely';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import type { TypedJsondoc } from '@/common/types';

/**
 * One-time migration script:
 * Rename legacy jsondocs with schema_type '剧本设定' to new schema_type '故事设定'.
 *
 * Rules respected:
 * - Jsondocs are immutable: we DO NOT modify existing rows.
 * - We create a new jsondoc per legacy row and link them via a human transform for lineage.
 * - We do not expose routes; this is a backend admin script.
 *
 * Usage:
 *   ./run-ts src/server/scripts/migrate-rename-outline-schema.ts [--project <projectId>] [--limit N] [--dry-run]
 */

type LegacyRow = {
    id: string;
    project_id: string;
    schema_type: string;
    schema_version: string;
    data: string; // stored as JSON string in DB
    metadata: string | null;
    created_at: Date | null;
};

async function main() {
    const args = process.argv.slice(2);
    const projectIdx = args.indexOf('--project');
    const limitIdx = args.indexOf('--limit');
    const dryRun = args.includes('--dry-run');

    const projectFilter = projectIdx >= 0 && args[projectIdx + 1] ? args[projectIdx + 1] : undefined;
    const limit = limitIdx >= 0 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : undefined;

    const oldType = '剧本设定' as unknown as TypedJsondoc['schema_type'];
    const newType = '故事设定' as TypedJsondoc['schema_type'];

    const jsondocRepo = new TransformJsondocRepository(db);
    const transformRepo = jsondocRepo; // Same repository handles both sets of tables

    console.log(`[Migration] Starting rename migration: ${oldType} -> ${newType}${projectFilter ? ` (project ${projectFilter})` : ''}${dryRun ? ' [DRY-RUN]' : ''}`);

    // 1) Select legacy rows
    let query = db
        .selectFrom('jsondocs')
        .select(['id', 'project_id', 'schema_type', 'schema_version', 'data', 'metadata', 'created_at'])
        .where('schema_type', '=', oldType);

    if (projectFilter) {
        query = query.where('project_id', '=', projectFilter);
    }
    if (limit && Number.isFinite(limit)) {
        query = query.limit(limit!);
    }

    const legacyRows: LegacyRow[] = await query.orderBy('created_at', 'asc').execute();

    if (!legacyRows.length) {
        console.log('[Migration] No legacy jsondocs found. Nothing to do.');
        return;
    }

    console.log(`[Migration] Found ${legacyRows.length} legacy jsondocs to process.`);

    let processed = 0;
    let skipped = 0;
    const createdIds: string[] = [];

    for (const row of legacyRows) {
        // 2) Idempotency: check human_transforms where source_jsondoc_id = row.id and transform_name = 'rename_schema_type'
        const existing = await db
            .selectFrom('human_transforms as ht')
            .selectAll()
            .where('ht.source_jsondoc_id', '=', row.id)
            .where('ht.transform_name', '=', 'rename_schema_type')
            .executeTakeFirst();

        if (existing) {
            skipped += 1;
            console.log(`[Migration] Skip already-migrated jsondoc ${row.id} (project ${row.project_id}).`);
            continue;
        }

        // 3) Parse data/metadata
        let data: any;
        try {
            data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        } catch (e) {
            console.warn(`[Migration] Invalid JSON in data for ${row.id}, skipping:`, e);
            skipped += 1;
            continue;
        }

        const metadata: any = row.metadata ? safeParseJson(row.metadata) : null;

        if (dryRun) {
            processed += 1;
            console.log(`[Migration][DRY-RUN] Would create new '${newType}' for ${row.id} (project ${row.project_id}).`);
            continue;
        }

        try {
            // 4) Create transform (human, completed)
            const transform = await transformRepo.createTransform(
                row.project_id,
                'human',
                'v1',
                'completed',
                {
                    transform_name: 'rename_schema_type',
                    reason: 'Schema type rename migration',
                    from_schema_type: oldType,
                    to_schema_type: newType,
                    source_jsondoc_id: row.id,
                    timestamp: new Date().toISOString(),
                }
            );

            // 5) Create new jsondoc with new schema_type; validate via repository
            const newJsondoc = await jsondocRepo.createJsondoc(
                row.project_id,
                newType as any,
                data,
                'v1',
                {
                    ...(metadata || {}),
                    transform_name: 'rename_schema_type',
                    migration_from_schema_type: oldType,
                    migration_from_jsondoc_id: row.id,
                },
                'completed',
                'user_input'
            );

            // 6) Link inputs/outputs
            await transformRepo.addTransformInputs(transform.id, [
                { jsondocId: row.id, inputRole: 'source_rename' },
            ], row.project_id);

            await transformRepo.addTransformOutputs(transform.id, [
                { jsondocId: newJsondoc.id, outputRole: 'migrated_rename' },
            ], row.project_id);

            // 7) Record human transform details for lineage clarity
            await transformRepo.addHumanTransform({
                transform_id: transform.id,
                action_type: 'rename',
                interface_context: { from: oldType, to: newType },
                change_description: `Rename schema_type ${oldType} -> ${newType}`,
                source_jsondoc_id: row.id,
                derivation_path: '',
                derived_jsondoc_id: newJsondoc.id,
                transform_name: 'rename_schema_type',
                project_id: row.project_id,
            });

            processed += 1;
            createdIds.push(newJsondoc.id);
            console.log(`[Migration] Migrated ${row.id} -> ${newJsondoc.id} (project ${row.project_id}).`);
        } catch (err) {
            console.error(`[Migration] Failed to migrate ${row.id} (project ${row.project_id}):`, err);
            // Continue with others
        }
    }

    console.log(`[Migration] Done. Processed=${processed} Skipped=${skipped} Created=${createdIds.length}`);
}

function safeParseJson(s: string): any | null {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

main()
    .catch((err) => {
        console.error('[Migration] Unhandled error:', err);
    })
    .finally(async () => {
        try {
            // Ensure the pool drains
            // @ts-ignore - access to private pool for cleanup (acceptable for scripts)
            const pool = db.getExecutor()?.adapter?.pool;
            if (pool && typeof pool.end === 'function') {
                await pool.end();
            }
        } catch { }
        process.exit(0);
    });


