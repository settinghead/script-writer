import { vi } from 'vitest';
import { createCachedStreamObjectMock, createCachedStreamTextMock } from './mocks/aiSdkMocks';
import '@testing-library/jest-dom';

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

// Mock LLM Configuration - correct path
vi.mock('../server/transform-jsondoc-framework/LLMConfig', () => ({
    getLLMCredentials: vi.fn().mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'https://test-api.example.com',
        modelName: 'test-model',
        provider: 'openai'
    }),
    getLLMModel: vi.fn().mockResolvedValue({
        modelId: 'test-model',
        provider: 'test-provider',
        // Mock the actual language model interface
        generateText: vi.fn().mockResolvedValue({ text: 'Generated text' }),
        stream: vi.fn()
    })
}));

// Also mock relative import paths for LLMConfig
vi.mock('./LLMConfig', () => ({
    getLLMCredentials: vi.fn().mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'https://test-api.example.com',
        modelName: 'test-model',
        provider: 'openai'
    }),
    getLLMModel: vi.fn().mockResolvedValue({
        modelId: 'test-model',
        provider: 'test-provider',
        generateText: vi.fn().mockResolvedValue({ text: 'Generated text' }),
        stream: vi.fn()
    })
}));

// Mock lineage resolution utilities
// Note: Mock multiple possible import paths since different files import it differently
vi.mock('@/common/utils/lineageResolution', () => ({
    buildLineageGraph: vi.fn().mockReturnValue({}),
    findLatestJsondoc: vi.fn().mockReturnValue({ jsondocId: 'test-brainstorm-1' }),

    extractEffectiveOutlines: vi.fn().mockReturnValue([]),
    findEffectiveBrainstormIdeas: vi.fn().mockReturnValue([]),
    findMainWorkflowPath: vi.fn().mockReturnValue([]),
    convertEffectiveIdeasToIdeaWithTitle: vi.fn().mockReturnValue([
        {
            title: '误爱成宠',
            body: '霸道总裁与普通员工的甜宠故事...',
            jsondocId: 'test-brainstorm-1',
            originalJsondocId: 'test-brainstorm-1'
        }
    ])
}));

// Also mock for the relative import path used by agentContext.ts
vi.mock('../../common/utils/lineageResolution', () => ({
    buildLineageGraph: vi.fn().mockReturnValue({}),
    findLatestJsondoc: vi.fn().mockReturnValue({ jsondocId: 'test-brainstorm-1' }),
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
            jsondocId: 'test-brainstorm-1',
            originalJsondocId: 'test-brainstorm-1'
        }
    ])
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LLM_API_KEY = 'test-api-key';
process.env.LLM_BASE_URL = 'https://test-api.example.com';
process.env.LLM_MODEL_NAME = 'test-model';
process.env.LLM_PROVIDER = 'openai'; 