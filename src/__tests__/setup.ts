import { vi } from 'vitest';
import { createCachedStreamObjectMock, createCachedStreamTextMock } from './mocks/aiSdkMocks';

// Mock AI SDK functions globally
vi.mock('ai', () => ({
    streamText: createCachedStreamTextMock(),
    streamObject: createCachedStreamObjectMock(),
    generateText: vi.fn().mockResolvedValue({ text: 'Generated text' }),
    tool: vi.fn(),
    wrapLanguageModel: vi.fn(),
    extractReasoningMiddleware: vi.fn()
}));

// Mock database connection
vi.mock('../server/database/connection', () => ({
    db: {
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
    }
}));

// Mock LLM Configuration
vi.mock('../server/services/LLMConfig', () => ({
    getLLMCredentials: vi.fn().mockReturnValue({
        apiKey: 'test-api-key'
    }),
    getLLMModel: vi.fn().mockReturnValue({
        modelId: 'test-model',
        provider: 'test-provider'
    }),
    getTemperature: vi.fn().mockReturnValue(0.7),
    getTopP: vi.fn().mockReturnValue(0.9),
    getMaxTokens: vi.fn().mockReturnValue(2000)
}));

// Mock lineage resolution utilities
// Note: Mock multiple possible import paths since different files import it differently
vi.mock('../common/utils/lineageResolution', () => ({
    buildLineageGraph: vi.fn().mockReturnValue({}),
    findLatestArtifact: vi.fn().mockReturnValue({ artifactId: 'test-brainstorm-1' }),
    extractEffectiveBrainstormIdeas: vi.fn().mockReturnValue([
        {
            title: '误爱成宠',
            body: '霸道总裁与普通员工的甜宠故事...',
            metadata: { ideaIndex: 0 }
        }
    ]),
    extractEffectiveOutlines: vi.fn().mockReturnValue([]),
    findEffectiveBrainstormIdeas: vi.fn().mockReturnValue([]),
    findMainWorkflowPath: vi.fn().mockReturnValue([]),
    convertEffectiveIdeasToIdeaWithTitle: vi.fn().mockReturnValue([
        {
            title: '误爱成宠',
            body: '霸道总裁与普通员工的甜宠故事...',
            artifactId: 'test-brainstorm-1',
            originalArtifactId: 'test-brainstorm-1'
        }
    ])
}));

// Also mock for the relative import path used by agentContext.ts
vi.mock('../../common/utils/lineageResolution', () => ({
    buildLineageGraph: vi.fn().mockReturnValue({}),
    findLatestArtifact: vi.fn().mockReturnValue({ artifactId: 'test-brainstorm-1' }),
    extractEffectiveBrainstormIdeas: vi.fn().mockReturnValue([
        {
            title: '误爱成宠',
            body: '霸道总裁与普通员工的甜宠故事...',
            metadata: { ideaIndex: 0 }
        }
    ]),
    extractEffectiveOutlines: vi.fn().mockReturnValue([]),
    findEffectiveBrainstormIdeas: vi.fn().mockReturnValue([]),
    findMainWorkflowPath: vi.fn().mockReturnValue([]),
    convertEffectiveIdeasToIdeaWithTitle: vi.fn().mockReturnValue([
        {
            title: '误爱成宠',
            body: '霸道总裁与普通员工的甜宠故事...',
            artifactId: 'test-brainstorm-1',
            originalArtifactId: 'test-brainstorm-1'
        }
    ])
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LLM_API_KEY = 'test-api-key'; 