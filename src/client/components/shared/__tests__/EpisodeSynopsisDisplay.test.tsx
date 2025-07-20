import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EpisodeSynopsisDisplay from '../EpisodeSynopsisDisplay';
import { ElectricJsondoc } from '@/common/types';

// Mock Ant Design components with a single comprehensive mock
vi.mock('antd', () => {
    const Title = ({ children, level, ...props }: any) => (
        <h1 data-testid="title" data-level={level} {...props}>
            {children}
        </h1>
    );

    const Text = ({ children, strong, type, ...props }: any) => (
        <span data-testid="text" data-strong={strong} data-type={type} {...props}>
            {children}
        </span>
    );

    const Paragraph = ({ children, ...props }: any) => (
        <p data-testid="paragraph" {...props}>
            {children}
        </p>
    );

    return {
        Card: ({ children, title, extra, ...props }: any) => (
            <div data-testid="card" {...props}>
                {title && <div data-testid="card-title">{title}</div>}
                {extra && <div data-testid="card-extra">{extra}</div>}
                {children}
            </div>
        ),
        Typography: {
            Title,
            Text,
            Paragraph
        },
        Descriptions: Object.assign(
            ({ children, ...props }: any) => (
                <div data-testid="descriptions" {...props}>
                    {children}
                </div>
            ),
            {
                Item: ({ label, children, ...props }: any) => (
                    <div data-testid="description-item" data-label={label} {...props}>
                        <span data-testid="description-label">{label}</span>
                        <span data-testid="description-content">{children}</span>
                    </div>
                )
            }
        ),
        Space: ({ children, ...props }: any) => (
            <div data-testid="space" {...props}>
                {children}
            </div>
        ),
        Tag: ({ children, color, ...props }: any) => (
            <span data-testid="tag" data-color={color} {...props}>
                {children}
            </span>
        )
    };
});

// Mock Ant Design icons
vi.mock('@ant-design/icons', () => ({
    ClockCircleOutlined: () => <span data-testid="clock-icon">⏰</span>,
    ThunderboltOutlined: () => <span data-testid="thunder-icon">⚡</span>,
    EyeOutlined: () => <span data-testid="eye-icon">👁</span>,
    FireOutlined: () => <span data-testid="fire-icon">🔥</span>
}));

describe('EpisodeSynopsisDisplay', () => {
    const createMockEpisodeSynopsisJsondoc = (
        id: string,
        episodes: any[]
    ): ElectricJsondoc => ({
        id,
        project_id: 'test-project',
        schema_type: 'episode_synopsis',
        schema_version: 'v1',
        origin_type: 'ai_generated',
        data: JSON.stringify({
            groupTitle: '测试篇',
            episodeRange: '1-3',
            episodes
        }),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
    });

    it('should render empty state when no episodes are provided', () => {
        render(<EpisodeSynopsisDisplay episodeSynopsisList={[]} />);

        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (0集)');
        expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    });

    it('should render single episode correctly', () => {
        const episodes = [
            {
                episodeNumber: 1,
                title: '初次相遇',
                openingHook: '雨夜，霸总的豪车溅了女主一身水',
                mainPlot: '女主愤怒追上霸总理论，却被他的颜值震撼',
                emotionalClimax: '两人四目相对，电光火石间的心动',
                cliffhanger: '霸总留下名片离开，女主发现他就是新老板',
                suspenseElements: ['身份悬念', '职场关系'],
                estimatedDuration: 120
            }
        ];

        const mockJsondoc = createMockEpisodeSynopsisJsondoc('test-1', episodes);
        render(<EpisodeSynopsisDisplay episodeSynopsisList={[mockJsondoc]} />);

        // Check main title
        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (1集)');

        // Check episode card
        const card = screen.getByTestId('card');
        expect(card).toBeInTheDocument();

        // Check episode title
        expect(screen.getByText('第1集: 初次相遇')).toBeInTheDocument();

        // Check content
        expect(screen.getByText('雨夜，霸总的豪车溅了女主一身水')).toBeInTheDocument();
        expect(screen.getByText('女主愤怒追上霸总理论，却被他的颜值震撼')).toBeInTheDocument();
        expect(screen.getByText('两人四目相对，电光火石间的心动')).toBeInTheDocument();
        expect(screen.getByText('霸总留下名片离开，女主发现他就是新老板')).toBeInTheDocument();

        // Check suspense elements
        expect(screen.getByText('悬念元素:')).toBeInTheDocument();
        expect(screen.getByText('身份悬念')).toBeInTheDocument();
        expect(screen.getByText('职场关系')).toBeInTheDocument();
    });

    it('should render multiple episodes in correct order', () => {
        const episodes = [
            {
                episodeNumber: 3,
                title: '误会解除',
                openingHook: '女主发现霸总的秘密',
                mainPlot: '真相大白，误会消除',
                emotionalClimax: '两人和解，感情升华',
                cliffhanger: '新的挑战出现',
                suspenseElements: ['新危机'],
                estimatedDuration: 120
            },
            {
                episodeNumber: 1,
                title: '初次相遇',
                openingHook: '雨夜相遇',
                mainPlot: '霸总与女主的第一次碰撞',
                emotionalClimax: '心动瞬间',
                cliffhanger: '身份悬念',
                suspenseElements: ['身份谜团'],
                estimatedDuration: 120
            },
            {
                episodeNumber: 2,
                title: '职场风波',
                openingHook: '新员工报到',
                mainPlot: '职场中的再次相遇',
                emotionalClimax: '工作中的火花',
                cliffhanger: '误会加深',
                suspenseElements: ['职场冲突'],
                estimatedDuration: 120
            }
        ];

        const mockJsondoc = createMockEpisodeSynopsisJsondoc('test-1', episodes);
        render(<EpisodeSynopsisDisplay episodeSynopsisList={[mockJsondoc]} />);

        // Check that episodes are sorted by episode number
        const episodeTitles = screen.getAllByText(/第\d+集:/);
        expect(episodeTitles[0]).toHaveTextContent('第1集: 初次相遇');
        expect(episodeTitles[1]).toHaveTextContent('第2集: 职场风波');
        expect(episodeTitles[2]).toHaveTextContent('第3集: 误会解除');

        // Check total count
        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (3集)');
    });

    it('should handle multiple jsondocs and flatten episodes', () => {
        const jsondoc1Episodes = [
            {
                episodeNumber: 1,
                title: '第一组第一集',
                openingHook: '开场1',
                mainPlot: '剧情1',
                emotionalClimax: '高潮1',
                cliffhanger: '悬念1',
                suspenseElements: ['元素1'],
                estimatedDuration: 120
            }
        ];

        const jsondoc2Episodes = [
            {
                episodeNumber: 2,
                title: '第二组第一集',
                openingHook: '开场2',
                mainPlot: '剧情2',
                emotionalClimax: '高潮2',
                cliffhanger: '悬念2',
                suspenseElements: ['元素2'],
                estimatedDuration: 120
            }
        ];

        const mockJsondoc1 = createMockEpisodeSynopsisJsondoc('test-1', jsondoc1Episodes);
        const mockJsondoc2 = createMockEpisodeSynopsisJsondoc('test-2', jsondoc2Episodes);

        render(<EpisodeSynopsisDisplay episodeSynopsisList={[mockJsondoc1, mockJsondoc2]} />);

        // Check that all episodes are displayed
        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (2集)');
        expect(screen.getByText('第1集: 第一组第一集')).toBeInTheDocument();
        expect(screen.getByText('第2集: 第二组第一集')).toBeInTheDocument();
    });

    it('should handle episodes without suspense elements', () => {
        const episodes = [
            {
                episodeNumber: 1,
                title: '简单剧集',
                openingHook: '简单开场',
                mainPlot: '简单剧情',
                emotionalClimax: '简单高潮',
                cliffhanger: '简单悬念',
                estimatedDuration: 120
                // No suspenseElements
            }
        ];

        const mockJsondoc = createMockEpisodeSynopsisJsondoc('test-1', episodes);
        render(<EpisodeSynopsisDisplay episodeSynopsisList={[mockJsondoc]} />);

        // Should render episode without suspense elements section
        expect(screen.getByText('第1集: 简单剧集')).toBeInTheDocument();
        expect(screen.queryByText('悬念元素:')).not.toBeInTheDocument();
    });

    it('should handle empty suspense elements array', () => {
        const episodes = [
            {
                episodeNumber: 1,
                title: '无悬念剧集',
                openingHook: '开场',
                mainPlot: '剧情',
                emotionalClimax: '高潮',
                cliffhanger: '悬念',
                suspenseElements: [], // Empty array
                estimatedDuration: 120
            }
        ];

        const mockJsondoc = createMockEpisodeSynopsisJsondoc('test-1', episodes);
        render(<EpisodeSynopsisDisplay episodeSynopsisList={[mockJsondoc]} />);

        expect(screen.getByText('第1集: 无悬念剧集')).toBeInTheDocument();
        expect(screen.queryByText('悬念元素:')).not.toBeInTheDocument();
    });

    it('should handle malformed jsondoc data gracefully', () => {
        const malformedJsondoc: ElectricJsondoc = {
            id: 'malformed',
            project_id: 'test-project',
            schema_type: 'episode_synopsis',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: 'invalid json',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        // Should not crash and should show empty state
        render(<EpisodeSynopsisDisplay episodeSynopsisList={[malformedJsondoc]} />);

        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (0集)');
        expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    });

    it('should handle jsondoc with missing episodes array', () => {
        const jsondocWithoutEpisodes: ElectricJsondoc = {
            id: 'no-episodes',
            project_id: 'test-project',
            schema_type: 'episode_synopsis',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: JSON.stringify({
                groupTitle: '测试篇',
                episodeRange: '1-3'
                // Missing episodes array
            }),
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        render(<EpisodeSynopsisDisplay episodeSynopsisList={[jsondocWithoutEpisodes]} />);

        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (0集)');
        expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    });

    it('should handle jsondoc with non-array episodes field', () => {
        const jsondocWithInvalidEpisodes: ElectricJsondoc = {
            id: 'invalid-episodes',
            project_id: 'test-project',
            schema_type: 'episode_synopsis',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: JSON.stringify({
                groupTitle: '测试篇',
                episodeRange: '1-3',
                episodes: 'not an array'
            }),
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        render(<EpisodeSynopsisDisplay episodeSynopsisList={[jsondocWithInvalidEpisodes]} />);

        expect(screen.getByTestId('title')).toHaveTextContent('每集大纲 (0集)');
        expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    });

    it('should render correct element IDs for navigation', () => {
        const episodes = [
            {
                episodeNumber: 1,
                title: '测试集',
                openingHook: '开场',
                mainPlot: '剧情',
                emotionalClimax: '高潮',
                cliffhanger: '悬念',
                suspenseElements: ['元素'],
                estimatedDuration: 120
            }
        ];

        const mockJsondoc = createMockEpisodeSynopsisJsondoc('test-1', episodes);
        const { container } = render(<EpisodeSynopsisDisplay episodeSynopsisList={[mockJsondoc]} />);

        // Check that the component has the correct ID for navigation
        const elementWithId = container.querySelector('#episode-synopsis');
        expect(elementWithId).toBeInTheDocument();
    });
}); 