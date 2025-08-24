import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EpisodePlanningAction from '../EpisodePlanningAction';
import { apiService } from '../../../services/apiService';
import { DEFAULT_EPISODES } from '@/common/config/constants';

// Mock the API service
vi.mock('../../../services/apiService', () => ({
    apiService: {
        generateEpisodePlanningFromChronicles: vi.fn(),
    },
}));

// Mock the shared buttons (both AIButton and SmartAIButton)
vi.mock('@/client/components/shared', () => {
    const MockButton = ({ children, onClick, loading, disabled, ...props }: any) => (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            data-testid={props['data-testid'] || 'ai-button'}
            {...props}
        >
            {loading ? 'Loading...' : children}
        </button>
    );

    return {
        AIButton: MockButton,
        SmartAIButton: MockButton,
    };
});

// Mock Ant Design icons
vi.mock('@ant-design/icons', () => ({
    VideoCameraOutlined: () => <span data-testid="video-camera-icon">📹</span>,
}));

// Mock Ant Design components with minimal implementation
vi.mock('antd', () => {
    const Form = ({ children }: any) => <div data-testid="form">{children}</div>;
    Form.Item = ({ children, label }: any) => (
        <div data-testid="form-item">
            {label && <label>{label}</label>}
            {children}
        </div>
    );

    return {
        Form,
        Row: ({ children, ...props }: any) => (
            <div data-testid="row" {...props}>{children}</div>
        ),
        Col: ({ children, ...props }: any) => (
            <div data-testid="col" {...props}>{children}</div>
        ),
        InputNumber: ({ value, onChange, ...props }: any) => (
            <input
                type="number"
                value={value}
                onChange={(e) => onChange?.(parseInt(e.target.value))}
                data-testid="episode-count-input"
                {...props}
            />
        ),
        Space: ({ children }: any) => <div data-testid="space">{children}</div>,
        Typography: {
            Title: ({ children, level }: any) => (
                <h1 data-testid={`title-${level}`}>{children}</h1>
            ),
            Text: ({ children }: any) => <span data-testid="text">{children}</span>,
        },
        Alert: ({ message, description, type }: any) => (
            <div data-testid="alert" data-type={type}>
                <div>{message}</div>
                {description && <div>{description}</div>}
            </div>
        ),
        message: {
            error: vi.fn(),
            success: vi.fn(),
        },
    };
});

const mockChronicles = {
    id: 'chronicles-456',
    data: {
        stages: [
            { title: '开始', description: '故事开始' },
            { title: '发展', description: '故事发展' },
            { title: '结束', description: '故事结束' }
        ]
    }
};

const mockProps = {
    projectId: 'test-project-123',
    onSuccess: vi.fn(),
    onError: vi.fn(),
    jsondocs: {
        brainstormIdeas: [],
        outlineSettings: null,
        chronicles: mockChronicles,
        episodePlanning: null,
        episodeGeneration: []
    }
};

describe('EpisodePlanningAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders episode planning form with correct elements', () => {
        render(<EpisodePlanningAction {...mockProps} />);

        expect(screen.getByTestId('title-4')).toHaveTextContent('生成分集结构');
        expect(screen.getByText('总集数')).toBeInTheDocument();
        expect(screen.getByTestId('episode-count-input')).toBeInTheDocument();
        expect(screen.getByTestId('generate-episode-planning-btn')).toBeInTheDocument();
    });

    it('has default episode count of 80', () => {
        render(<EpisodePlanningAction {...mockProps} />);

        const input = screen.getByTestId('episode-count-input') as HTMLInputElement;
        expect(input.value).toBe(DEFAULT_EPISODES.toString());
    });

    it('updates episode count when input changes', () => {
        render(<EpisodePlanningAction {...mockProps} />);

        const input = screen.getByTestId('episode-count-input');
        fireEvent.change(input, { target: { value: '30' } });

        expect((input as HTMLInputElement).value).toBe('30');
    });

    it('calls API service when form is submitted', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        mockGenerateEpisodePlanning.mockResolvedValue(undefined);

        render(<EpisodePlanningAction {...mockProps} />);

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(mockGenerateEpisodePlanning).toHaveBeenCalledWith(
                'test-project-123',
                'chronicles-456',
                DEFAULT_EPISODES
            );
        });
    });

    it('calls onSuccess callback after successful generation', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        mockGenerateEpisodePlanning.mockResolvedValue(undefined);

        render(<EpisodePlanningAction {...mockProps} />);

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(mockProps.onSuccess).toHaveBeenCalled();
        });
    });

    it('shows loading state during API call', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        mockGenerateEpisodePlanning.mockImplementation(() => new Promise(() => { })); // Never resolves

        render(<EpisodePlanningAction {...mockProps} />);

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(generateButton).toBeDisabled();
            expect(generateButton.textContent).toBe('Loading...');
        });
    });

    it('handles API errors gracefully', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        const error = new Error('API Error');
        mockGenerateEpisodePlanning.mockRejectedValue(error);

        render(<EpisodePlanningAction {...mockProps} />);

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(mockProps.onError).toHaveBeenCalledWith(error);
        });
    });

    it('calls API with custom episode count', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        mockGenerateEpisodePlanning.mockResolvedValue(undefined);

        render(<EpisodePlanningAction {...mockProps} />);

        const input = screen.getByTestId('episode-count-input');
        fireEvent.change(input, { target: { value: '50' } });

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(mockGenerateEpisodePlanning).toHaveBeenCalledWith(
                'test-project-123',
                'chronicles-456',
                50
            );
        });
    });

    it('resets loading state after successful generation', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        mockGenerateEpisodePlanning.mockResolvedValue(undefined);

        render(<EpisodePlanningAction {...mockProps} />);

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(generateButton).not.toBeDisabled();
            expect(generateButton.textContent).toBe('生成分集结构');
        });
    });

    it('resets loading state after API error', async () => {
        const mockGenerateEpisodePlanning = vi.mocked(apiService.generateEpisodePlanningFromChronicles);
        mockGenerateEpisodePlanning.mockRejectedValue(new Error('API Error'));

        render(<EpisodePlanningAction {...mockProps} />);

        const generateButton = screen.getByTestId('generate-episode-planning-btn');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(generateButton).not.toBeDisabled();
            expect(generateButton.textContent).toBe('生成分集结构');
        });
    });
}); 