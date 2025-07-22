import { vi } from 'vitest';
import { createCachedStreamObjectMock, createCachedStreamTextMock } from './mocks/aiSdkMocks';
import '@testing-library/jest-dom';
import { teardownTestDatabase } from './database/pgmock-setup';

// Mock AI SDK functions globally (keep existing AI mocking)
vi.mock('ai', () => ({
    streamText: createCachedStreamTextMock(),
    streamObject: createCachedStreamObjectMock(),
    generateText: vi.fn().mockResolvedValue({ text: 'Generated text' }),
    tool: vi.fn(),
    wrapLanguageModel: vi.fn(),
    extractReasoningMiddleware: vi.fn(),
    embed: vi.fn(),
    embedMany: vi.fn()
}));

// Mock LLM Configuration (keep existing)
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
        generateText: vi.fn().mockResolvedValue({ text: 'Generated text' }),
        stream: vi.fn()
    }),
    getEmbeddingCredentials: vi.fn().mockReturnValue({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        modelName: 'text-embedding-3-small',
        provider: 'openai',
        dimensions: 1536
    }),
    getEmbeddingModel: vi.fn().mockResolvedValue({
        modelId: 'text-embedding-3-small'
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
    }),
    getEmbeddingCredentials: vi.fn().mockReturnValue({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        modelName: 'text-embedding-3-small',
        provider: 'openai',
        dimensions: 1536
    }),
    getEmbeddingModel: vi.fn().mockResolvedValue({
        modelId: 'text-embedding-3-small'
    })
}));

// Mock lineage resolution utilities (keep existing)
vi.mock('../common/utils/lineageResolution', () => ({
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
process.env.EMBEDDING_DIMENSIONS = '1536'; // Default OpenAI embedding dimensions for tests

// Global test teardown - cleanup database connections
process.on('exit', async () => {
    await teardownTestDatabase();
});

// Handle process termination signals
process.on('SIGINT', async () => {
    await teardownTestDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await teardownTestDatabase();
    process.exit(0);
}); 