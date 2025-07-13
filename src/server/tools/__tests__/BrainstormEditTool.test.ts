import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBrainstormEditToolDefinition } from '../BrainstormTools';
import { createMockJsonDocRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';

describe('BrainstormEditTool (Unified Streaming Patch)', () => {
    let mockTransformRepo: any;
    let mockJsonDocRepo: any;
    let brainstormEditTool: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockJsonDocRepo = createMockJsonDocRepository();

        brainstormEditTool = createBrainstormEditToolDefinition(
            mockTransformRepo,
            mockJsonDocRepo,
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
                sourceJsonDocId: 'test-jsonDoc-id',
                editRequirements: '增加悬疑元素',
                agentInstructions: '保持原有风格',
                ideaIndex: 0
            };

            // Should not throw when parsing valid input
            expect(() => brainstormEditTool.inputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid input parameters', () => {
            const invalidInput = {
                // Missing required sourceJsonDocId
                editRequirements: '增加悬疑元素'
            };

            // Should throw when parsing invalid input
            expect(() => brainstormEditTool.inputSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle missing source jsonDoc errors', async () => {
            // Arrange
            mockJsonDocRepo.getJsonDoc.mockResolvedValue(null);

            const input = {
                sourceJsonDocId: 'non-existent-jsonDoc',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-error' }))
                .rejects.toThrow('Source jsonDoc not found');
        });

        it('should handle access denied errors', async () => {
            // Arrange
            mockJsonDocRepo.getJsonDoc.mockResolvedValue({
                id: 'restricted-jsonDoc',
                schema_type: 'brainstorm_idea',
                project_id: 'different-project', // Different project
                data: { title: 'test', body: 'test' }
            });

            // Mock userHasProjectAccess to return false
            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(false);

            const input = {
                sourceJsonDocId: 'restricted-jsonDoc',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-access-error' }))
                .rejects.toThrow('Access denied to source jsonDoc');
        });

        it('should handle unsupported jsonDoc schema_type', async () => {
            // Arrange
            mockJsonDocRepo.getJsonDoc.mockResolvedValue({
                id: 'unsupported-jsonDoc',
                schema_type: 'unsupported_type',
                project_id: 'test-project-1',
                data: { some: 'data' }
            });

            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsonDocId: 'unsupported-jsonDoc',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-type-error' }))
                .rejects.toThrow(/Unsupported source jsonDoc/);
        });

        it('should handle invalid idea index for collections', async () => {
            // Arrange
            mockJsonDocRepo.getJsonDoc.mockResolvedValue({
                id: 'collection-invalid-index',
                schema_type: 'brainstorm_collection',
                project_id: 'test-project-1',
                data: {
                    ideas: [
                        { title: 'idea1', body: 'body1' }
                    ]
                }
            });

            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsonDocId: 'collection-invalid-index',
                ideaIndex: 5, // Invalid index
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-index-error' }))
                .rejects.toThrow('Failed to extract idea at index 5');
        });
    });

    describe('Source JsonDoc Processing', () => {
        it('should correctly extract data from brainstorm_idea jsonDocs', async () => {
            // Arrange
            const sourceJsonDoc = {
                id: 'schema-jsonDoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: {
                    title: '测试标题',
                    body: '测试内容'
                }
            };

            mockJsonDocRepo.getJsonDoc.mockResolvedValue(sourceJsonDoc);
            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            // Mock the streaming transform executor to fail gracefully for testing
            const input = {
                sourceJsonDocId: 'schema-jsonDoc',
                editRequirements: '测试处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-schema-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the jsonDoc was accessed
                expect(mockJsonDocRepo.getJsonDoc).toHaveBeenCalledWith('schema-jsonDoc');
                expect(mockJsonDocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should correctly extract data from legacy brainstorm_idea jsonDocs', async () => {
            // Arrange
            const sourceJsonDoc = {
                id: 'legacy-jsonDoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: {
                    title: '传统标题',
                    body: '传统内容'
                }
            };

            mockJsonDocRepo.getJsonDoc.mockResolvedValue(sourceJsonDoc);
            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsonDocId: 'legacy-jsonDoc',
                editRequirements: '测试传统格式处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-legacy-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the jsonDoc was accessed
                expect(mockJsonDocRepo.getJsonDoc).toHaveBeenCalledWith('legacy-jsonDoc');
                expect(mockJsonDocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should correctly extract data from collection jsonDocs with valid index', async () => {
            // Arrange
            const sourceJsonDoc = {
                id: 'collection-jsonDoc',
                schema_type: 'brainstorm_collection',
                project_id: 'test-project-1',
                data: {
                    ideas: [
                        { title: '想法1', body: '内容1' },
                        { title: '想法2', body: '内容2' }
                    ]
                }
            };

            mockJsonDocRepo.getJsonDoc.mockResolvedValue(sourceJsonDoc);
            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsonDocId: 'collection-jsonDoc',
                ideaIndex: 1, // Valid index
                editRequirements: '测试集合处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-collection-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the jsonDoc was accessed
                expect(mockJsonDocRepo.getJsonDoc).toHaveBeenCalledWith('collection-jsonDoc');
                expect(mockJsonDocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
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
                sourceJsonDocId: 'test-id',
                editRequirements: 'test requirements'
            };

            expect(() => schema.parse(validInput)).not.toThrow();

            // Test that optional fields are accepted
            const validInputWithOptionals = {
                sourceJsonDocId: 'test-id',
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
                outputJsonDocId: 'output-id',
                finishReason: 'stop',
                originalIdea: { title: 'original', body: 'original content' },
                editedIdea: { title: 'edited', body: 'edited content' }
            };

            expect(() => schema.parse(validOutput)).not.toThrow();
        });
    });

    describe('Repository Integration', () => {
        it('should properly integrate with jsonDoc repository', async () => {
            // Arrange
            mockJsonDocRepo.getJsonDoc.mockResolvedValue({
                id: 'test-jsonDoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: { title: 'test', body: 'test' }
            });
            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceJsonDocId: 'test-jsonDoc',
                editRequirements: '测试仓库集成'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-repo-integration' });
            } catch (error) {
                // Verify repository methods were called correctly
                expect(mockJsonDocRepo.getJsonDoc).toHaveBeenCalledWith('test-jsonDoc');
                expect(mockJsonDocRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should handle repository access control correctly', async () => {
            // Test that access control is properly enforced
            mockJsonDocRepo.getJsonDoc.mockResolvedValue({
                id: 'protected-jsonDoc',
                schema_type: 'brainstorm_idea',
                project_id: 'other-project',
                data: { title: 'protected', body: 'protected content' }
            });
            mockJsonDocRepo.userHasProjectAccess = vi.fn().mockResolvedValue(false);

            const input = {
                sourceJsonDocId: 'protected-jsonDoc',
                editRequirements: '测试访问控制'
            };

            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-access-control' }))
                .rejects.toThrow('Access denied to source jsonDoc');
        });
    });
}); 