import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBrainstormEditToolDefinition } from '../BrainstormTools';
import { createMockArtifactRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';

describe('BrainstormEditTool', () => {
    let mockTransformRepo: any;
    let mockArtifactRepo: any;
    let brainstormEditTool: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockArtifactRepo = createMockArtifactRepository();

        brainstormEditTool = createBrainstormEditToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );
    });

    it('should edit brainstorm ideas using cached LLM responses', async () => {
        // Arrange
        mockArtifactRepo.createArtifact.mockResolvedValue({ id: 'new-edit-artifact-1' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-edit-transform-1' });

        // Mock source artifact (single brainstorm idea for editing)
        mockArtifactRepo.getArtifact.mockResolvedValue({
            id: 'source-brainstorm-collection',
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

        const input = {
            sourceArtifactId: 'source-brainstorm-collection',
            editRequirements: '让故事更加现代化，增加科技元素',
            agentInstructions: '保持原有的情感核心，但加入现代科技背景'
        };

        // Act
        const result = await brainstormEditTool.execute(input, { toolCallId: 'test-edit-1' });

        // Assert
        expect(result.outputArtifactId).toBe('new-edit-artifact-1');
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
        expect(mockArtifactRepo.getArtifact).toHaveBeenCalledWith('source-brainstorm-collection');
    });

    it('should handle different edit requirements', async () => {
        // Arrange
        mockArtifactRepo.createArtifact.mockResolvedValue({ id: 'new-edit-artifact-2' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-edit-transform-2' });

        // Mock source artifact (single brainstorm idea)
        mockArtifactRepo.getArtifact.mockResolvedValue({
            id: 'source-brainstorm-idea',
            type: 'brainstorm_idea',
            project_id: 'test-project-1',
            data: {
                title: '误爱成宠',
                body: '霸道总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
            },
            schema_type: 'brainstorm_idea',
            schema_version: '1.0',
            origin_type: 'ai_generated'
        });

        const input = {
            sourceArtifactId: 'source-brainstorm-idea',
            editRequirements: '增加悬疑元素，让故事更有张力',
            agentInstructions: '保持甜宠基调，但加入悬疑情节'
        };

        // Act
        const result = await brainstormEditTool.execute(input, { toolCallId: 'test-edit-2' });

        // Assert
        expect(result.outputArtifactId).toBe('new-edit-artifact-2');
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
    });

    it('should validate input parameters correctly', () => {
        // Test that the tool definition has the expected structure
        expect(brainstormEditTool).toBeDefined();
        expect(brainstormEditTool.execute).toBeInstanceOf(Function);
        expect(brainstormEditTool.name).toBe('edit_brainstorm_idea');
        expect(brainstormEditTool.description).toBeDefined();
        expect(brainstormEditTool.inputSchema).toBeDefined();
    });

    it('should handle missing source artifact errors', async () => {
        // Arrange
        mockArtifactRepo.getArtifact.mockResolvedValue(null);

        const input = {
            sourceArtifactId: 'non-existent-artifact',
            editRequirements: '改进故事'
        };

        // Act & Assert
        await expect(brainstormEditTool.execute(input, { toolCallId: 'test-error' }))
            .rejects.toThrow('Source artifact not found');
    });


}); 