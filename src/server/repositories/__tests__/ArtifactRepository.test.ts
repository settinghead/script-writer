import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtifactRepository } from '../ArtifactRepository';
import { createMockKyselyDatabase } from '../../../__tests__/mocks/databaseMocks';
import { mockArtifacts } from '../../../__tests__/fixtures/artifacts';

describe('ArtifactRepository', () => {
    let repository: ArtifactRepository;
    let mockDb: any;

    beforeEach(() => {
        mockDb = createMockKyselyDatabase();
        repository = new ArtifactRepository(mockDb);
    });

    describe('getLatestBrainstormIdeas', () => {
        it('should resolve latest brainstorm ideas for project', async () => {
            // Arrange - Mock lineage methods to throw error, forcing fallback to getProjectArtifactsByType
            vi.spyOn(repository, 'getAllProjectArtifactsForLineage').mockRejectedValue(new Error('Lineage test error'));
            vi.spyOn(repository, 'getAllProjectTransformInputsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectTransformOutputsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectTransformsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectHumanTransformsForLineage').mockResolvedValue([]);

            // Mock the fallback method which will be used
            vi.spyOn(repository, 'getProjectArtifactsByType').mockResolvedValue([
                {
                    id: mockArtifacts.brainstormIdea.id,
                    type: mockArtifacts.brainstormIdea.type,
                    project_id: mockArtifacts.brainstormIdea.project_id,
                    data: JSON.parse(mockArtifacts.brainstormIdea.data), // Parsed data
                    metadata: mockArtifacts.brainstormIdea.metadata,
                    created_at: mockArtifacts.brainstormIdea.created_at.toISOString(),
                    schema_type: mockArtifacts.brainstormIdea.schema_type,
                    schema_version: mockArtifacts.brainstormIdea.schema_version,
                    type_version: mockArtifacts.brainstormIdea.type_version,
                    origin_type: mockArtifacts.brainstormIdea.origin_type as 'ai_generated' | 'user_input'
                }
            ]);

            // Act
            const result = await repository.getLatestBrainstormIdeas('test-project-1');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('brainstorm_idea');
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

    describe('getArtifact', () => {
        it('should return artifact by id', async () => {
            // Arrange
            mockDb.executeTakeFirst.mockResolvedValue(mockArtifacts.brainstormIdea);

            // Act
            const result = await repository.getArtifact('test-brainstorm-1');

            // Assert
            expect(result).toBeDefined();
            expect(result?.id).toBe('test-brainstorm-1');
            expect(result?.type).toBe('brainstorm_idea');
            expect(result?.project_id).toBe('test-project-1');
            expect(result?.data).toEqual({
                title: '误爱成宠',
                body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
            });
            expect(mockDb.where).toHaveBeenCalledWith('id', '=', 'test-brainstorm-1');
        });
    });
}); 