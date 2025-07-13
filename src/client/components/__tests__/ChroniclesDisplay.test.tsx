import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChroniclesDisplay } from '../ChroniclesDisplay';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLineageResolution } from '../../transform-jsonDoc-framework/useLineageResolution';

// Mock dependencies
vi.mock('../../contexts/ProjectDataContext');
vi.mock('../../transform-jsonDoc-framework/useLineageResolution');
vi.mock('../shared', () => ({
    SectionWrapper: ({ children, title }: any) => (
        <div data-testid="section-wrapper">
            <h2>{title}</h2>
            {children}
        </div>
    ),

    JsonDocDisplayWrapper: ({ jsonDoc, isEditable, title }: any) => (
        <div data-testid="jsonDoc-display-wrapper"
            data-jsonDoc-id={jsonDoc?.id}
            data-is-editable={isEditable}>
            <h3>{title}</h3>
            <div>JsonDoc: {jsonDoc?.id}</div>
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
    const mockChroniclesJsonDoc = {
        id: 'chronicles-jsonDoc-id',
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
            jsonDocs: [mockChroniclesJsonDoc],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn(), }
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsonDocId: 'chronicles-jsonDoc-id',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsonDocId: 'chronicles-jsonDoc-id'
        });
    });

    it('should render chronicles display with whole-document editing when data is available', async () => {
        render(<ChroniclesDisplay />);

        await waitFor(() => {
            expect(screen.getByTestId('section-wrapper')).toBeInTheDocument();
        });

        // Check that the section wrapper is rendered
        expect(screen.getByTestId('section-wrapper')).toBeInTheDocument();

        // Check that the jsonDoc display wrapper is rendered
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toBeInTheDocument();

        // Verify jsonDoc ID is passed correctly
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-jsonDoc-id',
            'chronicles-jsonDoc-id'
        );

        // Check that it's not editable by default (ai_generated jsonDoc)
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'false'
        );

        // Component should be rendered successfully
    });

    it('should render chronicles as editable when jsonDoc is user_input with no descendants', async () => {
        const editableJsonDoc = {
            ...mockChroniclesJsonDoc,
            origin_type: 'user_input'
        };

        mockUseProjectData.mockReturnValue({
            jsonDocs: [editableJsonDoc],
            transformInputs: [], // No descendants
            isLoading: false,
            isError: false,
            error: null,
            createHumanTransform: { mutate: vi.fn() }
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsonDocId: editableJsonDoc.id,
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsonDocId: editableJsonDoc.id
        });

        render(<ChroniclesDisplay />);

        await waitFor(() => {
            expect(screen.getByTestId('jsonDoc-display-wrapper')).toBeInTheDocument();
        });

        // Check that it's editable
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'true'
        );
    });

    it('should use props when provided (from action computation)', async () => {
        const propsJsonDoc = {
            ...mockChroniclesJsonDoc,
            id: 'props-jsonDoc-id',
            origin_type: 'user_input'
        };

        render(<ChroniclesDisplay isEditable={true} chroniclesJsonDoc={propsJsonDoc} />);

        await waitFor(() => {
            expect(screen.getByTestId('jsonDoc-display-wrapper')).toBeInTheDocument();
        });

        // Check that it uses the props jsonDoc
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-jsonDoc-id',
            'props-jsonDoc-id'
        );

        // Check that it's editable as specified in props
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-is-editable',
            'true'
        );
    });

    it('should return null when jsonDocs are pending', () => {
        mockUseProjectData.mockReturnValue({
            jsonDocs: "pending",
            isLoading: true,
            isError: false,
            error: null
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when jsonDocs are in error state', () => {
        mockUseProjectData.mockReturnValue({
            jsonDocs: "error",
            isLoading: false,
            isError: true,
            error: new Error('Failed to load')
        } as any);

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when no chronicles jsonDocs are found', () => {
        mockUseProjectData.mockReturnValue({
            jsonDocs: [
                {
                    id: 'other-jsonDoc',
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

    it('should still render jsonDoc display wrapper even with no stages', () => {
        const jsonDocWithNoStages = {
            ...mockChroniclesJsonDoc,
            data: { stages: [] }
        };

        mockUseProjectData.mockReturnValue({
            jsonDocs: [jsonDocWithNoStages],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        // Should still render the jsonDoc display wrapper
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toBeInTheDocument();
    });

    it('should handle string-formatted data correctly', () => {
        const jsonDocWithStringData = {
            ...mockChroniclesJsonDoc,
            data: JSON.stringify(mockChroniclesJsonDoc.data)
        };

        mockUseProjectData.mockReturnValue({
            jsonDocs: [jsonDocWithStringData],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        expect(screen.getByTestId('jsonDoc-display-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-jsonDoc-id',
            'chronicles-jsonDoc-id'
        );
    });

    it('should prioritize chronicles over legacy chronicles type', () => {
        const legacyChroniclesJsonDoc = {
            id: 'legacy-chronicles',
            schema_type: null,
            type: 'chronicles',
            origin_type: 'ai_generated',
            created_at: '2025-01-01T00:00:00Z',
            data: { stages: [{ title: 'Legacy stage' }] }
        };

        const modernChroniclesJsonDoc = {
            id: 'modern-chronicles',
            schema_type: 'chronicles',
            type: 'chronicles',
            origin_type: 'ai_generated',
            created_at: '2025-01-01T01:00:00Z',
            data: { stages: [{ title: 'Modern stage' }] }
        };

        mockUseProjectData.mockReturnValue({
            jsonDocs: [legacyChroniclesJsonDoc, modernChroniclesJsonDoc],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsonDocId: 'modern-chronicles',
            hasLineage: false,
            isLoading: false,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsonDocId: 'modern-chronicles'
        });

        render(<ChroniclesDisplay />);

        // Should use the modern chronicles jsonDoc
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-jsonDoc-id',
            'modern-chronicles'
        );
    });

    it('should handle lineage resolution errors gracefully', () => {
        mockUseLineageResolution.mockReturnValue({
            latestJsonDocId: null,
            hasLineage: false,
            isLoading: false,
            error: new Error('Lineage resolution failed'),
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsonDocId: 'chronicles-jsonDoc-id'
        });

        render(<ChroniclesDisplay />);

        expect(screen.getByText(/加载时间顺序大纲时出错/)).toBeInTheDocument();
        expect(screen.getByText(/Lineage resolution failed/)).toBeInTheDocument();
    });

    it('should return null while lineage is still loading', () => {
        mockUseLineageResolution.mockReturnValue({
            latestJsonDocId: null,
            hasLineage: false,
            isLoading: true,
            error: null,
            resolvedPath: '$',
            lineagePath: [],
            depth: 1,
            originalJsonDocId: 'chronicles-jsonDoc-id'
        });

        const { container } = render(<ChroniclesDisplay />);
        expect(container.firstChild).toBeNull();
    });

    it('should handle corrupted JSON data gracefully', () => {
        const jsonDocWithCorruptedData = {
            ...mockChroniclesJsonDoc,
            data: 'invalid json {'
        };

        mockUseProjectData.mockReturnValue({
            jsonDocs: [jsonDocWithCorruptedData],
            transformInputs: [],
            isLoading: false,
            isError: false,
            error: null
        } as any);

        render(<ChroniclesDisplay />);

        // Should still render the jsonDoc display wrapper even with corrupted data
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
            'data-jsonDoc-id',
            'chronicles-jsonDoc-id'
        );
    });

    describe('jsonDoc selection logic', () => {
        it('should prefer AI-generated jsonDocs over user-input ones', () => {
            const userInputJsonDoc = {
                ...mockChroniclesJsonDoc,
                id: 'user-input-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T00:00:00Z'
            };

            const aiGeneratedJsonDoc = {
                ...mockChroniclesJsonDoc,
                id: 'ai-generated-chronicles',
                origin_type: 'ai_generated',
                created_at: '2025-01-01T01:00:00Z'
            };

            mockUseProjectData.mockReturnValue({
                jsonDocs: [userInputJsonDoc, aiGeneratedJsonDoc],
                transformInputs: [],
                isLoading: false,
                isError: false,
                error: null
            } as any);

            mockUseLineageResolution.mockReturnValue({
                latestJsonDocId: 'ai-generated-chronicles',
                hasLineage: false,
                isLoading: false,
                error: null,
                resolvedPath: '$',
                lineagePath: [],
                depth: 1,
                originalJsonDocId: 'ai-generated-chronicles'
            });

            render(<ChroniclesDisplay />);

            expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
                'data-jsonDoc-id',
                'ai-generated-chronicles'
            );
        });

        it('should fallback to earliest jsonDoc when no AI-generated found', () => {
            const laterJsonDoc = {
                ...mockChroniclesJsonDoc,
                id: 'later-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T02:00:00Z'
            };

            const earlierJsonDoc = {
                ...mockChroniclesJsonDoc,
                id: 'earlier-chronicles',
                origin_type: 'user_input',
                created_at: '2025-01-01T01:00:00Z'
            };

            mockUseProjectData.mockReturnValue({
                jsonDocs: [laterJsonDoc, earlierJsonDoc],
                transformInputs: [],
                isLoading: false,
                isError: false,
                error: null
            } as any);

            mockUseLineageResolution.mockReturnValue({
                latestJsonDocId: 'earlier-chronicles',
                hasLineage: false,
                isLoading: false,
                error: null,
                resolvedPath: '$',
                lineagePath: [],
                depth: 1,
                originalJsonDocId: 'earlier-chronicles'
            });

            render(<ChroniclesDisplay />);

            expect(screen.getByTestId('jsonDoc-display-wrapper')).toHaveAttribute(
                'data-jsonDoc-id',
                'earlier-chronicles'
            );
        });
    });
}); 