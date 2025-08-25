import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SmartAIButton from '../SmartAIButton';

// Mock the useGenerationState hook
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

const { useGenerationState } = await import('../../../hooks/useGenerationState');
const mockUseGenerationState = vi.mocked(useGenerationState);

describe('SmartAIButton', () => {
    const mockOnClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default state
        mockUseGenerationState.mockReturnValue(mockGenerationState);
    });

    it('should render normally when not generating', () => {
        render(
            <SmartAIButton onClick={mockOnClick}>
                Test Button
            </SmartAIButton>
        );

        const button = screen.getByRole('button', { name: /test button/i });
        expect(button).toBeEnabled();
        expect(button).toHaveTextContent('Test Button');
    });

    it('should disable and show generating text when any generation is happening', () => {
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            getDisabledReason: () => '时间顺序大纲生成 生成中，生成完成后可点击'
        });

        render(
            <SmartAIButton
                onClick={mockOnClick}
                generatingText="处理中..."
            >
                Generate Content
            </SmartAIButton>
        );

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('生成完成后可点击');
    });

    it('should show tooltip with disabled reason when disabled', () => {
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            getDisabledReason: () => '故事设定生成 生成中，生成完成后可点击'
        });

        render(
            <SmartAIButton onClick={mockOnClick}>
                Test Button
            </SmartAIButton>
        );

        // Button should be disabled
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });

    it('should respect manual disabled state', () => {
        render(
            <SmartAIButton
                onClick={mockOnClick}
                manuallyDisabled={true}
                customDisabledReason="Missing required data"
            >
                Test Button
            </SmartAIButton>
        );

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });

    it('should prevent click when disabled by generation', () => {
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            getDisabledReason: () => '生成中'
        });

        render(
            <SmartAIButton onClick={mockOnClick}>
                Test Button
            </SmartAIButton>
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should allow click when not disabled', () => {
        render(
            <SmartAIButton onClick={mockOnClick}>
                Test Button
            </SmartAIButton>
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should allow click during generation when allowClickDuringGeneration is true', () => {
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true,
            getDisabledReason: () => '生成中'
        });

        render(
            <SmartAIButton
                onClick={mockOnClick}
                allowClickDuringGeneration={true}
            >
                Test Button
            </SmartAIButton>
        );

        const button = screen.getByRole('button');
        expect(button).toBeEnabled();

        fireEvent.click(button);
        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should register with the specified componentId', () => {
        const componentId = 'test-component-id';

        render(
            <SmartAIButton
                componentId={componentId}
                onClick={mockOnClick}
            >
                Test Button
            </SmartAIButton>
        );

        expect(mockUseGenerationState).toHaveBeenCalledWith(componentId);
    });

    it('should handle loading state properly', () => {
        render(
            <SmartAIButton
                onClick={mockOnClick}
                loading={true}
            >
                Test Button
            </SmartAIButton>
        );

        // Ant Design Button with loading should be disabled
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });

    it('should show custom generating text', () => {
        mockUseGenerationState.mockReturnValue({
            ...mockGenerationState,
            isAnyGenerating: true
        });

        const customText = "自定义生成中文本";
        render(
            <SmartAIButton
                onClick={mockOnClick}
                generatingText={customText}
            >
                Original Text
            </SmartAIButton>
        );

        const button = screen.getByRole('button');
        expect(button).toHaveTextContent(customText);
    });
});
