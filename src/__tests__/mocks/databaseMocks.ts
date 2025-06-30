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

export function createMockArtifactRepository() {
    return {
        getArtifact: vi.fn(),
        createArtifact: vi.fn(),
        updateArtifact: vi.fn(),
        getLatestBrainstormIdeas: vi.fn(),
        getProjectArtifactsByType: vi.fn(),
        userHasProjectAccess: vi.fn().mockResolvedValue(true),
    };
}

export function createMockTransformRepository() {
    return {
        createTransform: vi.fn(),
        getTransform: vi.fn(),
        getProjectTransforms: vi.fn(),
        updateTransformStatus: vi.fn(),
        addTransformInputs: vi.fn(),
        updateTransform: vi.fn(),
        addTransformOutputs: vi.fn(),
        addLLMPrompts: vi.fn(),
        addLLMTransform: vi.fn(),
    };
} 