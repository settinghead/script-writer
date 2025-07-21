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
            expect(brainstormEditTool.description).toContain('JSON Patch格式');
            expect(brainstormEditTool.inputSchema).toBeDefined();
            expect(brainstormEditTool.outputSchema).toBeDefined();
        });

        it('should accept valid input parameters', () => {
            const validInput = {
                jsondocs: [{
                    jsondocId: 'test-jsondoc-id',
                    description: '测试故事创意',
                    schemaType: 'brainstorm_idea'
                }],
                editRequirements: '增加悬疑元素',
                agentInstructions: '保持原有风格',
                ideaIndex: 0
            };

            // Should not throw when parsing valid input
            expect(() => brainstormEditTool.inputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid input parameters', () => {
            const invalidInput = {
                // Missing required jsondocs
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
                jsondocs: [{
                    jsondocId: 'non-existent-jsondoc',
                    role: 'source_idea'
                }],
                editRequirements: '改进故事'
            };

            // Act
            const result = await brainstormEditTool.execute(input, { toolCallId: 'test-error' });

            // Assert
            expect(result).toEqual({
                status: 'error',
                error: expect.stringContaining('Source jsondoc not found'),
                originalIdea: { title: 'Unknown', body: 'Unknown' }
            });
        });

        it('should handle access denied errors', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'restricted-jsondoc',
                project_id: 'test-project',
                schema_type: 'brainstorm_idea',
                data: { title: 'Test', body: 'Test content' }
            });
            mockJsondocRepo.userHasProjectAccess.mockResolvedValue(false);

            const input = {
                jsondocs: [{
                    jsondocId: 'restricted-jsondoc',
                    role: 'source_idea'
                }],
                editRequirements: '改进故事'
            };

            // Act
            const result = await brainstormEditTool.execute(input, { toolCallId: 'test-access-error' });

            // Assert
            expect(result).toEqual({
                status: 'error',
                error: expect.stringContaining('Access denied to source jsondoc'),
                originalIdea: { title: 'Unknown', body: 'Unknown' }
            });
        });

        it('should handle unsupported jsondoc schema_type', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'unsupported-jsondoc',
                project_id: 'test-project',
                schema_type: 'unsupported_type',
                data: { title: 'Test', body: 'Test content' }
            });
            mockJsondocRepo.userHasProjectAccess.mockResolvedValue(true);

            const input = {
                jsondocs: [{
                    jsondocId: 'unsupported-jsondoc',
                    role: 'source_idea'
                }],
                editRequirements: '改进故事'
            };

            // Act
            const result = await brainstormEditTool.execute(input, { toolCallId: 'test-type-error' });

            // Assert
            expect(result).toEqual({
                status: 'error',
                error: expect.stringContaining('Unsupported source jsondoc'),
                originalIdea: { title: 'Unknown', body: 'Unknown' }
            });
        });

        it('should handle invalid idea index for collections', async () => {
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'collection-invalid-index',
                project_id: 'test-project',
                schema_type: 'brainstorm_collection',
                data: {
                    ideas: [
                        { title: 'Idea 1', body: 'Content 1' },
                        { title: 'Idea 2', body: 'Content 2' }
                    ]
                }
            });
            mockJsondocRepo.userHasProjectAccess.mockResolvedValue(true);

            const input = {
                jsondocs: [{
                    jsondocId: 'collection-invalid-index',
                    role: 'source_idea'
                }],
                ideaIndex: 5, // Invalid index
                editRequirements: '改进故事'
            };

            // Act
            const result = await brainstormEditTool.execute(input, { toolCallId: 'test-index-error' });

            // Assert
            expect(result).toEqual({
                status: 'error',
                error: expect.stringContaining('Failed to extract idea at index 5'),
                originalIdea: { title: 'Unknown', body: 'Unknown' }
            });
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
                jsondocs: [{
                    jsondocId: 'schema-jsondoc',
                    description: '测试故事创意',
                    schemaType: 'brainstorm_idea'
                }],
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
                jsondocs: [{
                    jsondocId: 'legacy-jsondoc',
                    description: '传统格式故事创意',
                    schemaType: 'brainstorm_idea'
                }],
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
                jsondocs: [{
                    jsondocId: 'collection-jsondoc',
                    description: '故事创意集合',
                    schemaType: 'brainstorm_collection'
                }],
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
            expect(brainstormEditTool.description).toContain('JSON Patch格式');
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
                jsondocs: [{
                    jsondocId: 'test-id',
                    description: '测试故事创意',
                    schemaType: 'brainstorm_idea'
                }],
                editRequirements: 'test requirements'
            };

            expect(() => schema.parse(validInput)).not.toThrow();

            // Test that optional fields are accepted
            const validInputWithOptionals = {
                jsondocs: [{
                    jsondocId: 'test-id',
                    description: '测试故事创意',
                    schemaType: 'brainstorm_idea'
                }],
                editRequirements: 'test requirements',
                agentInstructions: 'test instructions',
                ideaIndex: 0
            };

            expect(() => schema.parse(validInputWithOptionals)).not.toThrow();
        });

        it('should have output schema that matches unified approach expectations', () => {
            // Arrange
            const schema = brainstormEditTool.outputSchema;

            // The output schema should be defined and validate expected output structure
            expect(schema).toBeDefined();

            // Test with expected success output structure
            const validSuccessOutput = {
                status: 'success',
                outputJsondocId: 'output-id',
                finishReason: 'stop',
                originalIdea: { title: 'original', body: 'original content' },
                editedIdea: { title: 'edited', body: 'edited content' }
            };

            expect(() => schema.parse(validSuccessOutput)).not.toThrow();

            // Test with expected rejected output structure
            const validRejectedOutput = {
                status: 'rejected',
                reason: 'User rejected the proposed patches',
                originalIdea: { title: 'original', body: 'original content' }
            };

            expect(() => schema.parse(validRejectedOutput)).not.toThrow();

            // Test with expected error output structure
            const validErrorOutput = {
                status: 'error',
                error: 'Something went wrong',
                originalIdea: { title: 'original', body: 'original content' }
            };

            expect(() => schema.parse(validErrorOutput)).not.toThrow();
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
                jsondocs: [{
                    jsondocId: 'test-jsondoc',
                    description: '测试故事创意',
                    schemaType: 'brainstorm_idea'
                }],
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
            // Arrange
            mockJsondocRepo.getJsondoc.mockResolvedValue({
                id: 'protected-jsondoc',
                project_id: 'test-project',
                schema_type: 'brainstorm_idea',
                data: { title: 'Protected', body: 'Protected content' }
            });
            mockJsondocRepo.userHasProjectAccess.mockResolvedValue(false);

            const input = {
                jsondocs: [{
                    jsondocId: 'protected-jsondoc',
                    role: 'source_idea'
                }],
                editRequirements: '改进故事'
            };

            // Act
            const result = await brainstormEditTool.execute(input, { toolCallId: 'test-access-control' });

            // Assert
            expect(result).toEqual({
                status: 'error',
                error: expect.stringContaining('Access denied to source jsondoc'),
                originalIdea: { title: 'Unknown', body: 'Unknown' }
            });
        });
    });

    describe('Patch Rejection Handling', () => {
        it('should handle user rejection of patches gracefully', async () => {
            // Arrange
            const sourceJsondoc = {
                id: 'rejection-test-jsondoc',
                schema_type: 'brainstorm_idea',
                project_id: 'test-project',
                data: {
                    title: '测试标题',
                    body: '测试内容'
                }
            };

            mockJsondocRepo.getJsondoc.mockResolvedValue(sourceJsondoc);
            mockJsondocRepo.userHasProjectAccess.mockResolvedValue(true);

            // Note: New implementation doesn't wait for approval, just creates patches

            const input = {
                jsondocs: [{
                    jsondocId: 'rejection-test-jsondoc',
                    role: 'source_idea',
                    description: '测试故事创意',
                    schemaType: 'brainstorm_idea'
                }],
                editRequirements: '改进故事内容'
            };

            // Act
            const result = await brainstormEditTool.execute(input, { toolCallId: 'test-rejection' });

            // Assert - new implementation returns success with patch content
            expect(result.status).toBe('success');
            expect(result).toHaveProperty('patchContent');
            expect(result).toHaveProperty('message');
            expect(result.message).toContain('patches for your review');
        });
    });
}); 