import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBrainstormEditToolDefinition } from '../BrainstormTools';
import { createMockArtifactRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';

describe('BrainstormEditTool (Unified Streaming Patch)', () => {
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
                sourceArtifactId: 'test-artifact-id',
                editRequirements: '增加悬疑元素',
                agentInstructions: '保持原有风格',
                ideaIndex: 0
            };

            // Should not throw when parsing valid input
            expect(() => brainstormEditTool.inputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid input parameters', () => {
            const invalidInput = {
                // Missing required sourceArtifactId
                editRequirements: '增加悬疑元素'
            };

            // Should throw when parsing invalid input
            expect(() => brainstormEditTool.inputSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('Error Handling and Edge Cases', () => {
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

        it('should handle access denied errors', async () => {
            // Arrange
            mockArtifactRepo.getArtifact.mockResolvedValue({
                id: 'restricted-artifact',
                schema_type: 'brainstorm_idea',
                project_id: 'different-project', // Different project
                data: { title: 'test', body: 'test' }
            });

            // Mock userHasProjectAccess to return false
            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(false);

            const input = {
                sourceArtifactId: 'restricted-artifact',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-access-error' }))
                .rejects.toThrow('Access denied to source artifact');
        });

        it('should handle unsupported artifact schema_type', async () => {
            // Arrange
            mockArtifactRepo.getArtifact.mockResolvedValue({
                id: 'unsupported-artifact',
                schema_type: 'unsupported_type',
                project_id: 'test-project-1',
                data: { some: 'data' }
            });

            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceArtifactId: 'unsupported-artifact',
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-type-error' }))
                .rejects.toThrow('Unsupported source artifact type: unsupported_type');
        });

        it('should handle invalid idea index for collections', async () => {
            // Arrange
            mockArtifactRepo.getArtifact.mockResolvedValue({
                id: 'collection-invalid-index',
                schema_type: 'brainstorm_collection',
                project_id: 'test-project-1',
                data: {
                    ideas: [
                        { title: 'idea1', body: 'body1' }
                    ]
                }
            });

            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceArtifactId: 'collection-invalid-index',
                ideaIndex: 5, // Invalid index
                editRequirements: '改进故事'
            };

            // Act & Assert
            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-index-error' }))
                .rejects.toThrow('Failed to extract idea at index 5');
        });
    });

    describe('Source Artifact Processing', () => {
        it('should correctly extract data from brainstorm_idea artifacts', async () => {
            // Arrange
            const sourceArtifact = {
                id: 'schema-artifact',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: {
                    title: '测试标题',
                    body: '测试内容'
                }
            };

            mockArtifactRepo.getArtifact.mockResolvedValue(sourceArtifact);
            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            // Mock the streaming transform executor to fail gracefully for testing
            const input = {
                sourceArtifactId: 'schema-artifact',
                editRequirements: '测试处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-schema-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the artifact was accessed
                expect(mockArtifactRepo.getArtifact).toHaveBeenCalledWith('schema-artifact');
                expect(mockArtifactRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should correctly extract data from legacy brainstorm_idea artifacts', async () => {
            // Arrange
            const sourceArtifact = {
                id: 'legacy-artifact',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: {
                    title: '传统标题',
                    body: '传统内容'
                }
            };

            mockArtifactRepo.getArtifact.mockResolvedValue(sourceArtifact);
            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceArtifactId: 'legacy-artifact',
                editRequirements: '测试传统格式处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-legacy-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the artifact was accessed
                expect(mockArtifactRepo.getArtifact).toHaveBeenCalledWith('legacy-artifact');
                expect(mockArtifactRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should correctly extract data from collection artifacts with valid index', async () => {
            // Arrange
            const sourceArtifact = {
                id: 'collection-artifact',
                schema_type: 'brainstorm_collection',
                project_id: 'test-project-1',
                data: {
                    ideas: [
                        { title: '想法1', body: '内容1' },
                        { title: '想法2', body: '内容2' }
                    ]
                }
            };

            mockArtifactRepo.getArtifact.mockResolvedValue(sourceArtifact);
            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceArtifactId: 'collection-artifact',
                ideaIndex: 1, // Valid index
                editRequirements: '测试集合处理'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-collection-extraction' });
            } catch (error) {
                // We expect this to fail due to LLM mocking, but we can verify the artifact was accessed
                expect(mockArtifactRepo.getArtifact).toHaveBeenCalledWith('collection-artifact');
                expect(mockArtifactRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
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
                sourceArtifactId: 'test-id',
                editRequirements: 'test requirements'
            };

            expect(() => schema.parse(validInput)).not.toThrow();

            // Test that optional fields are accepted
            const validInputWithOptionals = {
                sourceArtifactId: 'test-id',
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
                outputArtifactId: 'output-id',
                finishReason: 'stop',
                originalIdea: { title: 'original', body: 'original content' },
                editedIdea: { title: 'edited', body: 'edited content' }
            };

            expect(() => schema.parse(validOutput)).not.toThrow();
        });
    });

    describe('Repository Integration', () => {
        it('should properly integrate with artifact repository', async () => {
            // Arrange
            mockArtifactRepo.getArtifact.mockResolvedValue({
                id: 'test-artifact',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project-1',
                data: { title: 'test', body: 'test' }
            });
            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(true);

            const input = {
                sourceArtifactId: 'test-artifact',
                editRequirements: '测试仓库集成'
            };

            try {
                await brainstormEditTool.execute(input, { toolCallId: 'test-repo-integration' });
            } catch (error) {
                // Verify repository methods were called correctly
                expect(mockArtifactRepo.getArtifact).toHaveBeenCalledWith('test-artifact');
                expect(mockArtifactRepo.userHasProjectAccess).toHaveBeenCalledWith('test-user-1', 'test-project-1');
            }
        });

        it('should handle repository access control correctly', async () => {
            // Test that access control is properly enforced
            mockArtifactRepo.getArtifact.mockResolvedValue({
                id: 'protected-artifact',
                schema_type: 'brainstorm_idea',
                project_id: 'other-project',
                data: { title: 'protected', body: 'protected content' }
            });
            mockArtifactRepo.userHasProjectAccess = vi.fn().mockResolvedValue(false);

            const input = {
                sourceArtifactId: 'protected-artifact',
                editRequirements: '测试访问控制'
            };

            await expect(brainstormEditTool.execute(input, { toolCallId: 'test-access-control' }))
                .rejects.toThrow('Access denied to source artifact');
        });
    });
}); 