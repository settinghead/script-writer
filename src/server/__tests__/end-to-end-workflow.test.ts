import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineToolDefinition } from '../tools/OutlineTool';
import { createMockArtifactRepository, createMockTransformRepository } from '../../__tests__/mocks/databaseMocks';

describe('End-to-End Workflow Integration', () => {
    let mockTransformRepo: any;
    let mockArtifactRepo: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockArtifactRepo = createMockArtifactRepository();

        // Setup sequential artifact creation with unique IDs
        let artifactCounter = 1;
        mockArtifactRepo.createArtifact.mockImplementation(() => ({
            id: `artifact-${artifactCounter++}-${Date.now()}-${Math.random()}`
        }));

        let transformCounter = 1;
        mockTransformRepo.createTransform.mockImplementation(() => ({
            id: `transform-${transformCounter++}-${Date.now()}-${Math.random()}`
        }));
    });

    it('should complete full brainstorm → edit → outline workflow', async () => {
        // Step 1: Generate brainstorm ideas
        console.log('🧪 Testing BrainstormTool with streaming framework...');

        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            {
                enableCaching: true,
                seed: 12345,  // Fixed seed for reproducible results
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 4000
            }
        );

        const brainstormInput = {
            platform: '抖音',
            genre: '现代甜宠',
            other_requirements: '快节奏，高颜值主角',
            numberOfIdeas: 3
        };

        const brainstormResult = await brainstormTool.execute(brainstormInput, { toolCallId: 'test-brainstorm' });

        expect(brainstormResult.outputArtifactId).toBeTruthy();
        expect(brainstormResult.finishReason).toBe('stop');

        // Verify the artifact was created
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
        expect(mockTransformRepo.createTransform).toHaveBeenCalled();

        // Step 2: Mock the brainstorm artifact for editing
        const mockBrainstormIdea = {
            id: brainstormResult.outputArtifactId,
            type: 'brainstorm_idea',
            project_id: 'test-project-1',
            data: {
                title: '误爱成宠',
                body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金，开启了一段错综复杂的爱恋故事。在商业精英的世界里，误解与真情交织，最终真爱战胜一切。'
            },
            schema_type: 'brainstorm_idea',
            schema_version: '1.0',
            origin_type: 'ai_generated'
        };

        // Step 3: Edit the first brainstorm idea
        console.log('🧪 Testing BrainstormEditTool with streaming framework...');

        const editTool = createBrainstormEditToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            {
                enableCaching: true,
                seed: 23456,  // Different seed for different operations
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 2000
            }
        );

        // Setup mock to return the brainstorm idea
        mockArtifactRepo.getArtifact.mockResolvedValue(mockBrainstormIdea);

        const editInput = {
            sourceArtifactId: brainstormResult.outputArtifactId,
            editRequirements: '让故事更加现代化，增加科技元素',
            agentInstructions: '保持原有的情感核心，但加入现代科技背景'
        };

        const editResult = await editTool.execute(editInput, { toolCallId: 'test-edit' });

        expect(editResult.outputArtifactId).toBeTruthy();
        expect(editResult.finishReason).toBe('stop');

        // Step 4: Mock the edited brainstorm idea for outline generation
        const mockEditedIdea = {
            id: editResult.outputArtifactId,
            type: 'brainstorm_idea',
            project_id: 'test-project-1',
            data: {
                title: '误爱成宠（科技版）',
                body: '在AI和大数据主导的现代商业世界里，林氏科技集团总裁林慕琛利用先进的人脸识别系统误将普通程序员夏栀识别为富家千金。这个技术错误引发了一段充满现代科技色彩的爱恋故事...'
            },
            schema_type: 'brainstorm_idea',
            schema_version: '1.0',
            origin_type: 'ai_generated',
            metadata: {
                derived_data: {
                    title: '误爱成宠（科技版）',
                    body: '在AI和大数据主导的现代商业世界里，林氏科技集团总裁林慕琛利用先进的人脸识别系统误将普通程序员夏栀识别为富家千金。这个技术错误引发了一段充满现代科技色彩的爱恋故事...'
                },
                original_artifact_id: brainstormResult.outputArtifactId,
                edit_requirements: '让故事更加现代化，增加科技元素'
            }
        };

        // Step 5: Generate outline from edited idea
        console.log('🧪 Testing OutlineTool with streaming framework...');

        const outlineTool = createOutlineToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            {
                enableCaching: true,
                seed: 34567,  // Different seed for different operations
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 6000
            }
        );

        // Update mock to return the edited idea when outline tool requests it
        mockArtifactRepo.getArtifact.mockImplementation((artifactId: string) => {
            if (artifactId === editResult.outputArtifactId) {
                return Promise.resolve(mockEditedIdea);
            }
            return Promise.resolve(null);
        });

        const outlineInput = {
            sourceArtifactId: editResult.outputArtifactId,
            totalEpisodes: 12,
            episodeDuration: 3,
            selectedPlatform: '抖音',
            selectedGenrePaths: [['现代', '甜宠', '都市']],
            requirements: '高颜值演员，快节奏剧情，科技感强'
        };

        const outlineResult = await outlineTool.execute(outlineInput, { toolCallId: 'test-outline' });

        expect(outlineResult.outputArtifactId).toBeTruthy();
        expect(outlineResult.finishReason).toBe('stop');

        // Step 6: Verify the complete workflow
        console.log('✅ Complete workflow validation');

        // Verify all artifacts are different (showing progression)
        expect(brainstormResult.outputArtifactId).not.toBe(editResult.outputArtifactId);
        expect(editResult.outputArtifactId).not.toBe(outlineResult.outputArtifactId);
        expect(brainstormResult.outputArtifactId).not.toBe(outlineResult.outputArtifactId);

        // Verify repository calls were made for each step (streaming executor creates additional internal artifacts)
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
        expect(mockTransformRepo.createTransform).toHaveBeenCalled();

        // Verify all three steps completed successfully
        expect(brainstormResult.outputArtifactId).toBeTruthy();
        expect(editResult.outputArtifactId).toBeTruthy();
        expect(outlineResult.outputArtifactId).toBeTruthy();

        console.log(`✅ Workflow completed: ${brainstormResult.outputArtifactId} → ${editResult.outputArtifactId} → ${outlineResult.outputArtifactId}`);
    });

    it('should handle caching configuration correctly', async () => {
        // Test that different caching configurations work
        const brainstormTool1 = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            {
                enableCaching: true,
                seed: 12345,
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 4000
            }
        );

        const brainstormTool2 = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            {
                enableCaching: false,  // Different caching setting
                seed: 54321,           // Different seed
                temperature: 0.5,      // Different temperature
                topP: 0.8,            // Different top-p
                maxTokens: 2000       // Different max tokens
            }
        );

        const input = {
            platform: 'YouTube',
            genre: '悬疑',
            other_requirements: '反转剧情',
            numberOfIdeas: 3
        };

        // Both tools should work with different configurations
        const result1 = await brainstormTool1.execute(input, { toolCallId: 'test-cache-1' });
        const result2 = await brainstormTool2.execute(input, { toolCallId: 'test-cache-2' });

        expect(result1.outputArtifactId).toBeTruthy();
        expect(result1.finishReason).toBe('stop');
        expect(result2.outputArtifactId).toBeTruthy();
        expect(result2.finishReason).toBe('stop');

        // Results should be different (different artifacts)
        expect(result1.outputArtifactId).not.toBe(result2.outputArtifactId);
    });

    it('should validate tool definitions are created with correct parameters', () => {
        // Test that all tool definitions are created successfully with various configurations
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: true }
        );

        const editTool = createBrainstormEditToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );

        const outlineTool = createOutlineToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: true }
        );

        // Verify all tools are properly defined
        expect(brainstormTool).toBeDefined();
        expect(brainstormTool.execute).toBeInstanceOf(Function);
        expect(brainstormTool.name).toBe('generate_brainstorm_ideas');

        expect(editTool).toBeDefined();
        expect(editTool.execute).toBeInstanceOf(Function);
        expect(editTool.name).toBe('edit_brainstorm_idea');

        expect(outlineTool).toBeDefined();
        expect(outlineTool.execute).toBeInstanceOf(Function);
        expect(outlineTool.name).toBe('generate_outline');
    });
}); 