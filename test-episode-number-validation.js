const { ScriptGenerationService } = require('./dist-server/server/services/ScriptGenerationService.js');
const { ArtifactRepository } = require('./dist-server/server/repositories/ArtifactRepository.js');
const { TransformRepository } = require('./dist-server/server/repositories/TransformRepository.js');
const { StreamingTransformExecutor } = require('./dist-server/server/services/streaming/StreamingTransformExecutor.js');
const { TemplateService } = require('./dist-server/server/services/templates/TemplateService.js');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('ideations.db');
const artifactRepo = new ArtifactRepository(db);
const transformRepo = new TransformRepository(db);
const templateService = new TemplateService();
const streamingExecutor = new StreamingTransformExecutor(artifactRepo, transformRepo, templateService);
const scriptService = new ScriptGenerationService(artifactRepo, transformRepo, streamingExecutor, templateService);

async function testScriptGeneration() {
  try {
    console.log('Testing script generation with episode 2...');
    const result = await scriptService.generateScript('test-user-xiyang', '2', 'ef6d30ee-88be-4a1e-a7ca-65db60756ece');
    console.log('Script generation started:', result);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.close();
  }
}

testScriptGeneration(); 