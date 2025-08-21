import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { message } from 'antd';
import ChroniclesGenerationAction from '../ChroniclesGenerationAction';
import { apiService } from '../../../services/apiService';
import { useGenerationState } from '../../../hooks/useGenerationState';

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

// Mock the generation state hook
const mockGenerationState = {
    isAnyGenerating: false,
    isLocalGenerating: false,
    setLocalGenerating: vi.fn(),
    getDisabledReason: vi.fn(() => null),
    activeTransformTypes: [],
    hasActiveTransforms: false
};

vi.mock('../../../hooks/useGenerationState', () => ({
    useGenerationState: vi.fn(() => mockGenerationState)
}));

const mockApiService = vi.mocked(apiService);
const mockUseGenerationState = vi.mocked(useGenerationState);

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
        // Reset generation state mock
        mockUseGenerationState.mockReturnValue(mockGenerationState);
    });

    it('should disable textarea and show proper button text during generation', async () => {
        render(<ChroniclesGenerationAction {...mockProps} />);

        // Initial state - components should be enabled
        const textarea = screen.getByPlaceholderText('补充说明（可选）');
        const button = screen.getByRole('button', { name: /生成时间顺序大纲/ });

        expect(textarea).not.toBeDisabled();
        expect(button).toHaveTextContent('生成时间顺序大纲');

        // Mock generation state to show as generating
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            isLocalGenerating: true
        });

        // Re-render with generating state
        render(<ChroniclesGenerationAction {...mockProps} />);

        // During generation - components should be disabled
        const textareaDuringGeneration = screen.getByPlaceholderText('生成中，请稍等...');
        const buttonDuringGeneration = screen.getByRole('button', { name: /生成完成后可点击/ });

        expect(textareaDuringGeneration).toBeDisabled();
        expect(buttonDuringGeneration).toHaveTextContent('生成完成后可点击');
    });

    it('should prevent keyboard shortcuts during generation', async () => {
        // Mock generation state to show as generating
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            isLocalGenerating: true
        });

        render(<ChroniclesGenerationAction {...mockProps} />);

        const textarea = screen.getByPlaceholderText('生成中，请稍等...');

        // Try to trigger keyboard shortcut during generation
        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

        // API should not be called due to generation state
        expect(mockApiService.generateChroniclesFromOutline).not.toHaveBeenCalled();
    });

    it('should apply proper visual styling during generation', async () => {
        // First render without generation
        const { rerender } = render(<ChroniclesGenerationAction {...mockProps} />);

        let textarea = screen.getByPlaceholderText('补充说明（可选）');

        // Check initial styling
        expect(textarea).toHaveStyle({ opacity: '1' });

        // Mock generation state and re-render
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            isLocalGenerating: true
        });

        rerender(<ChroniclesGenerationAction {...mockProps} />);

        // Check disabled styling
        textarea = screen.getByPlaceholderText('生成中，请稍等...');
        expect(textarea).toHaveStyle({
            opacity: '0.6',
            cursor: 'not-allowed',
            background: '#0f0f0f',
            color: '#666'
        });
    });
});
