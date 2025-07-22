import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/dist-server/**',
            '**/dist-client/**',
            '**/coverage/**'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            exclude: [
                '**/__tests__/**',
                '**/node_modules/**',
                '**/*.test.ts',
                '**/coverage/**',
                '**/dist/**',
                '**/dist-server/**',
                '**/dist-client/**'
            ]
        },
        // Longer timeout for database operations
        testTimeout: 30000,
        // Run tests serially for database tests to avoid conflicts
        poolOptions: {
            threads: {
                singleThread: true
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@tests': path.resolve(__dirname, './src/__tests__')
        }
    }
}); 