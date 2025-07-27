import { describe, it, expect, beforeEach, } from 'vitest';
import { createBrainstormToolDefinition } from '../BrainstormGenerationTool';
import { createMockTransformJsondocRepository } from '../../../__tests__/mocks/databaseMocks';
import { TypedJsondoc } from '@/common/types';
import { IdeationInput } from '@/common/transform_schemas';

describe('BrainstormTool', () => {
    let mockTransformRepo: any;
    let mockJsondocRepo: any;
    let brainstormTool: ReturnType<typeof createBrainstormToolDefinition>;

    beforeEach(() => {
        mockTransformRepo = createMockTransformJsondocRepository();
        mockJsondocRepo = createMockTransformJsondocRepository();

        // Setup mock getJsondoc to return proper brainstorm input jsondoc
        mockJsondocRepo.getJsondoc.mockImplementation(async (id: string) => {
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
                    schema_type: 'brainstorm_input_params' as TypedJsondoc['schema_type'],
                    schema_version: 'v1',
                    origin_type: 'user_input' as TypedJsondoc['origin_type']
                };
            }
            return null;
        });

        brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockJsondocRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false } // Disable caching for predictable tests
        );
    });

    it('should generate brainstorm ideas using cached LLM responses', async () => {
        // Arrange
        mockJsondocRepo.createJsondoc.mockResolvedValue({ id: 'new-jsondoc-1' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-1' });

        const input: IdeationInput = {
            brainstormInputJsondocId: 'test-brainstorm-input-1',
            jsondocs: [{
                jsondocId: 'test-context-1',
                description: '上下文参考资料',
                schemaType: 'user_input'
            }],
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-1' });

        // Assert
        expect(result.outputJsondocId).toBe('new-jsondoc-1');
        expect(result.finishReason).toBe('stop');
        expect(mockJsondocRepo.createJsondoc).toHaveBeenCalled();
    });

    it('should handle different platform inputs', async () => {
        // Arrange
        mockJsondocRepo.createJsondoc.mockResolvedValue({ id: 'new-jsondoc-2' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-2' });

        // Setup different input data
        mockJsondocRepo.getJsondoc.mockImplementation(async (id: string) => {
            if (id === 'test-brainstorm-input-2') {
                return {
                    id: id,
                    project_id: 'test-project-1',
                    schema_type: 'brainstorm_input_params' as TypedJsondoc['schema_type'],
                    data: {
                        platform: 'YouTube',
                        genre: '悬疑',
                        other_requirements: '反转剧情',
                        numberOfIdeas: 3
                    },
                    origin_type: 'user_input' as TypedJsondoc['origin_type']
                };
            }
            return null;
        });

        const input: IdeationInput = {
            brainstormInputJsondocId: 'test-brainstorm-input-2',
            jsondocs: [{
                jsondocId: 'test-context-2',
                description: '上下文参考资料',
                schemaType: 'user_input'
            }],
            otherRequirements: '反转剧情'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-2' });

        // Assert
        expect(result.outputJsondocId).toBe('new-jsondoc-2');
        expect(result.finishReason).toBe('stop');
        expect(mockJsondocRepo.createJsondoc).toHaveBeenCalled();
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
        mockJsondocRepo.getJsondoc.mockRejectedValue(new Error('Database error'));
        mockJsondocRepo.createJsondoc.mockRejectedValue(new Error('Database error'));
        mockTransformRepo.createTransform.mockRejectedValue(new Error('Database error'));
        mockTransformRepo.addTransformInputs.mockRejectedValue(new Error('Database error'));

        const input: IdeationInput = {
            brainstormInputJsondocId: 'test-brainstorm-input-1',
            jsondocs: [{
                jsondocId: 'test-context-1',
                description: '上下文参考资料',
                schemaType: 'user_input'
            }],
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act & Assert
        await expect(brainstormTool.execute(input, { toolCallId: 'test-error' }))
            .rejects.toThrow('Database error');
    });

    it('should validate brainstorm input jsondoc schema type', async () => {
        // Arrange - Mock getJsondoc to return wrong schema type
        mockJsondocRepo.getJsondoc.mockImplementation(async (id: string) => {
            if (id === 'test-wrong-schema') {
                return {
                    id: id,
                    project_id: 'test-project-1',
                    data: {
                        platform: '抖音',
                        genre: '现代甜宠',
                        other_requirements: '快节奏',
                        numberOfIdeas: 3
                    },
                    schema_type: 'user_input', // Wrong schema type
                    schema_version: 'v1',
                    origin_type: 'user_input' as TypedJsondoc['origin_type']
                };
            }
            return null;
        });

        const input: IdeationInput = {
            brainstormInputJsondocId: 'test-wrong-schema',
            jsondocs: [{
                jsondocId: 'test-context-1',
                description: '上下文参考资料',
                schemaType: 'user_input'
            }],
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act & Assert
        await expect(brainstormTool.execute(input, { toolCallId: 'test-validation' }))
            .rejects.toThrow("Invalid jsondoc schema type: expected 'brainstorm_input_params', got 'user_input'");
    });

    it('should handle missing brainstorm input jsondoc', async () => {
        // Arrange - Mock getJsondoc to return null
        mockJsondocRepo.getJsondoc.mockImplementation(async (id: string) => {
            if (id === 'non-existent-jsondoc') {
                return null;
            }
            return null;
        });

        const input: IdeationInput = {
            brainstormInputJsondocId: 'non-existent-jsondoc',
            jsondocs: [{
                jsondocId: 'test-context-1',
                description: '上下文参考资料',
                schemaType: 'user_input'
            }],
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act & Assert
        await expect(brainstormTool.execute(input, { toolCallId: 'test-missing' }))
            .rejects.toThrow('Brainstorm input jsondoc not found: non-existent-jsondoc');
    });
}); 