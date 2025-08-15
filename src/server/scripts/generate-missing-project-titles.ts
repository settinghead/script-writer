import { Kysely, SqliteDialect } from 'kysely';
import pg from 'pg';
import { DB } from '../database/types';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { deduceProjectTitle } from '../../common/utils/projectTitleDeduction';

// Uses the same database connection as the app (PostgreSQL)
function createDb(): Kysely<DB> {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/script_writer'
  });
  // @ts-expect-error: Using pg driver with Kysely
  return new Kysely<DB>({ dialect: { createAdapter() { return {} as any; }, createDriver() { return { acquireConnection: async () => ({
    async beginTransaction() {}, async commitTransaction() {}, async rollbackTransaction() {}, async executeQuery(q: any) { return await pool.query(q.sql, q.parameters); }, async release() {}
  }) as any; }, createIntrospector() { return {} as any; }, createQueryCompiler() { return { compileQuery(q: any) { return q; } } as any; } } as any });
}

async function main() {
  const db = createDb();
  const repo = new TransformJsondocRepository(db);

  try {
    const projects = await db.selectFrom('projects').selectAll().execute();
    for (const p of projects as any[]) {
      if (p.project_title_manual_override) continue;

      const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
        repo.getAllProjectJsondocsForLineage(p.id),
        repo.getAllProjectTransformsForLineage(p.id),
        repo.getAllProjectHumanTransformsForLineage(p.id),
        repo.getAllProjectTransformInputsForLineage(p.id),
        repo.getAllProjectTransformOutputsForLineage(p.id)
      ]);

      const lineageGraph = buildLineageGraph(jsondocs as any, transforms as any, humanTransforms as any, transformInputs as any, transformOutputs as any);
      const title = deduceProjectTitle(lineageGraph as any, jsondocs as any);
      if (title && title.trim().length > 0 && title !== p.title) {
        await db.updateTable('projects').set({ title, updated_at: new Date() }).where('id', '=', p.id).execute();
        console.log(`Updated title for project ${p.id}: ${title}`);
      }
    }
  } finally {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


