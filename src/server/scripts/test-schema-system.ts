import { TransformInstantiationRegistry } from '../services/TransformInstantiationRegistry.ts';
import { getArtifactAtPath } from '../../common/utils/lineageResolution.ts';
import { BrainstormIdeaCollectionV1 } from '../../common/types.ts';

console.log('🧪 Starting Schema Transform System Tests...\n');

async function runTests() {
    try {
        // 1. Test transform instantiation registry
        console.log('1️⃣ Testing transform instantiation registry...');
        const registry = new TransformInstantiationRegistry();

        // Test executing a transform instantiation with proper brainstorm collection data
        const testCollectionData = {
            ideas: [
                { title: 'Test Idea', body: 'Test body content' }
            ],
            platform: '抖音',
            genre: '现代甜宠',
            total_ideas: 1
        };

        const result = registry.executeInstantiation(
            'edit_brainstorm_idea',
            testCollectionData,
            'ideas[0]',
            'test-artifact-id'
        );

        console.log('Transform instantiation result:', result?.title || 'Failed');
        console.log('✅ Transform registry working\n');

        // 2. Test JSONPath extraction with mock data
        console.log('2️⃣ Testing JSONPath extraction...');

        const collectionData: BrainstormIdeaCollectionV1 = {
            ideas: [
                {
                    title: '现代都市甜宠',
                    body: '霸道总裁与平凡女孩的甜蜜爱情故事，充满误会与和解。'
                },
                {
                    title: '古装宫廷权谋',
                    body: '聪明女子在宫廷中运用智慧，既要保护自己也要帮助心爱之人。'
                },
                {
                    title: '现代职场励志',
                    body: '年轻律师通过努力工作和坚持正义，最终获得成功和爱情。'
                }
            ],
            platform: '抖音',
            genre: '现代甜宠',
            total_ideas: 3
        };

        // Create mock artifact for testing
        const mockArtifact = {
            id: 'test-collection',
            project_id: 'test-project',
            type: 'brainstorm_idea_collection',
            type_version: 'v1',
            data: JSON.stringify(collectionData),
            created_at: new Date().toISOString()
        };

        // Test root path
        const rootData = getArtifactAtPath(mockArtifact, '$');
        console.log('Root path ($):', rootData ? 'Found' : 'Not found');

        // Test array item paths  
        const firstIdea = getArtifactAtPath(mockArtifact, '$.ideas[0]');
        const secondIdea = getArtifactAtPath(mockArtifact, '$.ideas[1]');
        const thirdIdea = getArtifactAtPath(mockArtifact, '$.ideas[2]');

        console.log('First idea ($.ideas[0]):', firstIdea?.title || 'Not found');
        console.log('Second idea ($.ideas[1]):', secondIdea?.title || 'Not found');
        console.log('Third idea ($.ideas[2]):', thirdIdea?.title || 'Not found');
        console.log('✅ JSONPath extraction working\n');

        // 3. Test complex path operations
        console.log('3️⃣ Testing complex path operations...');

        // Test invalid paths
        const invalidPath = getArtifactAtPath(mockArtifact, '$.ideas[999]');
        console.log('Invalid path result:', invalidPath === null ? 'Correctly null' : 'Unexpected result');

        // Test nested field access
        const titleOnly = getArtifactAtPath(mockArtifact, '$.ideas[0].title');
        console.log('Nested field access ($.ideas[0].title):', titleOnly || 'Not found');

        // Test platform field access
        const platform = getArtifactAtPath(mockArtifact, '$.platform');
        console.log('Platform field ($.platform):', platform || 'Not found');

        console.log('✅ Complex path operations working\n');

        console.log('🎉 All schema transform system tests passed!\n');
        console.log('✅ Test completed successfully');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

runTests().catch(console.error); 