import db from '../database/connection';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { deduceProjectTitle } from '../../common/utils/projectTitleDeduction';

async function main() {
  const repo = new TransformJsondocRepository(db);

  try {
    const projects = await db.selectFrom('projects').selectAll().execute();
    console.log(`Found ${projects.length} projects to process`);

    for (const p of projects as any[]) {
      console.log(`\nProcessing project ${p.id} (current title: "${p.title}", manual override: ${p.project_title_manual_override})`);

      if (p.project_title_manual_override) {
        console.log(`Skipping project ${p.id} - has manual title override`);
        continue;
      }

      const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
        repo.getAllProjectJsondocsForLineage(p.id),
        repo.getAllProjectTransformsForLineage(p.id),
        repo.getAllProjectHumanTransformsForLineage(p.id),
        repo.getAllProjectTransformInputsForLineage(p.id),
        repo.getAllProjectTransformOutputsForLineage(p.id)
      ]);

      console.log(`Project ${p.id} data: ${jsondocs.length} jsondocs, ${transforms.length} transforms, ${humanTransforms.length} human transforms`);

      const lineageGraph = buildLineageGraph(jsondocs as any, transforms as any, humanTransforms as any, transformInputs as any, transformOutputs as any);
      const title = deduceProjectTitle(lineageGraph as any, jsondocs as any);

      console.log(`Deduced title for project ${p.id}: "${title}" (current: "${p.title}")`);

      if (title && title.trim().length > 0 && title !== p.title) {
        await db.updateTable('projects').set({ title: title, updated_at: new Date() } as any).where('id', '=', p.id).execute();
        console.log(`✅ Updated title for project ${p.id}: "${title}"`);
      } else {
        console.log(`⏭️  No update needed for project ${p.id}`);
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


