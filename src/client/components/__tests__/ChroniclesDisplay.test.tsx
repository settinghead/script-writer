import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChroniclesDisplay } from '../ChroniclesDisplay';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLineageResolution } from '../../transform-jsondoc-framework/useLineageResolution';

// Mock dependencies
vi.mock('../../contexts/ProjectDataContext');
vi.mock('../../transform-jsondoc-framework/useLineageResolution');
vi.mock('../shared', () => ({
    SectionWrapper: ({ children, title }: any) => (
        <div data-testid="section-wrapper">
            <h2>{title}</h2>
            {children}
        </div>
    ),

    JsondocDisplayWrapper: ({ jsondoc, isEditable, title }: any) => (
        <div data-testid="jsondoc-display-wrapper"
            data-jsondoc-id={jsondoc?.id}
            data-is-editable={isEditable}>
            <h3>{title}</h3>
            <div>Jsondoc: {jsondoc?.id}</div>
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
    const mockChroniclesJsondoc = {
        id: 'chronicles-jsondoc-id',
        project_id: 'test-project-id',
        schema_type: 'chronicles' as const,
        schema_version: 'v1' as const,
        origin_type: 'ai_generated' as const,
        created_at: '2025-01-01T00:00:00Z',
        data: JSON.stringify({
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
        })
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock setup
        mockUseProjectData.mockReturnValue({
            jsondocs: [mockChroniclesJsondoc],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn(), }
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: 'chronicles-jsondoc-id',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsondocId: 'chronicles-jsondoc-id'
        });
    });

    it('should render chronicles display with whole-document editing when data is available', async () => {
        render(<ChroniclesDisplay />);

        await waitFor(() => {
            expect(screen.getByTestId('section-wrapper')).toBeInTheDocument();
        });

        // Check that the section wrapper is rendered
        expect(screen.getByTestId('section-wrapper')).toBeInTheDocument();

        // Check that the jsondoc display wrapper is rendered
        expect(screen.getByTestId('jsondoc-display-wrapper')).toBeInTheDocument();

        // Verify jsondoc ID is passed correctly
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-jsondoc-id',
            'chronicles-jsondoc-id'
        );

        // Check that it's not editable by default (ai_generated jsondoc)
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'false'
        );

        // Component should be rendered successfully
    });

    it('should render chronicles as editable when jsondoc is user_input with no descendants', async () => {
        const editableJsondoc = {
            ...mockChroniclesJsondoc,
            origin_type: 'user_input'
        };

        mockUseProjectData.mockReturnValue({
            jsondocs: [editableJsondoc],
            transformInputs: [], // No descendants
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: editableJsondoc.id,
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsondocId: editableJsondoc.id
        });

        render(<ChroniclesDisplay />);

        await waitFor(() => {
            expect(screen.getByTestId('jsondoc-display-wrapper')).toBeInTheDocument();
        });

        // Check that it's editable
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'true'
        );
    });

    it('should use props when provided (from action computation)', async () => {
        const propsJsondoc = {
            ...mockChroniclesJsondoc,
            id: 'props-jsondoc-id',
            origin_type: 'user_input'
        };

        render(<ChroniclesDisplay isEditable={true} chroniclesJsondoc={propsJsondoc} />);

        await waitFor(() => {
            expect(screen.getByTestId('jsondoc-display-wrapper')).toBeInTheDocument();
        });

        // Check that it uses the props jsondoc
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-jsondoc-id',
            'props-jsondoc-id'
        );

        // Check that it's editable as specified in props
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'true'
        );
    });

    it('should return null when jsondocs are pending', () => {
        mockUseProjectData.mockReturnValue({
            jsondocs: "pending",
            isLoading: true,
            isError: false,
            error: null
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when jsondocs are in error state', () => {
        mockUseProjectData.mockReturnValue({
            jsondocs: "error",
            isLoading: false,
            isError: true,
            error: new Error('Failed to load')
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when no chronicles jsondocs are found', () => {
        mockUseProjectData.mockReturnValue({
            jsondocs: [
                {
                    id: 'other-jsondoc',
                    schema_type: '剧本设定',
                    type: '剧本设定',
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

    it('should still render jsondoc display wrapper even with no stages', () => {
        const jsondocWithNoStages = {
            ...mockChroniclesJsondoc,
            data: { stages: [] }
        };

        mockUseProjectData.mockReturnValue({
            jsondocs: [jsondocWithNoStages],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        // Should still render the jsondoc display wrapper
        expect(screen.getByTestId('jsondoc-display-wrapper')).toBeInTheDocument();
    });

    it('should handle string-formatted data correctly', () => {
        const jsondocWithStringData = {
            ...mockChroniclesJsondoc,
            data: JSON.stringify(mockChroniclesJsondoc.data)
        };

        mockUseProjectData.mockReturnValue({
            jsondocs: [jsondocWithStringData],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        expect(screen.getByTestId('jsondoc-display-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-jsondoc-id',
            'chronicles-jsondoc-id'
        );
    });

    it('should prioritize chronicles over legacy chronicles type', () => {
        const legacyChroniclesJsondoc = {
            id: 'legacy-chronicles',
            schema_type: null,
            type: 'chronicles',
            origin_type: 'ai_generated',
            created_at: '2025-01-01T00:00:00Z',
            data: { stages: [{ title: 'Legacy stage' }] }
        };

        const modernChroniclesJsondoc = {
            id: 'modern-chronicles',
            schema_type: 'chronicles',
            type: 'chronicles',
            origin_type: 'ai_generated',
            created_at: '2025-01-01T01:00:00Z',
            data: { stages: [{ title: 'Modern stage' }] }
        };

        mockUseProjectData.mockReturnValue({
            jsondocs: [legacyChroniclesJsondoc, modernChroniclesJsondoc],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: 'modern-chronicles',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsondocId: 'modern-chronicles'
        });

        render(<ChroniclesDisplay />);

        // Should use the modern chronicles jsondoc
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-jsondoc-id',
            'modern-chronicles'
        );
    });

    it('should handle lineage resolution errors gracefully', () => {
        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: null,
            hasLineage: false,
            isLoading: false,
            error: new Error('Lineage resolution failed'),
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsondocId: 'chronicles-jsondoc-id'
        });

        render(<ChroniclesDisplay />);

        expect(screen.getByText(/加载时间顺序大纲时出错/)).toBeInTheDocument();
        expect(screen.getByText(/Lineage resolution failed/)).toBeInTheDocument();
    });

    it('should return null while lineage is still loading', () => {
        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: null,
            hasLineage: false,
            isLoading: true,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsondocId: 'chronicles-jsondoc-id'
        });

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should handle corrupted JSON data gracefully', () => {
        const jsondocWithCorruptedData = {
            ...mockChroniclesJsondoc,
            data: 'invalid json {'
        };

        mockUseProjectData.mockReturnValue({
            jsondocs: [jsondocWithCorruptedData],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        // Should still render the jsondoc display wrapper even with corrupted data
        expect(screen.getByTestId('jsondoc-display-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
            'data-jsondoc-id',
            'chronicles-jsondoc-id'
        );
    });

    describe('jsondoc selection logic', () => {
        it('should prefer AI-generated jsondocs over user-input ones', () => {
            const userInputJsondoc = {
                ...mockChroniclesJsondoc,
                id: 'user-input-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T00:00:00Z'
            };

            const aiGeneratedJsondoc = {
                ...mockChroniclesJsondoc,
                id: 'ai-generated-chronicles',
                origin_type: 'ai_generated',
                created_at: '2025-01-01T01:00:00Z'
            };

            mockUseProjectData.mockReturnValue({
                jsondocs: [userInputJsondoc, aiGeneratedJsondoc],
                transformInputs: [],
                isLoading: false,
                isError: false,
                error: null
            } as any);

            mockUseLineageResolution.mockReturnValue({
                latestJsondocId: 'ai-generated-chronicles',
                hasLineage: false,
                isLoading: false,
                error: null,
                resolvedPath: '$',
                lineagePath: [],
                depth: 1,
                originalJsondocId: 'ai-generated-chronicles'
            });

            render(<ChroniclesDisplay />);

            expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
                'data-jsondoc-id',
                'ai-generated-chronicles'
            );
        });

        it('should fallback to earliest jsondoc when no AI-generated found', () => {
            const laterJsondoc = {
                ...mockChroniclesJsondoc,
                id: 'later-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T02:00:00Z'
            };

            const earlierJsondoc = {
                ...mockChroniclesJsondoc,
                id: 'earlier-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T01:00:00Z'
            };

            mockUseProjectData.mockReturnValue({
                jsondocs: [laterJsondoc, earlierJsondoc],
                transformInputs: [],
                isLoading: false,
                isError: false,
                error: null
            } as any);

            mockUseLineageResolution.mockReturnValue({
                latestJsondocId: 'earlier-chronicles',
                hasLineage: false,
                isLoading: false,
                error: null,
                resolvedPath: '$',
                lineagePath: [],
                depth: 1,
                originalJsondocId: 'earlier-chronicles'
            });

            render(<ChroniclesDisplay />);

            expect(screen.getByTestId('jsondoc-display-wrapper')).toHaveAttribute(
                'data-jsondoc-id',
                'earlier-chronicles'
            );
        });
    });
}); 