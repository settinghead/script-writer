import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChroniclesDisplay } from '../ChroniclesDisplay';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLineageResolution } from '../../transform-artifact-framework/useLineageResolution';

// Mock dependencies
vi.mock('../../contexts/ProjectDataContext');
vi.mock('../../transform-artifact-framework/useLineageResolution');
vi.mock('../shared', () => ({
    SectionWrapper: ({ children, title }: any) => (
        <div data-testid="section-wrapper">
            <h2>{title}</h2>
            {children}
        </div>
    ),
    ArtifactSchemaType: {
        CHRONICLES: 'chronicles'
    },
    ArtifactDisplayWrapper: ({ artifact, isEditable, title }: any) => (
        <div data-testid="artifact-display-wrapper"
            data-artifact-id={artifact?.id}
            data-is-editable={isEditable}>
            <h3>{title}</h3>
            <div>Artifact: {artifact?.id}</div>
            <div>Editable: {isEditable ? 'Yes' : 'No'}</div>
        </div>
    )
}));
vi.mock('../shared/EditableChroniclesForm', () => ({
    default: () => <div data-testid="editable-chronicles-form">Editable Chronicles Form</div>
}));

const mockUseProjectData = vi.mocked(useProjectData);
const mockUseLineageResolution = vi.mocked(useLineageResolution);

describe('ChroniclesDisplay', () => {
    const mockChroniclesArtifact = {
        id: 'chronicles-artifact-id',
        schema_type: 'chronicles',
        schema_version: 'v1',
        origin_type: 'ai_generated',
        created_at: '2025-01-01T00:00:00Z',
        data: {
            stages: [
                {
                    title: '历史起源阶段：数据之母与神经革命（故事开始前25年）',
                    stageSynopsis: '天才女科学家林婉清与丈夫沈国栋共同研发初代脑机接口系统，意外发现意识可部分脱离肉体存在。',
                    event: '林婉清牺牲自己保护核心技术，沈曜童年创伤形成，陈博士首次接触禁忌研究领域',
                    emotionArcs: [
                        { character: '林婉清', development: '从科学狂热到母爱觉醒' },
                        { character: '沈国栋', development: '从信任到背叛的痛苦' }
                    ],
                    relationshipDevelopments: [
                        { characters: ['林婉清', '沈国栋'], development: '夫妻关系破裂' },
                        { characters: ['林婉清', '沈曜'], development: '母子情深建立' }
                    ],
                    insights: [
                        '科技进步需要伦理约束',
                        '家庭情感超越科学理性',
                        '权力斗争中的牺牲精神'
                    ]
                },
                {
                    title: '科技萌芽阶段：孤岛少年与暗网传说（故事开始前18-5年）',
                    stageSynopsis: '失去母亲的沈曜被送往特殊教育机构，在那里他展现出超凡的编程天赋但社交障碍日益严重。',
                    event: '各主要角色在不同维度接触科技禁区，命运轨迹悄然交汇',
                    emotionArcs: [
                        { character: '沈曜', development: '从孤独到自我封闭' },
                        { character: '陆曼', development: '从天真到复仇决心' }
                    ],
                    relationshipDevelopments: [
                        { characters: ['沈曜', '导师'], development: '师生关系建立' },
                        { characters: ['陆曼', '父母'], development: '失去亲人的痛苦' }
                    ],
                    insights: [
                        '天才往往伴随孤独',
                        '创伤塑造性格',
                        '技术可以是逃避现实的工具',
                        '复仇动机的形成过程'
                    ]
                }
            ]
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock setup
        mockUseProjectData.mockReturnValue({
            artifacts: [mockChroniclesArtifact],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestArtifactId: 'chronicles-artifact-id',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalArtifactId: 'chronicles-artifact-id'
        });
    });

    it('should render chronicles display with whole-document editing when data is available', async () => {
        render(<ChroniclesDisplay />);

        await waitFor(() => {
            expect(screen.getByTestId('section-wrapper')).toBeInTheDocument();
        });

        // Check that the section wrapper is rendered
        expect(screen.getByTestId('section-wrapper')).toBeInTheDocument();

        // Check that the artifact display wrapper is rendered
        expect(screen.getByTestId('artifact-display-wrapper')).toBeInTheDocument();

        // Verify artifact ID is passed correctly
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-artifact-id',
            'chronicles-artifact-id'
        );

        // Check that it's not editable by default (ai_generated artifact)
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'false'
        );

        // Component should be rendered successfully
    });

    it('should render chronicles as editable when artifact is user_input with no descendants', async () => {
        const editableArtifact = {
            ...mockChroniclesArtifact,
            origin_type: 'user_input'
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [editableArtifact],
            transformInputs: [], // No descendants
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestArtifactId: editableArtifact.id,
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalArtifactId: editableArtifact.id
        });

        render(<ChroniclesDisplay />);

        await waitFor(() => {
            expect(screen.getByTestId('artifact-display-wrapper')).toBeInTheDocument();
        });

        // Check that it's editable
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'true'
        );
    });

    it('should use props when provided (from action computation)', async () => {
        const propsArtifact = {
            ...mockChroniclesArtifact,
            id: 'props-artifact-id',
            origin_type: 'user_input'
        };

        render(<ChroniclesDisplay isEditable={true} chroniclesArtifact={propsArtifact} />);

        await waitFor(() => {
            expect(screen.getByTestId('artifact-display-wrapper')).toBeInTheDocument();
        });

        // Check that it uses the props artifact
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-artifact-id',
            'props-artifact-id'
        );

        // Check that it's editable as specified in props
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'true'
        );
    });

    it('should return null when artifacts are pending', () => {
        mockUseProjectData.mockReturnValue({
            artifacts: "pending",
            isLoading: true,
            isError: false,
            error: null
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when artifacts are in error state', () => {
        mockUseProjectData.mockReturnValue({
            artifacts: "error",
            isLoading: false,
            isError: true,
            error: new Error('Failed to load')
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when no chronicles artifacts are found', () => {
        mockUseProjectData.mockReturnValue({
            artifacts: [
                {
                    id: 'other-artifact',
                    schema_type: 'outline_settings',
                    type: 'outline_settings',
                    data: { title: 'Some outline' }
                }
            ],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should still render artifact display wrapper even with no stages', () => {
        const artifactWithNoStages = {
            ...mockChroniclesArtifact,
            data: { stages: [] }
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [artifactWithNoStages],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        // Should still render the artifact display wrapper
        expect(screen.getByTestId('artifact-display-wrapper')).toBeInTheDocument();
    });

    it('should handle string-formatted data correctly', () => {
        const artifactWithStringData = {
            ...mockChroniclesArtifact,
            data: JSON.stringify(mockChroniclesArtifact.data)
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [artifactWithStringData],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        expect(screen.getByTestId('artifact-display-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-artifact-id',
            'chronicles-artifact-id'
        );
    });

    it('should prioritize chronicles over legacy chronicles type', () => {
        const legacyChroniclesArtifact = {
            id: 'legacy-chronicles',
            schema_type: null,
            type: 'chronicles',
            origin_type: 'ai_generated',
            created_at: '2025-01-01T00:00:00Z',
            data: { stages: [{ title: 'Legacy stage' }] }
        };

        const modernChroniclesArtifact = {
            id: 'modern-chronicles',
            schema_type: 'chronicles',
            type: 'chronicles',
            origin_type: 'ai_generated',
            created_at: '2025-01-01T01:00:00Z',
            data: { stages: [{ title: 'Modern stage' }] }
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [legacyChroniclesArtifact, modernChroniclesArtifact],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestArtifactId: 'modern-chronicles',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalArtifactId: 'modern-chronicles'
        });

        render(<ChroniclesDisplay />);

        // Should use the modern chronicles artifact
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-artifact-id',
            'modern-chronicles'
        );
    });

    it('should handle lineage resolution errors gracefully', () => {
        mockUseLineageResolution.mockReturnValue({
            latestArtifactId: null,
            hasLineage: false,
            isLoading: false,
            error: new Error('Lineage resolution failed'),
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalArtifactId: 'chronicles-artifact-id'
        });

        render(<ChroniclesDisplay />);

        expect(screen.getByText(/加载时间顺序大纲时出错/)).toBeInTheDocument();
        expect(screen.getByText(/Lineage resolution failed/)).toBeInTheDocument();
    });

    it('should return null while lineage is still loading', () => {
        mockUseLineageResolution.mockReturnValue({
            latestArtifactId: null,
            hasLineage: false,
            isLoading: true,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalArtifactId: 'chronicles-artifact-id'
        });

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should handle corrupted JSON data gracefully', () => {
        const artifactWithCorruptedData = {
            ...mockChroniclesArtifact,
            data: 'invalid json {'
        };

        mockUseProjectData.mockReturnValue({
            artifacts: [artifactWithCorruptedData],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        // Should still render the artifact display wrapper even with corrupted data
        expect(screen.getByTestId('artifact-display-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
            'data-artifact-id',
            'chronicles-artifact-id'
        );
    });

    describe('artifact selection logic', () => {
        it('should prefer AI-generated artifacts over user-input ones', () => {
            const userInputArtifact = {
                ...mockChroniclesArtifact,
                id: 'user-input-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T00:00:00Z'
            };

            const aiGeneratedArtifact = {
                ...mockChroniclesArtifact,
                id: 'ai-generated-chronicles',
                origin_type: 'ai_generated',
                created_at: '2025-01-01T01:00:00Z'
            };

            mockUseProjectData.mockReturnValue({
                artifacts: [userInputArtifact, aiGeneratedArtifact],
                transformInputs: [],
                isLoading: false,
                isError: false,
                error: null
            } as any);

            mockUseLineageResolution.mockReturnValue({
                latestArtifactId: 'ai-generated-chronicles',
                hasLineage: false,
                isLoading: false,
                error: null,
                resolvedPath: '$',
                lineagePath: [],
                depth: 1,
                originalArtifactId: 'ai-generated-chronicles'
            });

            render(<ChroniclesDisplay />);

            expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
                'data-artifact-id',
                'ai-generated-chronicles'
            );
        });

        it('should fallback to earliest artifact when no AI-generated found', () => {
            const laterArtifact = {
                ...mockChroniclesArtifact,
                id: 'later-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T02:00:00Z'
            };

            const earlierArtifact = {
                ...mockChroniclesArtifact,
                id: 'earlier-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T01:00:00Z'
            };

            mockUseProjectData.mockReturnValue({
                artifacts: [laterArtifact, earlierArtifact],
                transformInputs: [],
                isLoading: false,
                isError: false,
                error: null
            } as any);

            mockUseLineageResolution.mockReturnValue({
                latestArtifactId: 'earlier-chronicles',
                hasLineage: false,
                isLoading: false,
                error: null,
                resolvedPath: '$',
                lineagePath: [],
                depth: 1,
                originalArtifactId: 'earlier-chronicles'
            });

            render(<ChroniclesDisplay />);

            expect(screen.getByTestId('artifact-display-wrapper')).toHaveAttribute(
                'data-artifact-id',
                'earlier-chronicles'
            );
        });
    });
}); 