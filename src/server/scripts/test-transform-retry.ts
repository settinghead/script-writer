import { StreamingTransformExecutor } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { OutlineSettingsInputSchema, OutlineSettingsOutputSchema } from '../../common/schemas/outlineSchemas';
import { db } from '../database/connection';

async function testTransformRetry() {
    console.log('🧪 Testing transform retry mechanism...');
    const transformRepo = new TransformRepository(db);
    const jsondocRepo = new JsondocRepository(db);

    const projectId = 'test-project-123';
    const userId = 'test-user-1';

    // Create a mock config that will fail schema validation
    const config = {
        templateName: 'outline_settings',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsOutputSchema,
        prepareTemplateVariables: (input: any) => ({
            params: {
                userInput: 'Test story idea',
                totalEpisodes: '60',
                episodeInfo: '总共60集，每集2分钟',
                platform: '抖音',
                genre: '现代甜宠',
                requirements: '无特殊要求'
            },
            jsondocs: {}
        }),
        // Mock LLM output that will fail schema validation (missing required fields)
        transformLLMOutput: (llmOutput: any, input: any) => ({
            title: 'Test Title',
            // Missing required fields like genre, target_audience, etc.
        })
    };

    const input = {
        sourceJsondocId: 'test-jsondoc-123',
        title: 'Test Outline',
        requirements: 'Test requirements'
    };

    const executor = new StreamingTransformExecutor();

    try {
        const result = await executor.executeStreamingTransform({
            config,
            input,
            projectId,
            userId,
            transformRepo,
            jsondocRepo,
            outputJsondocType: 'outline_settings',
            transformMetadata: {
                test: true
            }
        });

        console.log('❌ Test failed - should have thrown an error due to schema validation failure');
        console.log('Result:', result);

    } catch (error) {
        console.log('✅ Test passed - transform correctly failed after retries');
        console.log('Error:', error instanceof Error ? error.message : String(error));

        // Check if the transform was marked as failed in the database
        const transforms = await transformRepo.getProjectTransforms(projectId, 10);
        const failedTransform = transforms.find(t => t.status === 'failed');

        if (failedTransform) {
            console.log('✅ Transform correctly marked as failed in database');
            console.log('Retry count:', failedTransform.retry_count);
            console.log('Execution context:', failedTransform.execution_context);
        } else {
            console.log('❌ Transform not found or not marked as failed');
        }
    }
}

// Run the test
testTransformRetry().catch(console.error); 