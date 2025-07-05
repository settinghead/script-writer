import { describe, it, expect, beforeEach, } from 'vitest';
import { createBrainstormToolDefinition } from '../BrainstormTools';
import { createMockArtifactRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';

describe('BrainstormTool', () => {
    let mockTransformRepo: any;
    let mockArtifactRepo: any;
    let brainstormTool: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockArtifactRepo = createMockArtifactRepository();

        // Setup mock getArtifact to return proper brainstorm input artifact
        mockArtifactRepo.getArtifact.mockImplementation(async (id: string) => {
            if (id === 'test-brainstorm-input-1' || id === 'test-brainstorm-input-2') {
                return {
                    id: id,
                    project_id: 'test-project-1',
                    type: 'brainstorm_tool_input_schema',
                    data: {
                        platform: '抖音',
                        genre: '现代甜宠',
                        other_requirements: '快节奏，高颜值主角',
                        numberOfIdeas: 3
                    },
                    schema_type: 'brainstorm_tool_input_schema',
                    origin_type: 'user_input'
                };
            }
            return null;
        });

        brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false } // Disable caching for predictable tests
        );
    });

    it('should generate brainstorm ideas using cached LLM responses', async () => {
        // Arrange
        mockArtifactRepo.createArtifact.mockResolvedValue({ id: 'new-artifact-1' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-1' });

        const input = {
            sourceArtifactId: 'test-brainstorm-input-1'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-1' });

        // Assert
        expect(result.outputArtifactId).toBe('new-artifact-1');
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
    });

    it('should handle different platform inputs', async () => {
        // Arrange
        mockArtifactRepo.createArtifact.mockResolvedValue({ id: 'new-artifact-2' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-2' });

        // Setup different input data
        mockArtifactRepo.getArtifact.mockImplementation(async (id: string) => {
            if (id === 'test-brainstorm-input-2') {
                return {
                    id: id,
                    project_id: 'test-project-1',
                    type: 'brainstorm_tool_input_schema',
                    data: {
                        platform: 'YouTube',
                        genre: '悬疑',
                        other_requirements: '反转剧情',
                        numberOfIdeas: 3
                    },
                    schema_type: 'brainstorm_tool_input_schema',
                    origin_type: 'user_input'
                };
            }
            return null;
        });

        const input = {
            sourceArtifactId: 'test-brainstorm-input-2'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-2' });

        // Assert
        expect(result.outputArtifactId).toBe('new-artifact-2');
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
    });

    it('should validate input parameters correctly', () => {
        // Test that the tool definition has the expected structure
        expect(brainstormTool).toBeDefined();
        expect(brainstormTool.execute).toBeInstanceOf(Function);
        expect(brainstormTool.name).toBeDefined();
        expect(brainstormTool.description).toBeDefined();
        expect(brainstormTool.inputSchema).toBeDefined();
    });

    it('should handle repository errors gracefully', async () => {
        // Arrange - Mock all repository methods to throw errors
        mockArtifactRepo.getArtifact.mockRejectedValue(new Error('Database error'));
        mockArtifactRepo.createArtifact.mockRejectedValue(new Error('Database error'));
        mockTransformRepo.createTransform.mockRejectedValue(new Error('Database error'));
        mockTransformRepo.addTransformInputs.mockRejectedValue(new Error('Database error'));

        const input = {
            sourceArtifactId: 'test-brainstorm-input-1'
        };

        // Act & Assert
        await expect(brainstormTool.execute(input, { toolCallId: 'test-error' }))
            .rejects.toThrow('Database error');
    });
}); 