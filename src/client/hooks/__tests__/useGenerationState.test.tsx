import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGenerationState, useIsGenerating } from '../useGenerationState';
import { ProjectDataProvider } from '../../contexts/ProjectDataContext';

// Mock the project data context
const mockCanonicalContext = {
    hasActiveTransforms: false,
    activeTransforms: [],
    canonicalBrainstormIdea: null,
    canonicalBrainstormCollection: null,
    canonicalOutlineSettings: null,
    canonicalChronicles: null,
    canonicalEpisodePlanning: null,
    canonicalBrainstormInput: null,
    canonicalEpisodeSynopsisList: [],
    canonicalEpisodeScriptsList: [],
    lineageGraph: { nodes: new Map(), edges: new Map(), paths: new Map(), rootNodes: new Set(), leafNodes: [] },
    rootNodes: [],
    leafNodes: []
};

vi.mock('../../contexts/ProjectDataContext', () => ({
    useProjectData: vi.fn(() => ({
        canonicalContext: mockCanonicalContext
    })),
    ProjectDataProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const { useProjectData } = await import('../../contexts/ProjectDataContext');
const mockUseProjectData = vi.mocked(useProjectData);

describe('useGenerationState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the canonical context to default
        mockUseProjectData.mockReturnValue({
            canonicalContext: mockCanonicalContext
        } as any);
    });

    it('should return false when no generation is happening', () => {
        const { result } = renderHook(() => useGenerationState('test-component'));

        expect(result.current.isAnyGenerating).toBe(false);
        expect(result.current.isLocalGenerating).toBe(false);
        expect(result.current.hasActiveTransforms).toBe(false);
        expect(result.current.getDisabledReason()).toBe(null);
    });

    it('should detect project-wide active transforms', () => {
        // Mock active transforms
        const activeTransforms = [{
            id: 'transform-1',
            transform_name: '时间顺序大纲生成',
            status: 'running' as const
        }];

        mockUseProjectData.mockReturnValue({
            canonicalContext: {
                ...mockCanonicalContext,
                hasActiveTransforms: true,
                activeTransforms
            }
        } as any);

        const { result } = renderHook(() => useGenerationState('test-component'));

        expect(result.current.isAnyGenerating).toBe(true);
        expect(result.current.hasActiveTransforms).toBe(true);
        expect(result.current.activeTransformTypes).toEqual(['时间顺序大纲生成']);
        expect(result.current.getDisabledReason()).toBe('时间顺序大纲生成 生成中，生成完成后可点击');
    });

    it('should manage local generation state', () => {
        const { result } = renderHook(() => useGenerationState('test-component'));

        // Initially not generating
        expect(result.current.isLocalGenerating).toBe(false);
        expect(result.current.isAnyGenerating).toBe(false);

        // Set local generation to true
        act(() => {
            result.current.setLocalGenerating(true);
        });

        expect(result.current.isLocalGenerating).toBe(true);
        expect(result.current.isAnyGenerating).toBe(true);
        expect(result.current.getDisabledReason()).toBe('生成中，请稍等...');

        // Set local generation to false
        act(() => {
            result.current.setLocalGenerating(false);
        });

        expect(result.current.isLocalGenerating).toBe(false);
        expect(result.current.isAnyGenerating).toBe(false);
    });

    it('should handle multiple local generation states across components', () => {
        const { result: result1 } = renderHook(() => useGenerationState('component-1'));
        const { result: result2 } = renderHook(() => useGenerationState('component-2'));

        // Set component-1 to generating
        act(() => {
            result1.current.setLocalGenerating(true);
        });

        // Both components should detect generation happening
        expect(result1.current.isLocalGenerating).toBe(true);
        expect(result1.current.isAnyGenerating).toBe(true);
        expect(result2.current.isLocalGenerating).toBe(false);
        expect(result2.current.isAnyGenerating).toBe(true);

        // Set component-2 to generating as well
        act(() => {
            result2.current.setLocalGenerating(true);
        });

        expect(result1.current.isAnyGenerating).toBe(true);
        expect(result2.current.isAnyGenerating).toBe(true);

        // Stop component-1 generation
        act(() => {
            result1.current.setLocalGenerating(false);
        });

        // Component-2 still generating, so isAnyGenerating should still be true
        // But component-1's isLocalGenerating should be false
        expect(result1.current.isLocalGenerating).toBe(false);
        expect(result1.current.isAnyGenerating).toBe(true);
        expect(result2.current.isLocalGenerating).toBe(true);
        expect(result2.current.isAnyGenerating).toBe(true);

        // Stop component-2 generation
        act(() => {
            result2.current.setLocalGenerating(false);
        });

        // Now no generation happening
        expect(result1.current.isAnyGenerating).toBe(false);
        expect(result2.current.isAnyGenerating).toBe(false);
    });

    it('should combine project and local generation states', () => {
        // Start with project-wide generation
        const activeTransforms = [{
            id: 'transform-1',
            transform_name: '剧本设定生成',
            status: 'running' as const
        }];

        mockUseProjectData.mockReturnValue({
            canonicalContext: {
                ...mockCanonicalContext,
                hasActiveTransforms: true,
                activeTransforms
            }
        } as any);

        const { result } = renderHook(() => useGenerationState('test-component'));

        // Should be generating due to project-wide transforms
        expect(result.current.isAnyGenerating).toBe(true);
        expect(result.current.hasActiveTransforms).toBe(true);

        // Add local generation as well
        act(() => {
            result.current.setLocalGenerating(true);
        });

        // Still generating (both project and local)
        expect(result.current.isAnyGenerating).toBe(true);
        expect(result.current.isLocalGenerating).toBe(true);

        // Stop local generation (but project still running)
        act(() => {
            result.current.setLocalGenerating(false);
        });

        // Still generating due to project transforms
        expect(result.current.isAnyGenerating).toBe(true);
        expect(result.current.isLocalGenerating).toBe(false);
    });
});

describe('useIsGenerating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseProjectData.mockReturnValue({
            canonicalContext: mockCanonicalContext
        } as any);
    });

    it('should return simple boolean for generation state', () => {
        const { result } = renderHook(() => useIsGenerating());

        expect(result.current).toBe(false);
    });

    it('should detect when any generation is happening', () => {
        // Set up active transforms
        mockUseProjectData.mockReturnValue({
            canonicalContext: {
                ...mockCanonicalContext,
                hasActiveTransforms: true,
                activeTransforms: [{ id: 'transform-1', status: 'running' }]
            }
        } as any);

        const { result } = renderHook(() => useIsGenerating());

        expect(result.current).toBe(true);
    });
});
