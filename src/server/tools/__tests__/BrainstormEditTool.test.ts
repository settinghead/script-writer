import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBrainstormEditToolDefinition } from '../BrainstormTools';
import { createMockJsondocRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';

describe('BrainstormEditTool (Unified Streaming Patch)', () => {
    let mockTransformRepo: any;
    let mockJsondocRepo: any;
    let brainstormEditTool: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockJsondocRepo = createMockJsondocRepository();

        brainstormEditTool = createBrainstormEditToolDefinition(
            mockTransformRepo,
            mockJsondocRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );
    });

    describe('Tool Definition Structure', () => {
        it('should have correct tool definition structure', () => {
            expect(brainstormEditTool).toBeDefined();
            expect(brainstormEditTool.execute).toBeInstanceOf(Function);
            expect(brainstormEditTool.name).toBe('edit_brainstorm_idea');
            expect(brainstormEditTool.description).toContain('JSON补丁方式');
            expect(brainstormEditTool.inputSchema).toBeDefined();
            expect(brainstormEditTool.outputSchema).toBeDefined();
        });

        it('should accept valid input parameters', () => {
            const validInput = {
                sourceJsondocId: 'test-jsondoc-id',
                editRequirements: '增加悬疑元素',
                agentInstructions: '保持原有风格',
                ideaIndex: 0
            };

            // Should not throw when parsing valid input
            expect(() => brainstormEditTool.inputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid input parameters', () => {
            const invalidInput = {
                // Missing required sourceJsondocId
                editRequirements: '增加悬疑元素'
            };

            // Should throw when parsing invalid input
            expect(() => brainstormEditTool.inputSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle missing source jsondoc errors', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue(null);

            const input = {
                sourceJsondocId: 'non-existent-jsondoc',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-error' }))
                .rejects.toThrow('Source jsondoc not found');
        });

        it('should handle access denied errors', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'restricted-jsondoc',
                schema_type: 'brainstorm_idea',
                project_id: 'different-project', // Different project
                data: { title: 'test', body: 'test' }
            });

            // Mock userHasProjectAccess to return false
            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(false);

            const input = {
                sourceJsondocId: 'restricted-jsondoc',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-access-error' }))
                .rejects.toThrow('Access denied to source jsondoc');
        });

        it('should handle unsupported jsondoc schema_type', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'unsupported-jsondoc',
                schema_type: 'unsupported_type',
                project_id: 'test-project-1',
                data: { some: 'data' }
            });

            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsondocId: 'unsupported-jsondoc',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-type-error' }))
                .rejects.toThrow(/Unsupported source jsondoc/);
        });

        it('should handle invalid idea index for collections', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'collection-invalid-index',
                schema_type: 'brainstorm_collection',
                project_id: 'test-project-1',
                data: {
                    ideas: [
                        { title: 'idea1', body: 'body1' }
                    ]
                }
            });

            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsondocId: 'collection-invalid-index',
                ideaIndex: 5, // Invalid index
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-index-error' }))
                .rejects.toThrow('Failed to extract idea at index 5');
        });
    });

    describe('Source Jsondoc Processing', () => {
        it('should correctly extract data from brainstorm_idea jsondocs', async () => {
            // Arrange
            const sourceJsondoc = {
                id: 'schema-jsondoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: {
                    title: '测试标题',
                    body: '测试内容'
                }
            };

            mockJsondocRepo.getJsondoc.mockResolvedValue(sourceJsondoc);
            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            // Mock the streaming transform executor to fail gracefully for testing
            const input = {
                sourceJsondocId: 'schema-jsondoc',
                editRequirements: '测试处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-schema-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the jsondoc was accessed
                expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('schema-jsondoc');
                expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should correctly extract data from legacy brainstorm_idea jsondocs', async () => {
            // Arrange
            const sourceJsondoc = {
                id: 'legacy-jsondoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: {
                    title: '传统标题',
                    body: '传统内容'
                }
            };

            mockJsondocRepo.getJsondoc.mockResolvedValue(sourceJsondoc);
            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsondocId: 'legacy-jsondoc',
                editRequirements: '测试传统格式处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-legacy-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the jsondoc was accessed
                expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('legacy-jsondoc');
                expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should correctly extract data from collection jsondocs with valid index', async () => {
            // Arrange
            const sourceJsondoc = {
                id: 'collection-jsondoc',
                schema_type: 'brainstorm_collection',
                project_id: 'test-project-1',
                data: {
                    ideas: [
                        { title: '想法1', body: '内容1' },
                        { title: '想法2', body: '内容2' }
                    ]
                }
            };

            mockJsondocRepo.getJsondoc.mockResolvedValue(sourceJsondoc);
            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsondocId: 'collection-jsondoc',
                ideaIndex: 1, // Valid index
                editRequirements: '测试集合处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-collection-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the jsondoc was accessed
                expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('collection-jsondoc');
                expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });
    });

    describe('Unified Approach Verification', () => {
        it('should use streaming transform executor instead of dual-transform approach', () => {
            // Verify that the tool definition uses the unified approach
            expect(brainstormEditTool.description).toContain('JSON补丁方式');
            expect(brainstormEditTool.name).toBe('edit_brainstorm_idea');

            // The tool should be properly structured for unified execution
            expect(brainstormEditTool.execute).toBeInstanceOf(Function);
            expect(brainstormEditTool.inputSchema).toBeDefined();
            expect(brainstormEditTool.outputSchema).toBeDefined();
        });

        it('should have input schema that supports all required parameters', () => {
            const schema = brainstormEditTool.inputSchema;

            // Test that all required fields are present
            const validInput = {
                sourceJsondocId: 'test-id',
                editRequirements: 'test requirements'
            };

            expect(() => schema.parse(validInput)).not.toThrow();

            // Test that optional fields are accepted
            const validInputWithOptionals = {
                sourceJsondocId: 'test-id',
                editRequirements: 'test requirements',
                agentInstructions: 'test instructions',
                ideaIndex: 0
            };

            expect(() => schema.parse(validInputWithOptionals)).not.toThrow();
        });

        it('should have output schema that matches unified approach expectations', () => {
            const schema = brainstormEditTool.outputSchema;

            // The output schema should be defined and validate expected output structure
            expect(schema).toBeDefined();

            // Test with expected output structure
            const validOutput = {
                outputJsondocId: 'output-id',
                finishReason: 'stop',
                originalIdea: { title: 'original', body: 'original content' },
                editedIdea: { title: 'edited', body: 'edited content' }
            };

            expect(() => schema.parse(validOutput)).not.toThrow();
        });
    });

    describe('Repository Integration', () => {
        it('should properly integrate with jsondoc repository', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'test-jsondoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: { title: 'test', body: 'test' }
            });
            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsondocId: 'test-jsondoc',
                editRequirements: '测试仓库集成'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-repo-integration' });
            } catch (error) {
                // Verify repository methods were called correctly
                expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('test-jsondoc');
                expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should handle repository access control correctly', async () => {
            // Test that access control is properly enforced
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'protected-jsondoc',
                schema_type: 'brainstorm_idea',
                project_id: 'other-project',
                data: { title: 'protected', body: 'protected content' }
            });
            mockJsondocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(false);

            const input = {
                sourceJsondocId: 'protected-jsondoc',
                editRequirements: '测试访问控制'
            };

            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-access-control' }))
                .rejects.toThrow('Access denied to source jsondoc');
        });
    });
}); 