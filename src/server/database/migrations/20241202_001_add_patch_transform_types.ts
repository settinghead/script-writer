import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    // No schema changes needed for transform.type since it's already TEXT without constraints
    // The new types 'ai_patch' and 'human_patch_approval' can be used directly

    // Create transform change notification function
    await sql`
    CREATE OR REPLACE FUNCTION notify_transform_change()
    RETURNS TRIGGER AS $$
    BEGIN
        PERFORM pg_notify('transform_changed', 
            json_build_object(
                'transform_id', COALESCE(NEW.id, OLD.id),
                'project_id', COALESCE(NEW.project_id, OLD.project_id),
                'type', COALESCE(NEW.type, OLD.type),
                'status', COALESCE(NEW.status, OLD.status),
                'operation', TG_OP,
                'timestamp', extract(epoch from now())
            )::text
        );
        RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db)

    // Create trigger for transform changes
    await sql`
    CREATE TRIGGER transform_change_notify
    AFTER INSERT OR UPDATE OR DELETE ON transforms
    FOR EACH ROW
    EXECUTE FUNCTION notify_transform_change();
  `.execute(db)

    // Create transform_outputs change notification function  
    await sql`
    CREATE OR REPLACE FUNCTION notify_transform_outputs_change()
    RETURNS TRIGGER AS $$
    BEGIN
        PERFORM pg_notify('transform_outputs_changed', 
            json_build_object(
                'transform_id', COALESCE(NEW.transform_id, OLD.transform_id),
                'jsondoc_id', COALESCE(NEW.jsondoc_id, OLD.jsondoc_id),
                'operation', TG_OP,
                'timestamp', extract(epoch from now())
            )::text
        );
        RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db)

    // Create trigger for transform_outputs changes
    await sql`
    CREATE TRIGGER transform_outputs_change_notify
    AFTER INSERT OR UPDATE OR DELETE ON transform_outputs
    FOR EACH ROW
    EXECUTE FUNCTION notify_transform_outputs_change();
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop triggers
    await sql`DROP TRIGGER IF EXISTS transform_change_notify ON transforms`.execute(db)
    await sql`DROP TRIGGER IF EXISTS transform_outputs_change_notify ON transform_outputs`.execute(db)

    // Drop functions
    await sql`DROP FUNCTION IF EXISTS notify_transform_change()`.execute(db)
    await sql`DROP FUNCTION IF EXISTS notify_transform_outputs_change()`.execute(db)
} 