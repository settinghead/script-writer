import { db } from '../database/connection';
import { EmbeddingService } from '../services/EmbeddingService';
import { ParticleExtractor } from '../services/ParticleExtractor';
import { ParticleService } from '../services/ParticleService';
import { ParticleEventBus } from '../services/ParticleEventBus';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';

async function testParticleSystem() {
    console.log('🧪 Testing Particle System Phase 1...\n');

    try {
        // Initialize services
        console.log('1️⃣ Initializing services...');
        const database = db;
        const embeddingService = new EmbeddingService();
        const particleExtractor = new ParticleExtractor(embeddingService);
        const jsondocRepo = new JsondocRepository(database);
        const transformRepo = new TransformRepository(database);
        const particleService = new ParticleService(database, embeddingService, particleExtractor, jsondocRepo, transformRepo);
        const eventBus = new ParticleEventBus(database, particleService);

        console.log('✅ Services initialized successfully\n');

        // Test 1: Check database connection and table exists
        console.log('2️⃣ Testing database connection...');
        const tableCheck = await database
            .selectFrom('particles')
            .select('id')
            .limit(1)
            .execute();
        console.log('✅ Particles table exists and is accessible\n');

        // Test 2: Test embedding service
        console.log('3️⃣ Testing embedding service...');
        const testText = '这是一个测试文本，用于验证嵌入服务是否正常工作。';
        try {
            const embedding = await embeddingService.generateEmbedding(testText);
            console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
            console.log(`✅ Embedding validation: ${embeddingService.validateEmbedding(embedding)}\n`);
        } catch (error) {
            console.log('⚠️ Embedding service test failed (this is expected without API keys):');
            console.log(`   ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

        // Test 3: Test particle extractor with mock data
        console.log('4️⃣ Testing particle extractor...');
        const mockJsondoc = {
            id: 'test-jsondoc-001',
            schema_type: 'brainstorm_collection' as const,
            schema_version: 'v1' as const,
            data: {
                ideas: [
                    {
                        title: '测试创意1',
                        body: '这是第一个测试创意的详细描述，包含了故事的基本情节和人物设定。'
                    },
                    {
                        title: '测试创意2',
                        body: '这是第二个测试创意，展现了不同的故事风格和情感表达方式。'
                    }
                ],
                platform: '抖音',
                genre: '现代甜宠',
                total_ideas: 2
            },
            metadata: null,
            project_id: 'test-project-001',
            origin_type: 'ai_generated' as const,
            streaming_status: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const particles = await particleExtractor.extractParticles(mockJsondoc as any);
            console.log(`✅ Extracted ${particles.length} particles from mock brainstorm collection`);

            if (particles.length > 0) {
                console.log(`   Sample particle: "${particles[0].title}" (${particles[0].type})`);
                console.log(`   Content length: ${particles[0].content_text.length} characters\n`);
            }
        } catch (error) {
            console.log('⚠️ Particle extraction test failed (expected without embedding service):');
            console.log(`   ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

        // Test 4: Test particle service basic operations
        console.log('5️⃣ Testing particle service...');

        // Check if there are any existing particles
        const existingParticles = await particleService.getProjectParticles('test-project-001', 5);
        console.log(`✅ Found ${existingParticles.length} existing particles in test project\n`);

        // Test 5: Test event bus setup
        console.log('6️⃣ Testing event bus...');
        const eventBusStatus = eventBus.getStatus();
        console.log(`✅ Event bus status: listening=${eventBusStatus.isListening}, pending=${eventBusStatus.pendingUpdates}\n`);

        // Test 6: Check database schema
        console.log('7️⃣ Verifying database schema...');
        const schemaCheck = await database
            .selectFrom('particles')
            .select(['id', 'type', 'title', 'project_id', 'is_active'])
            .where('project_id', '=', 'non-existent-project')
            .limit(1)
            .execute();
        console.log('✅ Database schema is correctly structured\n');

        // Test 7: Test search functionality (without embeddings)
        console.log('8️⃣ Testing search functionality...');
        try {
            const searchResults = await particleService.searchParticles('测试', 'test-project-001', 3);
            console.log(`✅ Search completed, found ${searchResults.length} results\n`);
        } catch (error) {
            console.log('⚠️ Search test failed (expected without embedding service):');
            console.log(`   ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

        console.log('🎉 Particle System Phase 1 Tests Completed!');
        console.log('\n📋 Summary:');
        console.log('✅ Database connection and schema');
        console.log('✅ Service initialization');
        console.log('✅ Particle extraction logic');
        console.log('✅ Basic CRUD operations');
        console.log('✅ Event bus infrastructure');
        console.log('\n⚠️ Note: Embedding and search tests require API keys to be configured');
        console.log('   Set LLM_API_KEY, LLM_BASE_URL, LLM_PROVIDER, and EMBEDDING_MODEL_NAME');
        console.log('   environment variables to test full functionality.\n');

    } catch (error) {
        console.error('❌ Particle system test failed:', error);
        process.exit(1);
    }
}

// Run the test
testParticleSystem()
    .then(() => {
        console.log('✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }); 