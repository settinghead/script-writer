import { useState, useEffect } from 'react';

export type CurrentSection = 'brainstorm-ideas' | 'story-outline' | null;

/**
 * Hook to detect which section is currently visible in the viewport
 * Used for highlighting the current section in the workflow visualization
 */
export function useCurrentSection(): CurrentSection {
    const [currentSection, setCurrentSection] = useState<CurrentSection>(null);

    useEffect(() => {
        const sectionSelectors = [
            '#brainstorm-ideas',
            '#story-outline'
        ];

        const observer = new IntersectionObserver(
            (entries) => {

                // SOLUTION: Don't rely on entries (which only show changes)
                // Instead, manually check all target elements on every intersection event
                const sectionSelectors = ['#brainstorm-ideas', '#story-outline'];
                const allSectionData: { id: string; rect: DOMRect; element: HTMLElement }[] = [];

                sectionSelectors.forEach(selector => {
                    const element = document.querySelector(selector) as HTMLElement;
                    if (element) {
                        const rect = element.getBoundingClientRect();
                        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;



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
                const sectionsWithData: Array<{
                    id: string;
                    intersectionRatio: number;
                    distanceToCenter: number;
                    elementCenter: number;
                    rect: DOMRect;
                }> = [];

                allSectionData.forEach(({ id, rect, element }) => {
                    const elementCenter = rect.top + (rect.height / 2);
                    const distanceToCenter = Math.abs(elementCenter - viewportCenter);

                    // Calculate intersection ratio manually
                    const intersectionRatio = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height;


                    if (intersectionRatio > 0.03 && (id === 'brainstorm-ideas' || id === 'story-outline')) {
                        sectionsWithData.push({
                            id,
                            intersectionRatio,
                            distanceToCenter,
                            elementCenter,
                            rect
                        });
                    }
                });

                // NEW LOGIC: Prioritize intersection ratio over distance to center
                if (sectionsWithData.length > 0) {
                    // Sort by intersection ratio first (descending), then by distance to center (ascending)
                    sectionsWithData.sort((a, b) => {
                        // If one section has higher intersection ratio (>5% difference), prioritize it
                        const ratioDiff = Math.abs(a.intersectionRatio - b.intersectionRatio);
                        if (ratioDiff > 0.05) {
                            return b.intersectionRatio - a.intersectionRatio; // Higher ratio wins
                        }

                        // If ratios are very similar, use distance to center as tie-breaker
                        return a.distanceToCenter - b.distanceToCenter; // Closer to center wins
                    });

                    const winner = sectionsWithData[0];
                    activeSection = winner.id as CurrentSection;
                    minDistanceToCenter = winner.distanceToCenter;

                }

                // Fallback: if no section was found with good visibility (>3%), try any visible section
                if (!activeSection && allSectionData.length > 0) {
                    console.log('🎯 [useCurrentSection] FALLBACK - no good visibility sections found, trying any visible section');

                    const fallbackSections: Array<{
                        id: string;
                        intersectionRatio: number;
                        distanceToCenter: number;
                    }> = [];

                    allSectionData.forEach(({ id, rect }) => {
                        const elementCenter = rect.top + (rect.height / 2);
                        const distanceToCenter = Math.abs(elementCenter - viewportCenter);
                        const intersectionRatio = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height;

                        if (intersectionRatio > 0 && (id === 'brainstorm-ideas' || id === 'story-outline')) {
                            fallbackSections.push({ id, intersectionRatio, distanceToCenter });
                        }
                    });

                    if (fallbackSections.length > 0) {
                        // Same logic: prioritize intersection ratio over distance
                        fallbackSections.sort((a, b) => {
                            const ratioDiff = Math.abs(a.intersectionRatio - b.intersectionRatio);
                            if (ratioDiff > 0.1) {
                                return b.intersectionRatio - a.intersectionRatio;
                            }
                            return a.distanceToCenter - b.distanceToCenter;
                        });

                        const winner = fallbackSections[0];
                        activeSection = winner.id as CurrentSection;
                        minDistanceToCenter = winner.distanceToCenter;

                    }
                }

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

        };

        // Setup immediately
        setupObserver();

        // Also try again after a short delay in case elements aren't ready yet
        const timeoutId = setTimeout(() => {
            setupObserver();
        }, 500);

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, []);

    return currentSection;
} 