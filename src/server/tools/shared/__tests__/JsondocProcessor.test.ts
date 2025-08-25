import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsondocProcessor, createJsondocProcessor } from '../JsondocProcessor';
import type { TransformJsondocRepository } from '../../../transform-jsondoc-framework/TransformJsondocRepository';
import type { JsondocReference } from '../../../../common/schemas/common';

describe('JsondocProcessor', () => {
    let mockJsondocRepo: TransformJsondocRepository;
    let processor: JsondocProcessor;
    const userId = 'test-user-id';

    beforeEach(() => {
        vi.clearAllMocks();

        mockJsondocRepo = {
            getJsondoc: vi.fn(),
            userHasProjectAccess: vi.fn()
        } as any;

        processor = createJsondocProcessor(mockJsondocRepo, userId);
    });

    describe('processJsondocs', () => {
        it('should process all provided jsondocs successfully', async () => {
            const mockJsondocs = [
                {
                    id: 'jsondoc-1',
                    schema_type: '灵感创意',
                    project_id: 'project-1',
                    data: { title: 'Test Idea 1', body: 'Test content 1' }
                },
                {
                    id: 'jsondoc-2',
                    schema_type: '故事设定',
                    project_id: 'project-1',
                    data: { title: 'Test Outline', genre: 'romance' }
                },
                {
                    id: 'jsondoc-3',
                    schema_type: 'chronicles',
                    project_id: 'project-1',
                    data: { title: 'Test Chronicles', stages: [] }
                }
            ];

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockJsondocs[0])
                .mockResolvedValueOnce(mockJsondocs[1])
                .mockResolvedValueOnce(mockJsondocs[2]);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            const jsondocRefs: JsondocReference[] = [
                { jsondocId: 'jsondoc-1', description: 'Test idea', schemaType: '灵感创意' },
                { jsondocId: 'jsondoc-2', description: 'Test outline', schemaType: '故事设定' },
                { jsondocId: 'jsondoc-3', description: 'Test chronicles', schemaType: 'chronicles' }
            ];

            const result = await processor.processJsondocs(jsondocRefs);

            expect(result.processedCount).toBe(3);
            expect(result.jsondocData).toEqual({
                灵感创意: { title: 'Test Idea 1', body: 'Test content 1' },
                故事设定: { title: 'Test Outline', genre: 'romance' },
                chronicles: { title: 'Test Chronicles', stages: [] }
            });
            expect(result.jsondocMetadata).toEqual({
                灵感创意: 'jsondoc-1',
                故事设定: 'jsondoc-2',
                chronicles: 'jsondoc-3'
            });

            // Verify all jsondocs were accessed
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledTimes(3);
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('jsondoc-1');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('jsondoc-2');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('jsondoc-3');

            // Verify access checks
            expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledTimes(3);
            expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith(userId, 'project-1');
        });

        it('should handle missing jsondocs gracefully', async () => {
            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(null) // First jsondoc not found
                .mockResolvedValueOnce({
                    id: 'jsondoc-2',
                    schema_type: '故事设定',
                    project_id: 'project-1',
                    data: { title: 'Test Outline', genre: 'romance' }
                });

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            const jsondocRefs: JsondocReference[] = [
                { jsondocId: 'missing-id', description: 'Missing jsondoc', schemaType: '灵感创意' },
                { jsondocId: 'jsondoc-2', description: 'Test outline', schemaType: '故事设定' }
            ];

            const result = await processor.processJsondocs(jsondocRefs);

            expect(result.processedCount).toBe(1);
            expect(result.jsondocData).toEqual({
                故事设定: { title: 'Test Outline', genre: 'romance' }
            });
            expect(result.jsondocMetadata).toEqual({
                故事设定: 'jsondoc-2'
            });
        });

        it('should handle access denied gracefully', async () => {
            const mockJsondoc = {
                id: 'jsondoc-1',
                schema_type: '灵感创意',
                project_id: 'project-1',
                data: { title: 'Test Idea', body: 'Test content' }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockJsondoc)
                .mockResolvedValueOnce(mockJsondoc);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValueOnce(false) // Access denied for first
                .mockResolvedValueOnce(true);  // Access granted for second

            const jsondocRefs: JsondocReference[] = [
                { jsondocId: 'jsondoc-1', description: 'Restricted jsondoc', schemaType: '灵感创意' },
                { jsondocId: 'jsondoc-1', description: 'Accessible jsondoc', schemaType: '灵感创意' }
            ];

            const result = await processor.processJsondocs(jsondocRefs);

            expect(result.processedCount).toBe(1);
            expect(result.jsondocData).toEqual({
                灵感创意: { title: 'Test Idea', body: 'Test content' }
            });
            expect(result.jsondocMetadata).toEqual({
                灵感创意: 'jsondoc-1'
            });
        });

        it('should handle empty jsondocs array', async () => {
            const result = await processor.processJsondocs([]);

            expect(result.processedCount).toBe(0);
            expect(result.jsondocData).toEqual({});
            expect(result.jsondocMetadata).toEqual({});

            expect(mockJsondocRepo.getJsondoc).not.toHaveBeenCalled();
            expect(mockJsondocRepo.userHasProjectAccess).not.toHaveBeenCalled();
        });

        it('should handle jsondocs with same schema type (last one wins)', async () => {
            const mockJsondocs = [
                {
                    id: 'jsondoc-1',
                    schema_type: '灵感创意',
                    project_id: 'project-1',
                    data: { title: 'First Idea', body: 'First content' }
                },
                {
                    id: 'jsondoc-2',
                    schema_type: '灵感创意',
                    project_id: 'project-1',
                    data: { title: 'Second Idea', body: 'Second content' }
                }
            ];

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockJsondocs[0])
                .mockResolvedValueOnce(mockJsondocs[1]);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            const jsondocRefs: JsondocReference[] = [
                { jsondocId: 'jsondoc-1', description: 'First idea', schemaType: '灵感创意' },
                { jsondocId: 'jsondoc-2', description: 'Second idea', schemaType: '灵感创意' }
            ];

            const result = await processor.processJsondocs(jsondocRefs);

            expect(result.processedCount).toBe(2);
            // Last one should win for same schema type
            expect(result.jsondocData).toEqual({
                灵感创意: { title: 'Second Idea', body: 'Second content' }
            });
            expect(result.jsondocMetadata).toEqual({
                灵感创意: 'jsondoc-2'
            });
        });
    });

    describe('getJsondocWithAccess', () => {
        it('should return jsondoc when found and accessible', async () => {
            const mockJsondoc = {
                id: 'jsondoc-1',
                schema_type: '灵感创意',
                project_id: 'project-1',
                data: { title: 'Test Idea', body: 'Test content' }
            };

            (mockJsondocRepo.getJsondoc as any).mockResolvedValue(mockJsondoc);
            (mockJsondocRepo.userHasProjectAccess as any).mockResolvedValue(true);

            const result = await processor.getJsondocWithAccess('jsondoc-1');

            expect(result).toEqual(mockJsondoc);
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('jsondoc-1');
            expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith(userId, 'project-1');
        });

        it('should return null when jsondoc not found', async () => {
            (mockJsondocRepo.getJsondoc as any).mockResolvedValue(null);

            const result = await processor.getJsondocWithAccess('missing-id');

            expect(result).toBeNull();
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('missing-id');
            expect(mockJsondocRepo.userHasProjectAccess).not.toHaveBeenCalled();
        });

        it('should return null when access is denied', async () => {
            const mockJsondoc = {
                id: 'jsondoc-1',
                schema_type: '灵感创意',
                project_id: 'project-1',
                data: { title: 'Test Idea', body: 'Test content' }
            };

            (mockJsondocRepo.getJsondoc as any).mockResolvedValue(mockJsondoc);
            (mockJsondocRepo.userHasProjectAccess as any).mockResolvedValue(false);

            const result = await processor.getJsondocWithAccess('jsondoc-1');

            expect(result).toBeNull();
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('jsondoc-1');
            expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledWith(userId, 'project-1');
        });
    });

    describe('createJsondocProcessor', () => {
        it('should create a JsondocProcessor instance', () => {
            const processor = createJsondocProcessor(mockJsondocRepo, userId);
            expect(processor).toBeInstanceOf(JsondocProcessor);
        });
    });
}); 