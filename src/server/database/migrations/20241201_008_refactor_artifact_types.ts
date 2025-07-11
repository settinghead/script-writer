import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    // Step 1: Add new columns
    await db.schema
        .alterTable('artifacts')
        .addColumn('schema_type', 'text')
        .addColumn('schema_version', 'text')
        .addColumn('origin_type', 'text')
        .execute()

    // Step 2: Migrate existing data
    // Copy type → schema_type and type_version → schema_version
    await db
        .updateTable('artifacts')
        .set({
            schema_type: sql`type`,
            schema_version: sql`type_version`
        })
        .execute()

    // Step 3: Set origin_type based on existing data patterns
    // - 'user_input' types are user_input
    // - Everything else is ai_generated
    await db
        .updateTable('artifacts')
        .set({ origin_type: 'user_input' })
        .where('type', '=', 'user_input')
        .execute()

    await db
        .updateTable('artifacts')
        .set({ origin_type: 'ai_generated' })
        .where('type', '!=', 'user_input')
        .execute()

    // Step 4: Update schema type names to be clearer
    await db
        .updateTable('artifacts')
        .set({ schema_type: 'brainstorm_idea' })
        .where('schema_type', '=', 'brainstorm_idea')
        .execute()

    await db
        .updateTable('artifacts')
        .set({ schema_type: 'brainstorm_collection' })
        .where('schema_type', '=', 'brainstorm_idea_collection')
        .execute()


    await db
        .updateTable('artifacts')
        .set({ schema_type: 'brainstorm_input_params' })
        .where('schema_type', '=', 'brainstorm_input_params')
        .execute()



    await db
        .updateTable('artifacts')
        .set({ schema_type: 'outline_settings' })
        .where('schema_type', '=', 'outline_setting')
        .execute()




    // Step 5: Make new columns non-null now that they're populated  
    await db.schema
        .alterTable('artifacts')
        .alterColumn('schema_type', (col) => col.setNotNull())
        .alterColumn('schema_version', (col) => col.setNotNull())
        .alterColumn('origin_type', (col) => col.setNotNull())
        .execute()

    // Step 6: Create indexes for performance
    await db.schema
        .createIndex('artifacts_schema_type_idx')
        .on('artifacts')
        .column('schema_type')
        .execute()

    await db.schema
        .createIndex('artifacts_origin_type_idx')
        .on('artifacts')
        .column('origin_type')
        .execute()

    // Note: We'll keep the old columns for now to ensure compatibility
    // They can be dropped in a future migration once all code is updated
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop the new columns and indexes
    await db.schema
        .dropIndex('artifacts_schema_type_idx')
        .execute()

    await db.schema
        .dropIndex('artifacts_origin_type_idx')
        .execute()

    await db.schema
        .alterTable('artifacts')
        .dropColumn('schema_type')
        .dropColumn('schema_version')
        .dropColumn('origin_type')
        .execute()
} 