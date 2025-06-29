import { useState, useEffect } from 'react';

export type CurrentSection = 'brainstorm-ideas' | 'story-outline' | null;

/**
 * Hook to detect which section is currently visible in the viewport
 * Used for highlighting the current section in the workflow visualization
 */
export function useCurrentSection(): CurrentSection {
    console.log('[useCurrentSection] Hook called');
    const [currentSection, setCurrentSection] = useState<CurrentSection>(null);

    useEffect(() => {
        console.log('[useCurrentSection] useEffect started');
        const sectionSelectors = [
            '#brainstorm-ideas',
            '#story-outline'
        ];

        const observer = new IntersectionObserver(
            (entries) => {
                console.log('🔍 [useCurrentSection] INTERSECTION EVENT - entries received:', entries.length);

                // SOLUTION: Don't rely on entries (which only show changes)
                // Instead, manually check all target elements on every intersection event
                const sectionSelectors = ['#brainstorm-ideas', '#story-outline'];
                const allSectionData: { id: string; rect: DOMRect; element: HTMLElement }[] = [];

                console.log('🔍 [useCurrentSection] Manual check of ALL elements:');
                sectionSelectors.forEach(selector => {
                    const element = document.querySelector(selector) as HTMLElement;
                    if (element) {
                        const rect = element.getBoundingClientRect();
                        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

                        console.log(`🔍 ${selector} manual check:`, {
                            top: rect.top,
                            bottom: rect.bottom,
                            height: rect.height,
                            viewportHeight: window.innerHeight,
                            isVisible,
                            intersectionRatio: isVisible ? Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height : 0
                        });

                        if (isVisible) {
                            allSectionData.push({
                                id: element.id,
                                rect,
                                element
                            });
                        }
                    }
                });

                // Find the section whose center is closest to the viewport center
                let activeSection: CurrentSection = null;
                let minDistanceToCenter = Infinity;
                const viewportCenter = window.innerHeight / 2;

                // Process all visible sections (not just intersection observer entries)
                allSectionData.forEach(({ id, rect, element }) => {
                    const elementCenter = rect.top + (rect.height / 2);
                    const distanceToCenter = Math.abs(elementCenter - viewportCenter);

                    // Calculate intersection ratio manually
                    const intersectionRatio = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height;

                    console.log(`🎯 [useCurrentSection] MANUAL CHECK - ${id}:`, {
                        intersectionRatio,
                        elementCenter,
                        viewportCenter,
                        distanceToCenter,
                        rect: { top: rect.top, bottom: rect.bottom, height: rect.height }
                    });

                    // First pass: try to find a section with good visibility (>3%)
                    if (intersectionRatio > 0.03) {
                        if (distanceToCenter < minDistanceToCenter) {
                            minDistanceToCenter = distanceToCenter;
                            if (id === 'brainstorm-ideas' || id === 'story-outline') {
                                activeSection = id as CurrentSection;
                            }
                        }
                    }
                });

                // Second pass: if no section was found with good visibility, take any visible section
                if (!activeSection) {
                    console.log('🎯 [useCurrentSection] SECOND PASS - no good visibility sections found');
                    minDistanceToCenter = Infinity;
                    allSectionData.forEach(({ id, rect }) => {
                        const elementCenter = rect.top + (rect.height / 2);
                        const distanceToCenter = Math.abs(elementCenter - viewportCenter);
                        const intersectionRatio = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height;

                        console.log(`🎯 [useCurrentSection] SECOND PASS - ${id} (fallback):`, {
                            intersectionRatio,
                            elementCenter,
                            viewportCenter,
                            distanceToCenter,
                            rect: { top: rect.top, bottom: rect.bottom, height: rect.height }
                        });

                        if (intersectionRatio > 0 && distanceToCenter < minDistanceToCenter) {
                            minDistanceToCenter = distanceToCenter;
                            if (id === 'brainstorm-ideas' || id === 'story-outline') {
                                activeSection = id as CurrentSection;
                            }
                        }
                    });
                }

                console.log('✅ [useCurrentSection] FINAL RESULT - Setting active section:', activeSection, 'minDistance:', minDistanceToCenter);
                setCurrentSection(activeSection);
            },
            {
                root: null, // Use viewport as root
                rootMargin: '0px 0px 0px 0px', // Use full viewport - no margin restrictions
                threshold: [0, 0.01, 0.03, 0.05, 0.1, 0.25, 0.5, 0.75, 1] // More fine-grained thresholds
            }
        );

        // Start observing elements with a slight delay to ensure DOM is ready
        const setupObserver = () => {
            const elementsFound: string[] = [];

            sectionSelectors.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    elementsFound.push(selector);
                    observer.observe(element);
                } else {
                    console.warn(`[useCurrentSection] Element not found: ${selector}`);
                }
            });

            console.log('[useCurrentSection] Started observing elements:', elementsFound);
        };

        // Setup immediately
        setupObserver();

        // Also try again after a short delay in case elements aren't ready yet
        const timeoutId = setTimeout(() => {
            setupObserver();

            // Additional debugging - check element positions
            sectionSelectors.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    console.log(`[useCurrentSection] Element ${selector} position:`, {
                        top: rect.top,
                        bottom: rect.bottom,
                        height: rect.height,
                        visible: rect.top < window.innerHeight && rect.bottom > 0
                    });
                }
            });
        }, 500);

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, []);

    return currentSection;
} 