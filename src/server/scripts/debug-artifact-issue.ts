import { db } from '../database/connection.ts';

async function debugArtifactIssue() {
  console.log('=== All Artifacts ===');
  const artifacts = await db.selectFrom('artifacts').selectAll().execute();
  artifacts.forEach(a => {
    console.log(`ID: ${a.id}`);
    console.log(`Type: ${a.type}`);
    console.log(`User ID: ${a.user_id}`);
    console.log(`Created: ${a.created_at}`);
    console.log('---');
  });

  console.log('\n=== All Human Transforms ===');
  const transforms = await db.selectFrom('human_transforms').selectAll().execute();
  transforms.forEach(t => {
    console.log(`ID: ${t.id}`);
    console.log(`Source: ${t.source_artifact_id}`);
    console.log(`Target: ${t.target_artifact_id}`);
    console.log(`Path: ${t.derivation_path}`);
    console.log(`Transform: ${t.transform_name}`);
    console.log('---');
  });

  console.log('\n=== Looking for specific artifact: d7a2b58f-757d-4ed9-b067-8a06d9926d18 ===');
  const specificArtifact = await db
    .selectFrom('artifacts')
    .selectAll()
    .where('id', '=', 'd7a2b58f-757d-4ed9-b067-8a06d9926d18')
    .executeTakeFirst();
  
  if (specificArtifact) {
    console.log('Found artifact:', specificArtifact);
  } else {
    console.log('Artifact not found in database');
  }

  console.log('\n=== Looking for transforms involving this artifact ===');
  const relatedTransforms = await db
    .selectFrom('human_transforms')
    .selectAll()
    .where(eb => eb.or([
      eb('source_artifact_id', '=', 'd7a2b58f-757d-4ed9-b067-8a06d9926d18'),
      eb('target_artifact_id', '=', 'd7a2b58f-757d-4ed9-b067-8a06d9926d18')
    ]))
    .execute();
  
  console.log('Related transforms:', relatedTransforms);
}

debugArtifactIssue().catch(console.error).finally(() => process.exit(0)); 