import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChronicleStageWrapper } from '../ChronicleStageWrapper';
import { useLineageResolution } from '../../../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../../../contexts/ProjectDataContext';

// Mock dependencies
vi.mock('../../../transform-artifact-framework/useLineageResolution');
vi.mock('../../../contexts/ProjectDataContext');
vi.mock('../ReadOnlyArtifactDisplay', () => ({
    ReadOnlyArtifactDisplay: ({ data, title }: any) => (
        <div data-testid="read-only-display">
            <h3>{title}</h3>
            <div data-testid="stage-data">{data ? JSON.stringify(data) : 'null'}</div>
        </div>
    )
}));
vi.mock('../../../transform-artifact-framework/contexts/YJSArtifactContext', () => ({
    YJSArtifactProvider: ({ children }: any) => (
        <div data-testid="yjs-provider">{children}</div>
    )
}));

const mockUseLineageResolution = vi.mocked(useLineageResolution);
const mockUseProjectData = vi.mocked(useProjectData);

describe('ChronicleStageWrapper', () => {
    const mockChroniclesArtifact = {
        id: 'chronicles-artifact-id',
        schema_type: 'chronicles_schema',
        type: 'chronicles',
        origin_type: 'ai_generated',
        created_at: '2025-01-01T00:00:00Z',
        data: {
            stages: [
                {
                    title: '历史起源阶段：数据之母与神经革命（故事开始前25年）',
                    stageSynopsis: '天才女科学家林婉清与丈夫沈国栋共同研发初代脑机接口系统，意外发现意识可部分脱离肉体存在。',
                    event: '林婉清牺牲自己保护核心技术，沈曜童年创伤形成，陈博士首次接触禁忌研究领域'
                },
                {
                    title: '科技萌芽阶段：孤岛少年与暗网传说（故事开始前18-5年）',
                    stageSynopsis: '失去母亲的沈曜被送往特殊教育机构，在那里他展现出超凡的编程天赋但社交障碍日益严重。',
                    event: '各主要角色在不同维度接触科技禁区，命运轨迹悄然交汇'
                }
            ]
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock setup - no human transforms, so should be read-only
        mockUseLineageResolution.mockReturnValue({
            latestArtifactId: 'chronicles-artifact-id',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$.stages[0]',
            lineagePath: [],
            depth: 1,
            originalArtifactId: 'chronicles-artifact-id'
        });

        mockUseProjectData.mockReturnValue({
            artifacts: [mockChroniclesArtifact],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);
    });

    it('should access stage data directly from artifacts for read-only display', () => {
        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={0}
            />
        );

        // Should render read-only display
        expect(screen.getByTestId('read-only-display')).toBeInTheDocument();

        // Should show stage data from direct artifact access (not YJS)
        const stageDataElement = screen.getByTestId('stage-data');
        const stageDataText = stageDataElement.textContent;

        // Verify the stage data contains expected content
        expect(stageDataText).toContain('历史起源阶段：数据之母与神经革命');
        expect(stageDataText).toContain('天才女科学家林婉清与丈夫沈国栋');
        expect(stageDataText).toContain('林婉清牺牲自己保护核心技术');
    });

    it('should access second stage data correctly', () => {
        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={1}
            />
        );

        // Should render read-only display
        expect(screen.getByTestId('read-only-display')).toBeInTheDocument();

        // Should show second stage data
        const stageDataElement = screen.getByTestId('stage-data');
        const stageDataText = stageDataElement.textContent;

        expect(stageDataText).toContain('科技萌芽阶段：孤岛少年与暗网传说');
        expect(stageDataText).toContain('失去母亲的沈曜被送往特殊教育机构');
    });

    it('should render editable form when override artifact is provided', () => {
        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={0}
                overrideArtifactId="human-transform-artifact-id"
            />
        );

        // Should render YJS provider for editable mode
        expect(screen.getByTestId('yjs-provider')).toBeInTheDocument();

        // Should not render read-only display
        expect(screen.queryByTestId('read-only-display')).not.toBeInTheDocument();
    });

    it('should handle missing artifact gracefully', () => {
        mockUseProjectData.mockReturnValue({
            artifacts: [],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={0}
            />
        );

        // Should render read-only display
        expect(screen.getByTestId('read-only-display')).toBeInTheDocument();

        // Should show null data
        const stageDataElement = screen.getByTestId('stage-data');
        expect(stageDataElement.textContent).toBe('null');
    });

    it('should handle out-of-bounds stage index gracefully', () => {
        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={10} // Out of bounds
            />
        );

        // Should render read-only display
        expect(screen.getByTestId('read-only-display')).toBeInTheDocument();

        // Should show null data for out of bounds
        const stageDataElement = screen.getByTestId('stage-data');
        expect(stageDataElement.textContent).toBe('null');
    });

    it('should handle string-formatted data correctly', () => {
        const artifactWithStringData = {
            ...mockChroniclesArtifact,
            data: JSON.stringify(mockChroniclesArtifact.data)
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [artifactWithStringData],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={0}
            />
        );

        // Should parse string data and render correctly
        const stageDataElement = screen.getByTestId('stage-data');
        const stageDataText = stageDataElement.textContent;
        expect(stageDataText).toContain('历史起源阶段：数据之母与神经革命');
    });

    it('should handle corrupted JSON data gracefully', () => {
        const artifactWithCorruptedData = {
            ...mockChroniclesArtifact,
            data: 'invalid json {'
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [artifactWithCorruptedData],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        render(
            <ChronicleStageWrapper
                chroniclesArtifactId="chronicles-artifact-id"
                stageIndex={0}
            />
        );

        // Should render read-only display
        expect(screen.getByTestId('read-only-display')).toBeInTheDocument();

        // Should show null data due to parsing error
        const stageDataElement = screen.getByTestId('stage-data');
        expect(stageDataElement.textContent).toBe('null');
    });

    describe('lineage resolution integration', () => {
        it('should use lineage resolution to determine editability', () => {
            // Mock lineage resolution indicating human transform exists
            mockUseLineageResolution.mockReturnValue({
                latestArtifactId: 'human-transform-artifact-id',
                hasLineage: true,
                isLoading: false,
                error: null,
                resolvedPath: '$.stages[0]',
                lineagePath: [
                    {
                        type: 'artifact' as const,
                        artifactId: 'chronicles-artifact-id',
                        path: '$.stages[0]',
                        depth: 0,
                        isLeaf: false,
                        createdAt: '2025-01-01T00:00:00Z',
                        artifactType: 'chronicles',
                        sourceTransform: "none",
                        schemaType: 'chronicles_schema',
                        originType: 'ai_generated' as const,
                        artifact: {} as any
                    },
                    {
                        type: 'artifact' as const,
                        artifactId: 'human-transform-artifact-id',
                        path: '$.stages[0]',
                        depth: 1,
                        isLeaf: true,
                        createdAt: '2025-01-01T01:00:00Z',
                        artifactType: 'chronicles',
                        sourceTransform: "none",
                        schemaType: 'chronicles_schema',
                        originType: 'user_input' as const,
                        artifact: {} as any
                    }
                ],
                depth: 2,
                originalArtifactId: 'chronicles-artifact-id'
            });

            render(
                <ChronicleStageWrapper
                    chroniclesArtifactId="chronicles-artifact-id"
                    stageIndex={0}
                />
            );

            // Should render editable form when lineage indicates human transform
            expect(screen.getByTestId('yjs-provider')).toBeInTheDocument();
            expect(screen.queryByTestId('read-only-display')).not.toBeInTheDocument();
        });

        it('should handle lineage resolution loading state', () => {
            mockUseLineageResolution.mockReturnValue({
                latestArtifactId: null,
                hasLineage: false,
                isLoading: true,
                error: null,
                resolvedPath: '$.stages[0]',
                lineagePath: [],
                depth: 0,
                originalArtifactId: 'chronicles-artifact-id'
            });

            render(
                <ChronicleStageWrapper
                    chroniclesArtifactId="chronicles-artifact-id"
                    stageIndex={0}
                />
            );

            // Should render read-only display while loading
            expect(screen.getByTestId('read-only-display')).toBeInTheDocument();
        });

        it('should handle lineage resolution errors gracefully', () => {
            mockUseLineageResolution.mockReturnValue({
                latestArtifactId: null,
                hasLineage: false,
                isLoading: false,
                error: new Error('Lineage resolution failed'),
                resolvedPath: '$.stages[0]',
                lineagePath: [],
                depth: 0,
                originalArtifactId: 'chronicles-artifact-id'
            });

            render(
                <ChronicleStageWrapper
                    chroniclesArtifactId="chronicles-artifact-id"
                    stageIndex={0}
                />
            );

            // Should fallback to read-only display on error
            expect(screen.getByTestId('read-only-display')).toBeInTheDocument();
        });
    });
}); 