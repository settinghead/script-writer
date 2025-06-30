import { describe, it, expect, beforeEach } from 'vitest';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { createOutlineToolDefinition } from '../tools/OutlineTool';
import { createMockArtifactRepository, createMockTransformRepository } from '../../__tests__/mocks/databaseMocks';

describe('Streaming Workflow Integration', () => {
    let mockTransformRepo: any;
    let mockArtifactRepo: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockArtifactRepo = createMockArtifactRepository();

        // Setup mock responses
        mockArtifactRepo.createArtifact.mockImplementation(() => ({
            id: `artifact-${Date.now()}-${Math.random()}`
        }));
        mockTransformRepo.createTransform.mockImplementation(() => ({
            id: `transform-${Date.now()}-${Math.random()}`
        }));
    });

    it('should complete brainstorm -> outline workflow using cached responses', async () => {
        // Step 1: Generate brainstorm ideas
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );

        const brainstormResult = await brainstormTool.execute({
            platform: '抖音',
            genre: '现代甜宠',
            other_requirements: '快节奏，高颜值主角'
        }, { toolCallId: 'brainstorm-1' });

        expect(brainstormResult.outputArtifactId).toBeTruthy();

        // Setup mock to return the brainstorm artifact when outline tool requests it
        mockArtifactRepo.getArtifact.mockResolvedValue({
            id: brainstormResult.outputArtifactId,
            type: 'brainstorm_idea',
            project_id: 'test-project-1',
            data: {
                title: '误爱成宠',
                body: '霸道总裁林慕琛因一场误会将普通职员夏栀认作富家千金，开启了一段错综复杂的爱恋故事。在商业精英的世界里，误解与真情交织，最终真爱战胜一切。'
            },
            schema_type: 'brainstorm_idea',
            schema_version: '1.0',
            origin_type: 'ai_generated'
        });

        // Step 2: Generate outline from brainstorm
        const outlineTool = createOutlineToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );

        const outlineResult = await outlineTool.execute({
            sourceArtifactId: brainstormResult.outputArtifactId,
            totalEpisodes: 12,
            episodeDuration: 3,
            selectedPlatform: '抖音',
            selectedGenrePaths: [['现代', '甜宠', '都市']],
            requirements: '高颜值演员，快节奏剧情'
        }, { toolCallId: 'outline-1' });

        expect(outlineResult.outputArtifactId).toBeTruthy();
        expect(outlineResult.finishReason).toBe('stop');
    });

    it('should handle brainstorm tool execution with caching disabled', async () => {
        // Arrange
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false, seed: 12345, temperature: 0.7 }
        );

        const input = {
            platform: '抖音',
            genre: '现代甜宠',
            other_requirements: '快节奏，高颜值主角'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-brainstorm' });

        // Assert
        expect(result.outputArtifactId).toBeTruthy();
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
        expect(mockTransformRepo.createTransform).toHaveBeenCalled();
    });

    it('should handle outline tool execution with proper inputs', async () => {
        // Arrange
        // Setup mock to return source artifact when requested
        mockArtifactRepo.getArtifact.mockResolvedValue({
            id: 'test-brainstorm-artifact',
            type: 'brainstorm_idea',
            project_id: 'test-project-1',
            data: JSON.stringify({ title: 'Test Idea', body: 'Test content' }),
            schema_type: 'brainstorm_idea',
            schema_version: '1.0',
            origin_type: 'ai_generated'
        });

        const outlineTool = createOutlineToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false, seed: 23456, temperature: 0.7 }
        );

        const input = {
            sourceArtifactId: 'test-brainstorm-artifact',
            totalEpisodes: 12,
            episodeDuration: 3,
            selectedPlatform: '抖音',
            selectedGenrePaths: [['现代', '甜宠', '都市']],
            requirements: '高颜值演员，快节奏剧情'
        };

        // Act
        const result = await outlineTool.execute(input, { toolCallId: 'test-outline' });

        // Assert
        expect(result.outputArtifactId).toBeTruthy();
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
        expect(mockTransformRepo.createTransform).toHaveBeenCalled();
    });

    it('should verify tool definitions are created with correct parameters', () => {
        // Test that tool definitions are created successfully
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: true }
        );

        const outlineTool = createOutlineToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: true }
        );

        expect(brainstormTool).toBeDefined();
        expect(brainstormTool.execute).toBeInstanceOf(Function);
        expect(outlineTool).toBeDefined();
        expect(outlineTool.execute).toBeInstanceOf(Function);
    });
}); 