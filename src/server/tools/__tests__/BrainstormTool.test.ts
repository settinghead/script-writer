import { describe, it, expect, beforeEach, } from 'vitest';
import { BrainstormEditToolResult, createBrainstormToolDefinition } from '../BrainstormTools';
import { createMockJsonDocRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';
import { TypedJsonDoc } from '@/common/types';
import { IdeationInput } from '@/common/transform_schemas';
import { StreamingToolDefinition } from '@/server/transform-jsonDoc-framework/StreamingAgentFramework';

describe('BrainstormTool', () => {
    let mockTransformRepo: any;
    let mockJsonDocRepo: any;
    let brainstormTool: StreamingToolDefinition<IdeationInput, BrainstormEditToolResult>;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockJsonDocRepo = createMockJsonDocRepository();

        // Setup mock getJsonDoc to return proper brainstorm input jsonDoc
        mockJsonDocRepo.getJsonDoc.mockImplementation(async (id: string) => {
            if (id === 'test-brainstorm-input-1' || id === 'test-brainstorm-input-2') {
                return {
                    id: id,
                    project_id: 'test-project-1',
                    data: {
                        platform: '抖音',
                        genre: '现代甜宠',
                        other_requirements: '快节奏，高颜值主角',
                        numberOfIdeas: 3
                    },
                    schema_type: 'brainstorm_input_params' as TypedJsonDoc['schema_type'],
                    schema_version: 'v1',
                    origin_type: 'user_input' as TypedJsonDoc['origin_type']
                };
            }
            return null;
        });

        brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockJsonDocRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false } // Disable caching for predictable tests
        );
    });

    it('should generate brainstorm ideas using cached LLM responses', async () => {
        // Arrange
        mockJsonDocRepo.createJsonDoc.mockResolvedValue({ id: 'new-jsonDoc-1' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-1' });

        const input: IdeationInput = {
            sourceJsonDocId: 'test-brainstorm-input-1',
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-1' });

        // Assert
        expect(result.outputJsonDocId).toBe('new-jsonDoc-1');
        expect(result.finishReason).toBe('stop');
        expect(mockJsonDocRepo.createJsonDoc).toHaveBeenCalled();
    });

    it('should handle different platform inputs', async () => {
        // Arrange
        mockJsonDocRepo.createJsonDoc.mockResolvedValue({ id: 'new-jsonDoc-2' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-2' });

        // Setup different input data
        mockJsonDocRepo.getJsonDoc.mockImplementation(async (id: string) => {
            if (id === 'test-brainstorm-input-2') {
                return {
                    id: id,
                    project_id: 'test-project-1',
                    schema_type: 'brainstorm_input_params' as TypedJsonDoc['schema_type'],
                    data: {
                        platform: 'YouTube',
                        genre: '悬疑',
                        other_requirements: '反转剧情',
                        numberOfIdeas: 3
                    },
                    origin_type: 'user_input' as TypedJsonDoc['origin_type']
                };
            }
            return null;
        });

        const input: IdeationInput = {
            sourceJsonDocId: 'test-brainstorm-input-2',
            otherRequirements: '反转剧情'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-2' });

        // Assert
        expect(result.outputJsonDocId).toBe('new-jsonDoc-2');
        expect(result.finishReason).toBe('stop');
        expect(mockJsonDocRepo.createJsonDoc).toHaveBeenCalled();
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
        mockJsonDocRepo.getJsonDoc.mockRejectedValue(new Error('Database error'));
        mockJsonDocRepo.createJsonDoc.mockRejectedValue(new Error('Database error'));
        mockTransformRepo.createTransform.mockRejectedValue(new Error('Database error'));
        mockTransformRepo.addTransformInputs.mockRejectedValue(new Error('Database error'));

        const input: IdeationInput = {
            sourceJsonDocId: 'test-brainstorm-input-1',
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act & Assert
        await expect(brainstormTool.execute(input, { toolCallId: 'test-error' }))
            .rejects.toThrow('Database error');
    });
}); 