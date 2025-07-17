import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EpisodePlanningDisplay } from '../../EpisodePlanningDisplay';

// Mock the context
vi.mock('../../../contexts/ProjectDataContext', () => ({
    useProjectData: vi.fn(() => ({
        jsondocs: [],
        isLoading: false,
        isError: false
    }))
}));

// Mock Ant Design components
vi.mock('antd', () => ({
    Spin: ({ spinning, children }: any) => (
        <div data-testid="spin" data-spinning={spinning}>
            {children}
        </div>
    ),
    Alert: ({ message, type }: any) => (
        <div data-testid="alert" data-type={type}>
            {message}
        </div>
    ),
    Typography: {
        Title: ({ children, level }: any) => (
            <h1 data-testid={`title-${level}`}>{children}</h1>
        ),
        Text: ({ children }: any) => <span data-testid="text">{children}</span>,
    },
    Card: ({ children, title }: any) => (
        <div data-testid="card">
            {title && <div data-testid="card-title">{title}</div>}
            {children}
        </div>
    ),
    Divider: () => <hr data-testid="divider" />,
    Tag: ({ children, color }: any) => (
        <span data-testid="tag" data-color={color}>{children}</span>
    ),
    Space: ({ children }: any) => <div data-testid="space">{children}</div>,
    Collapse: ({ items }: any) => (
        <div data-testid="collapse">
            {items?.map((item: any, index: number) => (
                <div key={index} data-testid="collapse-item">
                    <div data-testid="collapse-header">{item.label}</div>
                    <div data-testid="collapse-content">{item.children}</div>
                </div>
            ))}
        </div>
    ),
    Input: {
        TextArea: ({ onChange, ...props }: any) => (
            <textarea onChange={onChange} {...props} />
        ),
    },
    Select: ({ children, onChange, ...props }: any) => {
        const SelectComponent = ({ children, onChange, ...props }: any) => (
            <select onChange={(e) => onChange?.(e.target.value)} {...props}>
                {children}
            </select>
        );
        SelectComponent.Option = ({ children, value }: any) => (
            <option value={value}>{children}</option>
        );
        return <SelectComponent onChange={onChange} {...props}>{children}</SelectComponent>;
    },
}));

// Mock the shared components
vi.mock('../SectionWrapper', () => ({
    default: ({ children, title }: any) => (
        <div data-testid="section-wrapper">
            {title && <div data-testid="section-title">{title}</div>}
            {children}
        </div>
    )
}));

vi.mock('../EditableEpisodePlanningForm', () => ({
    default: ({ jsondocId }: any) => (
        <div data-testid="editable-episode-planning-form">
            Form for {jsondocId}
        </div>
    )
}));

vi.mock('../ReadOnlyJsondocDisplay', () => ({
    default: ({ jsondoc }: any) => (
        <div data-testid="readonly-jsondoc-display">
            Read-only display for {jsondoc?.id}
        </div>
    )
}));

// Mock the useLineageResolution hook
vi.mock('../../../transform-jsondoc-framework/useLineageResolution', () => ({
    useLineageResolution: vi.fn(),
}));

// Mock the shared components
vi.mock('../index', () => ({
    SectionWrapper: ({ children, title }: any) => (
        <div data-testid="section-wrapper">
            <h2>{title}</h2>
            {children}
        </div>
    ),
    JsondocDisplayWrapper: ({ children, isEditable, editableComponent: EditableComponent, jsondoc }: any) => (
        <div data-testid="jsondoc-display-wrapper">
            {isEditable && EditableComponent ? (
                <EditableComponent jsondoc={jsondoc} />
            ) : (
                <div data-testid="readonly-jsondoc-display">
                    Read-only display for {jsondoc?.id}
                </div>
            )}
            {children}
        </div>
    ),
    EditableEpisodePlanningForm: ({ jsondoc }: any) => (
        <div data-testid="editable-episode-planning-form">
            Episode Planning Form for {jsondoc?.id}
        </div>
    ),
}));

import { useLineageResolution } from '../../../transform-jsondoc-framework/useLineageResolution';
import { useProjectData } from '../../../contexts/ProjectDataContext';

describe('EpisodePlanningDisplay', () => {
    const mockUseLineageResolution = vi.mocked(useLineageResolution);
    const mockUseProjectData = vi.mocked(useProjectData);

    const mockProps = {
        jsondocId: 'episode-planning-123',
        projectId: 'test-project',
        isEditable: true,
    };

    const mockEpisodePlanningJsondoc = {
        id: 'episode-planning-123',
        project_id: 'test-project',
        schema_type: 'episode_planning' as const,
        schema_version: 'v1' as const,
        origin_type: 'user_input' as const,
        created_at: new Date().toISOString(),
        data: JSON.stringify({
            numberOfEpisodes: 12,
            episodeGroups: [
                {
                    title: '开篇引入',
                    episodes: [1, 2, 3],
                    description: '故事开始，介绍主要角色',
                    emotionalTone: '轻松愉快',
                    hooks: {
                        opening: '神秘邂逅',
                        closing: '身份悬念'
                    }
                }
            ]
        })
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state', () => {
        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: null,
            resolvedPath: 'episode_planning',
            lineagePath: [],
            depth: 0,
            isLoading: true,
            error: null,
            hasLineage: false,
            originalJsondocId: 'test-id'
        });

        render(<EpisodePlanningDisplay {...mockProps} />);

        expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true');
    });

    it('renders error state', () => {
        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: null,
            resolvedPath: 'episode_planning',
            lineagePath: [],
            depth: 0,
            isLoading: false,
            error: new Error('Failed to load data'),
            hasLineage: false,
            originalJsondocId: 'test-id'
        });

        render(<EpisodePlanningDisplay {...mockProps} />);

        expect(screen.getByTestId('alert')).toHaveAttribute('data-type', 'error');
        expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load data');
    });

    it('renders editable form when jsondoc exists and is editable', () => {
        // Mock useProjectData to return the jsondoc
        mockUseProjectData.mockReturnValue({
            jsondocs: [mockEpisodePlanningJsondoc as any],
            isLoading: false,
            isError: false
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: mockEpisodePlanningJsondoc.id,
            resolvedPath: 'episode_planning',
            lineagePath: [],
            depth: 0,
            isLoading: false,
            error: null,
            hasLineage: true,
            originalJsondocId: mockEpisodePlanningJsondoc.id
        });

        render(<EpisodePlanningDisplay {...mockProps} />);

        expect(screen.getByTestId('editable-episode-planning-form')).toBeInTheDocument();
        expect(screen.getByTestId('editable-episode-planning-form')).toHaveTextContent(
            `Form for ${mockEpisodePlanningJsondoc.id}`
        );
    });

    it('renders readonly display when jsondoc exists but is not editable', () => {
        // Create a readonly jsondoc (ai_generated instead of user_input)
        const readonlyJsondoc = {
            ...mockEpisodePlanningJsondoc,
            origin_type: 'ai_generated' as const
        };

        // Mock useProjectData to return the jsondoc
        mockUseProjectData.mockReturnValue({
            jsondocs: [readonlyJsondoc as any],
            isLoading: false,
            isError: false
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: readonlyJsondoc.id,
            resolvedPath: 'episode_planning',
            lineagePath: [],
            depth: 0,
            isLoading: false,
            error: null,
            hasLineage: true,
            originalJsondocId: readonlyJsondoc.id
        });

        render(<EpisodePlanningDisplay {...mockProps} isEditable={false} />);

        expect(screen.getByTestId('readonly-jsondoc-display')).toBeInTheDocument();
        expect(screen.getByTestId('readonly-jsondoc-display')).toHaveTextContent(
            `Read-only display for ${readonlyJsondoc.id}`
        );
    });

    it('renders empty state when no jsondoc exists', () => {
        // Mock useProjectData to return empty jsondocs
        mockUseProjectData.mockReturnValue({
            jsondocs: [],
            isLoading: false,
            isError: false
        } as any);

        mockUseLineageResolution.mockReturnValue({
            latestJsondocId: null,
            resolvedPath: 'episode_planning',
            lineagePath: [],
            depth: 0,
            isLoading: false,
            error: null,
            hasLineage: false,
            originalJsondocId: 'test-id'
        });

        render(<EpisodePlanningDisplay {...mockProps} />);

        expect(screen.getByTestId('alert')).toHaveAttribute('data-type', 'info');
        expect(screen.getByTestId('alert')).toHaveTextContent('暂无剧集规划数据');
    });
}); 