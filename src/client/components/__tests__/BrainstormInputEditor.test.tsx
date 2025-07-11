import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrainstormInputEditor from '../BrainstormInputEditor';
import { useYJSField } from '../../transform-artifact-framework/contexts/YJSArtifactContext';
import { TypedArtifact } from '@/common/types';

// Mock the YJS context
vi.mock('../../transform-artifact-framework/contexts/YJSArtifactContext', () => ({
    YJSArtifactProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useYJSField: vi.fn(() => ({
        value: '',
        updateValue: vi.fn(),
        isInitialized: true
    }))
}));

// Mock the components
vi.mock('../GenreSelectionPopup', () => ({
    default: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
        visible ? <div data-testid="genre-popup">Genre Popup</div> : null
}));

vi.mock('../PlatformSelection', () => ({
    default: ({ selectedPlatform, onPlatformChange }: { selectedPlatform: string; onPlatformChange: (platform: string) => void }) =>
        <div data-testid="platform-selection">Platform: {selectedPlatform}</div>
}));

// Mock the project data context
vi.mock('../../contexts/ProjectDataContext', () => ({
    useProjectData: vi.fn(() => ({
        artifacts: [],
        isLoading: false,
        isError: false
    }))
}));

describe('BrainstormInputEditor', () => {
    const mockArtifact = {
        id: 'test-artifact-1',
        schema_type: 'brainstorm_input_params' as TypedArtifact['schema_type'],
        schema_version: 'v1' as TypedArtifact['schema_version'],
        origin_type: 'ai_generated' as TypedArtifact['origin_type'],
        data: '{"platform": "douyin", "genre": "现代甜宠", "numberOfIdeas": 3, "other_requirements": "需要很多狗血和反转"}',
        created_at: '2024-01-01T00:00:00Z'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render in expanded mode by default', () => {
        render(<BrainstormInputEditor artifact={mockArtifact} />);

        // Should show the full form title
        expect(screen.getByText('头脑风暴需求')).toBeInTheDocument();

        // Should show form fields
        expect(screen.getByText('目标平台：')).toBeInTheDocument();
        expect(screen.getByText('故事类型')).toBeInTheDocument();
        expect(screen.getByText('生成创意数量')).toBeInTheDocument();
        expect(screen.getByText('其他要求 (可选)')).toBeInTheDocument();
    });

    it('should render in minimized mode when minimized prop is true', () => {
        render(<BrainstormInputEditor artifact={mockArtifact} minimized={true} />);

        // Should show the collapsed panel structure
        expect(screen.getByRole('button')).toBeInTheDocument(); // Collapse header is a button

        // Should show the header with icon and title (using getAllByText to handle duplicates)
        expect(screen.getAllByText('头脑风暴参数')).toHaveLength(2); // Strong title + secondary summary

        // Should not show the expanded form fields initially
        expect(screen.queryByText('目标平台：')).not.toBeInTheDocument();
        expect(screen.queryByText('故事类型')).not.toBeInTheDocument();
        expect(screen.queryByText('生成创意数量')).not.toBeInTheDocument();
        expect(screen.queryByText('其他要求 (可选)')).not.toBeInTheDocument();
    });

    it('should expand when collapsed panel is clicked in minimized mode', () => {
        render(<BrainstormInputEditor artifact={mockArtifact} minimized={true} />);

        // Find and click the collapse panel header (button)
        const collapseHeader = screen.getByRole('button');
        fireEvent.click(collapseHeader);

        // After expanding, should show read-only fields
        expect(screen.getByText('目标平台：')).toBeInTheDocument();
        expect(screen.getByText('故事类型：')).toBeInTheDocument();
        expect(screen.getByText('生成创意数量：')).toBeInTheDocument();
    });

    it('should show summary text when data is available', () => {
        // Mock YJS field values for the summary
        vi.mocked(useYJSField).mockImplementation((path?: string) => {
            const mockData: Record<string, any> = {
                platform: { value: 'douyin', updateValue: vi.fn(), isInitialized: true },
                genre: { value: '现代甜宠', updateValue: vi.fn(), isInitialized: true },
                numberOfIdeas: { value: 3, updateValue: vi.fn(), isInitialized: true },
                other_requirements: { value: '需要很多狗血和反转', updateValue: vi.fn(), isInitialized: true }
            };
            return mockData[path || ''] || { value: '', updateValue: vi.fn(), isInitialized: true };
        });

        render(<BrainstormInputEditor artifact={mockArtifact} minimized={true} />);

        // Should show the summary includes platform info
        expect(screen.getByText(/douyin/)).toBeInTheDocument();
    });

    it('should handle missing artifact gracefully', () => {
        render(<BrainstormInputEditor artifact={null} />);

        expect(screen.getByText('未找到头脑风暴输入数据')).toBeInTheDocument();
    });

    it('should show default fallback text when no data is available', () => {
        render(<BrainstormInputEditor artifact={mockArtifact} minimized={true} />);

        // Should show the collapse panel with default title
        expect(screen.getByText('头脑风暴参数')).toBeInTheDocument();
    });
}); 