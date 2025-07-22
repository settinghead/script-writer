import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useScrollSync } from '../contexts/ScrollSyncContext';
import { useDebouncedCallback } from './useDebounce';

export interface SubItem {
    id: string;
    ref: React.RefObject<HTMLElement | null>;
}

interface UseScrollSyncObserverOptions {
    threshold?: number;
    rootMargin?: string;
    debounceMs?: number;
    enabled?: boolean;
}

interface VisibilityInfo {
    id: string;
    ratio: number;
    isIntersecting: boolean;
    boundingRect: DOMRectReadOnly;
}

export const useScrollSyncObserver = (
    section: string,
    subItems: SubItem[],
    options: UseScrollSyncObserverOptions = {}
) => {
    const {
        threshold = 0.5,
        rootMargin = '-10% 0px -10% 0px', // Bias towards upper part of viewport
        debounceMs = 200,
        enabled = true
    } = options;

    const { setPosition, registerScrollHandler, unregisterScrollHandler } = useScrollSync();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const visibilityMapRef = useRef<Map<string, VisibilityInfo>>(new Map());

    // Debounced position update function
    const updatePosition = useCallback((mostVisibleId?: string) => {
        setPosition({ section, subId: mostVisibleId });
    }, [section, setPosition]);

    const debouncedUpdatePosition = useDebouncedCallback(updatePosition, debounceMs);

    // Function to find the most visible sub-item
    const findMostVisible = useCallback((): string | undefined => {
        const visibleItems = Array.from(visibilityMapRef.current.values())
            .filter(item => item.isIntersecting && item.ratio > 0);

        if (visibleItems.length === 0) {
            return undefined;
        }

        if (visibleItems.length === 1) {
            return visibleItems[0].id;
        }

        // For multiple visible items, prioritize based on:
        // 1. Higher intersection ratio
        // 2. Items closer to the top of the viewport (upper bias)
        const sorted = visibleItems.sort((a, b) => {
            // First, compare intersection ratios
            const ratioDiff = b.ratio - a.ratio;
            if (Math.abs(ratioDiff) > 0.1) { // Significant difference in visibility
                return ratioDiff;
            }

            // If ratios are similar, prefer the one higher in the viewport
            const aTop = a.boundingRect.top;
            const bTop = b.boundingRect.top;

            // Prefer items in the upper portion of the viewport
            const viewportHeight = window.innerHeight;
            const upperThreshold = viewportHeight * 0.3; // Top 30% of viewport

            const aInUpper = aTop >= 0 && aTop <= upperThreshold;
            const bInUpper = bTop >= 0 && bTop <= upperThreshold;

            if (aInUpper && !bInUpper) return -1;
            if (!aInUpper && bInUpper) return 1;

            // If both are in same region, prefer the one closer to top
            return aTop - bTop;
        });

        return sorted[0].id;
    }, []);

    // Intersection observer callback
    const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
        let hasChanges = false;

        entries.forEach(entry => {
            const id = entry.target.getAttribute('data-scroll-id');
            if (!id) return;

            const visibilityInfo: VisibilityInfo = {
                id,
                ratio: entry.intersectionRatio,
                isIntersecting: entry.isIntersecting,
                boundingRect: entry.boundingClientRect
            };

            visibilityMapRef.current.set(id, visibilityInfo);
            hasChanges = true;
        });

        if (hasChanges) {
            const mostVisibleId = findMostVisible();
            debouncedUpdatePosition(mostVisibleId);
        }
    }, [findMostVisible, debouncedUpdatePosition]);

    // Scroll to function
    const scrollToSubItem = useCallback((subId?: string) => {
        if (!subId) {
            // Scroll to section start
            const sectionElement = document.querySelector(`#${section}`);
            if (sectionElement) {
                sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        // Find the sub-item by ID
        const subItem = subItems.find(item => item.id === subId);
        if (subItem?.ref.current) {
            subItem.ref.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        } else {
            // Fallback: try to find element by data-scroll-id
            const element = document.querySelector(`[data-scroll-id="${subId}"]`);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }
    }, [section, subItems]);

    // Setup intersection observer
    useEffect(() => {
        if (!enabled || subItems.length === 0) {
            return;
        }

        // Create observer
        observerRef.current = new IntersectionObserver(handleIntersection, {
            threshold,
            rootMargin
        });

        // Observe all sub-items
        subItems.forEach(subItem => {
            if (subItem.ref.current) {
                // Ensure the element has the data attribute for identification
                subItem.ref.current.setAttribute('data-scroll-id', subItem.id);
                observerRef.current?.observe(subItem.ref.current);
            }
        });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            visibilityMapRef.current.clear();
        };
    }, [enabled, subItems, threshold, rootMargin, handleIntersection]);

    // Register scroll handler
    useEffect(() => {
        registerScrollHandler(section, scrollToSubItem);
        return () => {
            unregisterScrollHandler(section);
        };
    }, [section, scrollToSubItem, registerScrollHandler, unregisterScrollHandler]);

    // Return utilities for components
    return useMemo(() => ({
        scrollToSubItem,
        isObserving: !!observerRef.current && enabled,
        visibleSubItems: Array.from(visibilityMapRef.current.values())
            .filter(item => item.isIntersecting)
            .map(item => item.id)
    }), [scrollToSubItem, enabled]);
}; 