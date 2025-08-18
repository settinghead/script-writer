import React, {} from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScrollSyncObserver, type SubItem } from '../useScrollSyncObserver';
import { ScrollSyncProvider } from '../../contexts/ScrollSyncContext';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();

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
    global.window = Object.create(window);
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// Test component that uses the scroll sync observer hook
const TestComponent: React.FC<{
    section: string;
    subItems: SubItem[];
    options?: any;
    onScrollTo?: (subId?: string) => void;
}> = ({ section, subItems, options, onScrollTo }) => {
    const { scrollToSubItem, isObserving, visibleSubItems } = useScrollSyncObserver(section, subItems, options);

    const handleScrollTo = (subId?: string) => {
        scrollToSubItem(subId);
        if (onScrollTo) onScrollTo(subId);
    };

    return (
        <div>
            <div data-testid="is-observing">{isObserving ? 'true' : 'false'}</div>
            <div data-testid="visible-count">{visibleSubItems.length}</div>
            <div data-testid="visible-items">{visibleSubItems.join(',')}</div>
            <button data-testid="scroll-to-section" onClick={() => handleScrollTo()}>
                Scroll to Section
            </button>
            <button data-testid="scroll-to-sub" onClick={() => handleScrollTo('sub-1')}>
                Scroll to Sub-1
            </button>
            {subItems.map((item, index) => (
                <div key={item.id} ref={item.ref as React.RefObject<HTMLDivElement>} data-testid={`sub-item-${index}`}>
                    {item.id}
                </div>
            ))}
        </div>
    );
};

describe('useScrollSyncObserver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize observer when enabled with sub-items', () => {
        const subItems: SubItem[] = [
            { id: 'sub-1', ref: { current: null } },
            { id: 'sub-2', ref: { current: null } }
        ];

        render(
            <ScrollSyncProvider>
                <TestComponent section="test-section" subItems={subItems} />
            </ScrollSyncProvider>
        );

        expect(mockIntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            {
                threshold: 0.5,
                rootMargin: '-10% 0px -10% 0px'
            }
        );
    });

    it('should not initialize observer when disabled', () => {
        const subItems: SubItem[] = [
            { id: 'sub-1', ref: { current: null } }
        ];

        render(
            <ScrollSyncProvider>
                <TestComponent
                    section="test-section"
                    subItems={subItems}
                    options={{ enabled: false }}
                />
            </ScrollSyncProvider>
        );

        expect(screen.getByTestId('is-observing')).toHaveTextContent('false');
        expect(mockIntersectionObserver).not.toHaveBeenCalled();
    });

    it('should not initialize observer when no sub-items', () => {
        render(
            <ScrollSyncProvider>
                <TestComponent section="test-section" subItems={[]} />
            </ScrollSyncProvider>
        );

        expect(screen.getByTestId('is-observing')).toHaveTextContent('false');
        expect(mockIntersectionObserver).not.toHaveBeenCalled();
    });

    it('should observe sub-items when refs are available', () => {
        const ref1 = { current: document.createElement('div') };
        const ref2 = { current: document.createElement('div') };

        const subItems: SubItem[] = [
            { id: 'sub-1', ref: ref1 },
            { id: 'sub-2', ref: ref2 }
        ];

        render(
            <ScrollSyncProvider>
                <TestComponent section="test-section" subItems={subItems} />
            </ScrollSyncProvider>
        );

        expect(mockObserve).toHaveBeenCalledTimes(2);
        expect(ref1.current?.getAttribute('data-scroll-id')).toBe('sub-1');
        expect(ref2.current?.getAttribute('data-scroll-id')).toBe('sub-2');
    });

    it('should handle scroll to section (no sub-id)', () => {
        const mockScrollIntoView = vi.fn();
        const mockQuerySelector = vi.fn().mockReturnValue({
            scrollIntoView: mockScrollIntoView
        });

        // @ts-ignore
        global.document.querySelector = mockQuerySelector;

        const subItems: SubItem[] = [
            { id: 'sub-1', ref: { current: null } }
        ];

        const onScrollTo = vi.fn();

        render(
            <ScrollSyncProvider>
                <TestComponent
                    section="test-section"
                    subItems={subItems}
                    onScrollTo={onScrollTo}
                />
            </ScrollSyncProvider>
        );

        const scrollButton = screen.getByTestId('scroll-to-section');
        act(() => {
            scrollButton.click();
        });

        expect(mockQuerySelector).toHaveBeenCalledWith('#test-section');
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        expect(onScrollTo).toHaveBeenCalledWith(undefined);
    });

    it.skip('should handle scroll to sub-item using ref', () => {
        const mockScrollIntoView = vi.fn();
        const mockElement = {
            scrollIntoView: mockScrollIntoView,
            setAttribute: vi.fn()
        };
        const ref1 = { current: mockElement };

        const subItems: SubItem[] = [
            { id: 'sub-1', ref: ref1 as any }
        ];

        const onScrollTo = vi.fn();

        render(
            <ScrollSyncProvider>
                <TestComponent
                    section="test-section"
                    subItems={subItems}
                    onScrollTo={onScrollTo}
                />
            </ScrollSyncProvider>
        );

        const scrollButton = screen.getByTestId('scroll-to-sub');
        act(() => {
            scrollButton.click();
        });

        expect(mockScrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        expect(onScrollTo).toHaveBeenCalledWith('sub-1');
    });

    it.skip('should handle scroll to sub-item using fallback querySelector', () => {
        const mockScrollIntoView = vi.fn();
        const mockQuerySelector = vi.fn().mockReturnValue({
            scrollIntoView: mockScrollIntoView
        });

        // @ts-ignore
        global.document.querySelector = mockQuerySelector;

        const subItems: SubItem[] = [
            { id: 'sub-1', ref: { current: null } } // No ref available
        ];

        const onScrollTo = vi.fn();

        render(
            <ScrollSyncProvider>
                <TestComponent
                    section="test-section"
                    subItems={subItems}
                    onScrollTo={onScrollTo}
                />
            </ScrollSyncProvider>
        );

        const scrollButton = screen.getByTestId('scroll-to-sub');
        act(() => {
            scrollButton.click();
        });

        // Since ref is null, it should fallback to querySelector
        expect(mockQuerySelector).toHaveBeenCalledWith('[data-scroll-id="sub-1"]');
        expect(mockScrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        expect(onScrollTo).toHaveBeenCalledWith('sub-1');
    });

    it('should disconnect observer on unmount', () => {
        const subItems: SubItem[] = [
            { id: 'sub-1', ref: { current: document.createElement('div') } }
        ];

        const { unmount } = render(
            <ScrollSyncProvider>
                <TestComponent section="test-section" subItems={subItems} />
            </ScrollSyncProvider>
        );

        unmount();

        expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should use custom options', () => {
        const subItems: SubItem[] = [
            { id: 'sub-1', ref: { current: document.createElement('div') } }
        ];

        const customOptions = {
            threshold: 0.8,
            rootMargin: '-20% 0px -30% 0px',
            debounceMs: 500
        };

        render(
            <ScrollSyncProvider>
                <TestComponent
                    section="test-section"
                    subItems={subItems}
                    options={customOptions}
                />
            </ScrollSyncProvider>
        );

        expect(mockIntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            {
                threshold: 0.8,
                rootMargin: '-20% 0px -30% 0px'
            }
        );
    });
}); 