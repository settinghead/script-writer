import { vi } from 'vitest';
import { DB } from '../../server/database/types';

export function createMockKyselyDatabase() {
    return {
        selectFrom: vi.fn().mockReturnThis(),
        insertInto: vi.fn().mockReturnThis(),
        updateTable: vi.fn().mockReturnThis(),
        deleteFrom: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn(),
        executeTakeFirst: vi.fn(),
        executeTakeFirstOrThrow: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined)
    };
}

let mockIdCounter = 1;

export function createMockJsonDocRepository() {
    return {
        getJsonDoc: vi.fn(),
        createJsonDoc: vi.fn().mockImplementation(async (projectIdOrData: any, type?: string, data?: any, version?: string, metadata?: any, streamingStatus?: string, originType?: string) => {
            const jsonDocId = `mock-jsonDoc-${mockIdCounter++}`;

            // Handle both call signatures: old style (object) and new style (parameters)
            if (typeof projectIdOrData === 'object' && !type) {
                // Old style: createJsonDoc(data)
                const jsonDocData = projectIdOrData;
                return {
                    id: jsonDocId,
                    project_id: jsonDocData.projectId,
                    schema_type: jsonDocData.schemaType,
                    origin_type: jsonDocData.originType,
                    data: JSON.stringify(jsonDocData.data),
                    streaming_status: 'completed',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            } else {
                // New style: createJsonDoc(projectId, type, data, ...)
                return {
                    id: jsonDocId,
                    project_id: projectIdOrData,
                    schema_type: type,
                    origin_type: originType || 'ai_generated',
                    data: JSON.stringify(data),
                    streaming_status: streamingStatus || 'completed',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            }
        }),
        updateJsonDoc: vi.fn().mockResolvedValue({}),
        getLatestBrainstormIdeas: vi.fn(),
        getProjectJsonDocs: vi.fn(),
        getProjectJsonDocsByType: vi.fn(),
        getJsonDocsByType: vi.fn(),
        getAllProjectJsonDocsForLineage: vi.fn().mockResolvedValue([]),
        getAllProjectTransformsForLineage: vi.fn().mockResolvedValue([]),
        getAllProjectHumanTransformsForLineage: vi.fn().mockResolvedValue([]),
        getAllProjectTransformInputsForLineage: vi.fn().mockResolvedValue([]),
        getAllProjectTransformOutputsForLineage: vi.fn().mockResolvedValue([]),
        userHasProjectAccess: vi.fn().mockResolvedValue(true),
        rowToJsonDoc: vi.fn()
    };
}

let mockTransformIdCounter = 1;

export function createMockTransformRepository() {
    return {
        createTransform: vi.fn().mockImplementation(async (projectId: string, type: string, version?: string, status?: string, executionContext?: any) => {
            const transformId = `mock-transform-${mockTransformIdCounter++}`;
            return {
                id: transformId,
                project_id: projectId,
                type: type,
                status: status || 'running',
                streaming_status: 'pending',
                execution_context: executionContext || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }),
        getTransform: vi.fn(),
        getProjectTransforms: vi.fn(),
        updateTransformStatus: vi.fn().mockResolvedValue({}),
        addTransformInputs: vi.fn().mockResolvedValue({}),
        updateTransform: vi.fn().mockResolvedValue({}),
        addTransformOutputs: vi.fn().mockResolvedValue({}),
        addLLMPrompts: vi.fn().mockResolvedValue({}),
        addLLMTransform: vi.fn().mockResolvedValue({}),
    };
} 