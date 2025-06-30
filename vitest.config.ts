import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/__tests__/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            exclude: [
                '**/__tests__/**',
                '**/node_modules/**',
                '**/*.test.ts',
                '**/coverage/**'
            ]
        },
        testTimeout: 10000
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@tests': path.resolve(__dirname, './src/__tests__')
        }
    }
}); 