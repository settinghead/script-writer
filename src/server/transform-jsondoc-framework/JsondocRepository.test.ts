import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransformJsondocRepository } from './TransformJsondocRepository';
import { createMockKyselyDatabase } from '../../__tests__/mocks/databaseMocks';
import { mockJsondocs } from '../../__tests__/fixtures/jsondocs';

describe('TransformJsondocRepository', () => {
    let repository: TransformJsondocRepository;
    let mockDb: any;

    beforeEach(() => {
        mockDb = createMockKyselyDatabase();
        repository = new TransformJsondocRepository(mockDb);
    });

    describe('getLatestBrainstormIdeas', () => {
        it('should resolve latest brainstorm ideas for project', async () => {
            // Arrange - Mock lineage methods to throw error, forcing fallback to getProjectJsondocsByType
            vi.spyOn(repository, 'getAllProjectJsondocsForLineage').mockRejectedValue(new Error('Lineage test error'));
            vi.spyOn(repository, 'getAllProjectTransformInputsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectTransformOutputsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectTransformsForLineage').mockResolvedValue([]);
            vi.spyOn(repository, 'getAllProjectHumanTransformsForLineage').mockResolvedValue([]);

            // Mock the fallback method which will be used
            vi.spyOn(repository, 'getProjectJsondocsByType').mockResolvedValue([
                {
                    id: mockJsondocs.brainstormIdea.id,
                    schema_type: mockJsondocs.brainstormIdea.schema_type,
                    project_id: mockJsondocs.brainstormIdea.project_id,
                    data: JSON.parse(mockJsondocs.brainstormIdea.data), // Parsed data
                    metadata: mockJsondocs.brainstormIdea.metadata,
                    created_at: mockJsondocs.brainstormIdea.created_at.toISOString(),
                    schema_version: mockJsondocs.brainstormIdea.schema_version,
                    origin_type: mockJsondocs.brainstormIdea.origin_type as 'ai_generated' | 'user_input'
                }
            ]);

            // Act
            const result = await repository.getLatestBrainstormIdeas('test-project-1');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].schema_type).toBe('灵感创意');
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

    describe('getJsondoc', () => {
        it('should return jsondoc by id', async () => {
            // Arrange
            mockDb.executeTakeFirst.mockResolvedValue(mockJsondocs.brainstormIdea);

            // Act
            const result = await repository.getJsondoc('test-brainstorm-1');

            // Assert
            expect(result).toBeDefined();
            expect(result?.id).toBe('test-brainstorm-1');
            expect(result?.schema_type).toBe('灵感创意');
            expect(result?.project_id).toBe('test-project-1');
            expect(result?.data).toEqual({
                title: '误爱成宠',
                body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
            });
            expect(mockDb.where).toHaveBeenCalledWith('id', '=', 'test-brainstorm-1');
        });
    });
}); 