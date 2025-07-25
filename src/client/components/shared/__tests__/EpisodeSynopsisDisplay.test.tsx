import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EpisodeSynopsisDisplay from '../EpisodeSynopsisDisplay';
import { ElectricJsondoc } from '@/common/types';
import { ScrollSyncProvider } from '../../../contexts';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
    mockIntersectionObserver.mockImplementation((callback, options) => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
        root: null,
        rootMargin: options?.rootMargin || '',
        thresholds: Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0]
    }));

    // @ts-ignore
    global.IntersectionObserver = mockIntersectionObserver;
    vi.clearAllMocks();
});

// Mock Ant Design components
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

    const DescriptionsItem = ({ children, label, ...props }: any) => (
        <div data-testid="descriptions-item" {...props}>
            {label && <div data-testid="descriptions-label">{label}</div>}
            <div data-testid="descriptions-content">{children}</div>
        </div>
    );

    const Descriptions = ({ children, ...props }: any) => (
        <div data-testid="descriptions" {...props}>
            {children}
        </div>
    );
    Descriptions.Item = DescriptionsItem;

    return {
        Card: ({ children, title, extra, ...props }: any) => (
            <div data-testid="card" {...props}>
                {title && <div data-testid="card-title">{title}</div>}
                {extra && <div data-testid="card-extra">{extra}</div>}
                <div data-testid="card-content">{children}</div>
            </div>
        ),
        Descriptions,
        Typography: {
            Title,
            Text,
            Paragraph
        },
        Tag: ({ children, color, ...props }: any) => (
            <span data-testid="tag" data-color={color} {...props}>
                {children}
            </span>
        ),
        Space: ({ children, ...props }: any) => (
            <div data-testid="space" {...props}>
                {children}
            </div>
        )
    };
});

// Mock icons
vi.mock('@ant-design/icons', () => ({
    ClockCircleOutlined: () => <span data-testid="clock-icon">Clock</span>,
    ThunderboltOutlined: () => <span data-testid="thunderbolt-icon">Thunderbolt</span>,
    EyeOutlined: () => <span data-testid="eye-icon">Eye</span>,
    FireOutlined: () => <span data-testid="fire-icon">Fire</span>
}));

describe('EpisodeSynopsisDisplay', () => {
    const mockEpisodeSynopsis: ElectricJsondoc = {
        id: 'episode-1-synopsis',
        project_id: 'test-project',
        schema_type: 'episode_synopsis',
        schema_version: 'v1',
        origin_type: 'ai_generated',
        data: JSON.stringify({
            episodeNumber: 1,
            title: '初次相遇',
            openingHook: '神秘男子突然出现在咖啡厅',
            mainPlot: '女主角在咖啡厅工作时遇到了一个神秘的男子，两人产生了微妙的化学反应',
            emotionalClimax: '两人眼神交汇的瞬间，时间仿佛静止',
            cliffhanger: '男子留下一张神秘名片后匆忙离开',
            suspenseElements: ['男子的真实身份', '名片上的秘密信息', '为什么选择这家咖啡厅'],
            estimatedDuration: 120
        }),
        metadata: undefined,
        streaming_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
    };

    const renderWithProvider = (episodeSynopsis: ElectricJsondoc) => {
        return render(
            <ScrollSyncProvider>
                <EpisodeSynopsisDisplay episodeSynopsis={episodeSynopsis} />
            </ScrollSyncProvider>
        );
    };

    it('should render episode synopsis correctly', () => {
        renderWithProvider(mockEpisodeSynopsis);

        // Check episode title
        expect(screen.getByText('第1集: 初次相遇')).toBeInTheDocument();

        // Check duration
        expect(screen.getByText('120秒')).toBeInTheDocument();

        // Check all main content sections
        expect(screen.getByText('神秘男子突然出现在咖啡厅')).toBeInTheDocument();
        expect(screen.getByText('女主角在咖啡厅工作时遇到了一个神秘的男子，两人产生了微妙的化学反应')).toBeInTheDocument();
        expect(screen.getByText('两人眼神交汇的瞬间，时间仿佛静止')).toBeInTheDocument();
        expect(screen.getByText('男子留下一张神秘名片后匆忙离开')).toBeInTheDocument();

        // Check suspense elements
        expect(screen.getByText('男子的真实身份')).toBeInTheDocument();
        expect(screen.getByText('名片上的秘密信息')).toBeInTheDocument();
        expect(screen.getByText('为什么选择这家咖啡厅')).toBeInTheDocument();
    });

    it('should handle string data format', () => {
        const stringDataSynopsis = {
            ...mockEpisodeSynopsis,
            data: JSON.stringify({
                episodeNumber: 2,
                title: '误会产生',
                openingHook: '女主调查神秘名片',
                mainPlot: '发现男子是竞争对手',
                emotionalClimax: '愤怒与失望',
                cliffhanger: '男子出现解释',
                suspenseElements: ['真实身份'],
                estimatedDuration: 120
            })
        };

        renderWithProvider(stringDataSynopsis);

        expect(screen.getByText('第2集: 误会产生')).toBeInTheDocument();
        expect(screen.getByText('女主调查神秘名片')).toBeInTheDocument();
    });

    it('should handle object data format', () => {
        const objectDataSynopsis = {
            ...mockEpisodeSynopsis,
            data: JSON.stringify({
                episodeNumber: 3,
                title: '真相大白',
                openingHook: '解释来龙去脉',
                mainPlot: '男子说出真实目的',
                emotionalClimax: '理解与和解',
                cliffhanger: '新的开始',
                suspenseElements: ['未来发展'],
                estimatedDuration: 120
            })
        };

        renderWithProvider(objectDataSynopsis);

        expect(screen.getByText('第3集: 真相大白')).toBeInTheDocument();
        expect(screen.getByText('解释来龙去脉')).toBeInTheDocument();
    });

    it('should handle empty suspense elements', () => {
        const noSuspenseSynopsis = {
            ...mockEpisodeSynopsis,
            data: JSON.stringify({
                episodeNumber: 4,
                title: '平静的一集',
                openingHook: '日常开始',
                mainPlot: '平常的一天',
                emotionalClimax: '小小的感动',
                cliffhanger: '明天会如何',
                suspenseElements: [],
                estimatedDuration: 120
            })
        };

        renderWithProvider(noSuspenseSynopsis);

        expect(screen.getByText('第4集: 平静的一集')).toBeInTheDocument();
        // Should not show suspense elements section
        expect(screen.queryByText('悬念元素:')).not.toBeInTheDocument();
    });

    it('should handle missing suspense elements', () => {
        const noSuspenseFieldSynopsis = {
            ...mockEpisodeSynopsis,
            data: JSON.stringify({
                episodeNumber: 5,
                title: '简单的一集',
                openingHook: '开始',
                mainPlot: '中间',
                emotionalClimax: '高潮',
                cliffhanger: '结束',
                estimatedDuration: 120
                // No suspenseElements field
            })
        };

        renderWithProvider(noSuspenseFieldSynopsis);

        expect(screen.getByText('第5集: 简单的一集')).toBeInTheDocument();
        expect(screen.queryByText('悬念元素:')).not.toBeInTheDocument();
    });

    it('should handle invalid JSON data', () => {
        const invalidDataSynopsis = {
            ...mockEpisodeSynopsis,
            data: 'invalid json data'
        };

        renderWithProvider(invalidDataSynopsis);

        expect(screen.getByText('数据解析失败')).toBeInTheDocument();
    });

    it('should handle null data', () => {
        const nullDataSynopsis = {
            ...mockEpisodeSynopsis,
            data: null as any
        };

        renderWithProvider(nullDataSynopsis);

        expect(screen.getByText('暂无剧集大纲数据')).toBeInTheDocument();
    });

    it('should handle undefined data', () => {
        const undefinedDataSynopsis = {
            ...mockEpisodeSynopsis,
            data: undefined as any
        };

        renderWithProvider(undefinedDataSynopsis);

        expect(screen.getByText('暂无剧集大纲数据')).toBeInTheDocument();
    });

    it('should set up scroll sync observer correctly', () => {
        renderWithProvider(mockEpisodeSynopsis);

        // Should create IntersectionObserver
        expect(mockIntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                threshold: 0.3,
                rootMargin: '-10% 0px -50% 0px'
            })
        );

        // Should observe the episode element
        expect(mockObserve).toHaveBeenCalledTimes(1);
    });

    it('should render all required sections', () => {
        renderWithProvider(mockEpisodeSynopsis);

        // Check for all section labels
        expect(screen.getByText('开场钩子')).toBeInTheDocument();
        expect(screen.getByText('主要剧情')).toBeInTheDocument();
        expect(screen.getByText('情感高潮')).toBeInTheDocument();
        expect(screen.getByText('结尾悬念')).toBeInTheDocument();
        expect(screen.getByText('悬念元素:')).toBeInTheDocument();

        // Check for icons (mocked)
        expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
        expect(screen.getAllByTestId('eye-icon')).toHaveLength(2); // Opening hook and cliffhanger
        expect(screen.getByTestId('thunderbolt-icon')).toBeInTheDocument();
        expect(screen.getByTestId('fire-icon')).toBeInTheDocument();
    });

    it('should handle different episode numbers', () => {
        const episode10Synopsis = {
            ...mockEpisodeSynopsis,
            data: JSON.stringify({
                episodeNumber: 10,
                title: '第十集',
                openingHook: '开场',
                mainPlot: '剧情',
                emotionalClimax: '高潮',
                cliffhanger: '悬念',
                suspenseElements: ['元素'],
                estimatedDuration: 120
            })
        };

        renderWithProvider(episode10Synopsis);

        expect(screen.getByText('第10集: 第十集')).toBeInTheDocument();
        // Should have correct ID for scroll sync
        expect(document.getElementById('episode-10')).toBeInTheDocument();
    });

    it('should handle missing estimatedDuration', () => {
        const noDurationSynopsis = {
            ...mockEpisodeSynopsis,
            data: JSON.stringify({
                episodeNumber: 6,
                title: '无时长',
                openingHook: '开场',
                mainPlot: '剧情',
                emotionalClimax: '高潮',
                cliffhanger: '悬念',
                suspenseElements: ['元素']
                // No estimatedDuration
            })
        };

        renderWithProvider(noDurationSynopsis);

        // Should default to 120 seconds
        expect(screen.getByText('120秒')).toBeInTheDocument();
    });
}); 