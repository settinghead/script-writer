import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { message } from 'antd';
import ChroniclesGenerationAction from '../ChroniclesGenerationAction';
import { apiService } from '../../../services/apiService';

// Mock dependencies
vi.mock('../../../services/apiService');
vi.mock('antd', async () => {
    const actual = await vi.importActual('antd') as any;
    return {
        ...actual,
        message: {
            error: vi.fn(),
            success: vi.fn(),
        },
    };
});

const mockApiService = vi.mocked(apiService);

describe('ChroniclesGenerationAction', () => {
    const mockProps = {
        projectId: 'test-project-id',
        onSuccess: vi.fn(),
        onError: vi.fn(),
        jsondocs: {
            outlineSettings: {
                id: 'outline-1',
                data: JSON.stringify({ title: 'Test Outline' }),
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should disable textarea and show proper button text during generation', async () => {
        // Setup API service to return a promise that doesn't resolve immediately
        let resolveGeneration: () => void;
        const generationPromise = new Promise<void>((resolve) => {
            resolveGeneration = resolve;
        });
        mockApiService.generateChroniclesFromOutline.mockReturnValue(generationPromise);

        render(<ChroniclesGenerationAction {...mockProps} />);

        // Initial state - components should be enabled
        const textarea = screen.getByPlaceholderText('补充说明（可选）');
        const button = screen.getByRole('button', { name: /生成时间顺序大纲/ });

        expect(textarea).not.toBeDisabled();
        expect(button).toHaveTextContent('生成时间顺序大纲');

        // Click generate button
        fireEvent.click(button);

        // During generation - components should be disabled
        await waitFor(() => {
            expect(textarea).toBeDisabled();
            expect(textarea).toHaveAttribute('placeholder', '生成中，请稍等...');
        });

        expect(button).toHaveTextContent('生成完成后可点击');
        expect(button).toBeDisabled();

        // Resolve the generation
        resolveGeneration!();
        await waitFor(() => {
            expect(textarea).not.toBeDisabled();
            expect(button).toHaveTextContent('生成时间顺序大纲');
        });

        expect(message.success).toHaveBeenCalledWith('时间顺序大纲生成已启动');
    });

    it('should prevent keyboard shortcuts during generation', async () => {
        let resolveGeneration: () => void;
        const generationPromise = new Promise<void>((resolve) => {
            resolveGeneration = resolve;
        });
        mockApiService.generateChroniclesFromOutline.mockReturnValue(generationPromise);

        render(<ChroniclesGenerationAction {...mockProps} />);

        const textarea = screen.getByPlaceholderText('补充说明（可选）');

        // Start generation
        fireEvent.click(screen.getByRole('button'));

        // Try to trigger keyboard shortcut during generation
        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

        // API should only be called once (from the button click, not the keyboard shortcut)
        expect(mockApiService.generateChroniclesFromOutline).toHaveBeenCalledTimes(1);

        resolveGeneration!();
        await waitFor(() => {
            expect(textarea).not.toBeDisabled();
        });
    });

    it('should apply proper visual styling during generation', async () => {
        let resolveGeneration: () => void;
        const generationPromise = new Promise<void>((resolve) => {
            resolveGeneration = resolve;
        });
        mockApiService.generateChroniclesFromOutline.mockReturnValue(generationPromise);

        render(<ChroniclesGenerationAction {...mockProps} />);

        const textarea = screen.getByPlaceholderText('补充说明（可选）');
        const button = screen.getByRole('button');

        // Check initial styling
        expect(textarea).toHaveStyle({ opacity: '1' });
        expect(button).toHaveStyle({ opacity: '1' });

        // Start generation
        fireEvent.click(button);

        // Check disabled styling
        await waitFor(() => {
            expect(textarea).toHaveStyle({
                opacity: '0.6',
                cursor: 'not-allowed',
                background: '#0f0f0f',
                color: '#666'
            });
            expect(button).toHaveStyle({ opacity: '0.7' });
        });

        resolveGeneration!();
        await waitFor(() => {
            expect(textarea).toHaveStyle({ opacity: '1' });
        });
    });
});
