import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonDocRepository } from './JsonDocRepository';
import { createMockKyselyDatabase } from '../../__tests__/mocks/databaseMocks';
import { mockJsonDocs } from '../../__tests__/fixtures/jsonDocs';

describe('JsonDocRepository', () => {
    let repository: JsonDocRepository;
    let mockDb: any;

    beforeEach(() => {
        mockDb = createMockKyselyDatabase();
        repository = new JsonDocRepository(mockDb);
    });

    describe('getLatestBrainstormIdeas', () => {
        it('should resolve latest brainstorm ideas for project', async () => {
            // Arrange - Mock lineage methods to throw error, forcing fallback to getProjectJsonDocsByType
            vi.spyOn(repository, 'getAllProjectJsonDocsForLineage').mockRejectedValue(new Error('Lineage test error'));
            vi.spyOn(repository, 'getAllProjectTransformInputsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectTransformOutputsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectTransformsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectHumanTransformsForLineage').mockResolvedValue([]);

            // Mock the fallback method which will be used
            vi.spyOn(repository, 'getProjectJsonDocsByType').mockResolvedValue([
                {
                    id: mockJsonDocs.brainstormIdea.id,
                    schema_type: mockJsonDocs.brainstormIdea.schema_type,
                    project_id: mockJsonDocs.brainstormIdea.project_id,
                    data: JSON.parse(mockJsonDocs.brainstormIdea.data), // Parsed data
                    metadata: mockJsonDocs.brainstormIdea.metadata,
                    created_at: mockJsonDocs.brainstormIdea.created_at.toISOString(),
                    schema_version: mockJsonDocs.brainstormIdea.schema_version,
                    origin_type: mockJsonDocs.brainstormIdea.origin_type as 'ai_generated' | 'user_input'
                }
            ]);

            // Act
            const result = await repository.getLatestBrainstormIdeas('test-project-1');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].schema_type).toBe('brainstorm_idea');
            expect(result[0].data).toEqual({
                title: '误爱成宠',
                body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
            });
        });

        it('should return empty array when no ideas exist', async () => {
            // Arrange
            mockDb.execute.mockResolvedValue([]);

            // Act
            const result = await repository.getLatestBrainstormIdeas('test-project-1');

            // Assert
            expect(result).toHaveLength(0);
        });
    });

    describe('getJsonDoc', () => {
        it('should return jsonDoc by id', async () => {
            // Arrange
            mockDb.executeTakeFirst.mockResolvedValue(mockJsonDocs.brainstormIdea);

            // Act
            const result = await repository.getJsonDoc('test-brainstorm-1');

            // Assert
            expect(result).toBeDefined();
            expect(result?.id).toBe('test-brainstorm-1');
            expect(result?.schema_type).toBe('brainstorm_idea');
            expect(result?.project_id).toBe('test-project-1');
            expect(result?.data).toEqual({
                title: '误爱成宠',
                body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
            });
            expect(mockDb.where).toHaveBeenCalledWith('id', '=', 'test-brainstorm-1');
        });
    });
}); 