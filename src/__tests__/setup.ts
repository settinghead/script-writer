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

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LLM_API_KEY = 'test-api-key'; 