import { describe, it, expect, beforeEach, } from 'vitest';
import { createBrainstormToolDefinition } from '../BrainstormGenerationTool';
import { createMockJsondocRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';
import { TypedJsondoc } from '@/common/types';
import { IdeationInput } from '@/common/transform_schemas';
import { StreamingToolDefinition } from '@/server/transform-jsondoc-framework/StreamingAgentFramework';

describe('BrainstormTool', () => {
    let mockTransformRepo: any;
    let mockJsondocRepo: any;
    let brainstormTool: ReturnType<typeof createBrainstormToolDefinition>;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockJsondocRepo = createMockJsondocRepository();

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
            jsondocs: [{
                jsondocId: 'test-brainstorm-input-1',
                description: '头脑风暴参数',
                schemaType: 'brainstorm_input_params'
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
            jsondocs: [{
                jsondocId: 'test-brainstorm-input-2',
                description: '头脑风暴参数',
                schemaType: 'brainstorm_input_params'
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
            jsondocs: [{
                jsondocId: 'test-brainstorm-input-1',
                description: '头脑风暴参数',
                schemaType: 'brainstorm_input_params'
            }],
            otherRequirements: '快节奏，高颜值主角'
        };

        // Act & Assert
        await expect(brainstormTool.execute(input, { toolCallId: 'test-error' }))
            .rejects.toThrow('Database error');
    });
}); 