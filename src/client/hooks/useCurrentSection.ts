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
                console.log('[useCurrentSection] Intersection entries:', entries.map(e => ({
                    id: e.target.id,
                    isIntersecting: e.isIntersecting,
                    intersectionRatio: e.intersectionRatio
                })));

                // Find the section with the highest intersection ratio
                let maxRatio = 0;
                let activeSection: CurrentSection = null;

                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                        maxRatio = entry.intersectionRatio;

                        // Extract section name from element ID
                        const sectionId = entry.target.id;
                        if (sectionId === 'brainstorm-ideas' || sectionId === 'story-outline') {
                            activeSection = sectionId;
                        }
                    }
                });

                console.log('[useCurrentSection] Setting active section:', activeSection);
                setCurrentSection(activeSection);
            },
            {
                root: null, // Use viewport as root
                rootMargin: '-20% 0px -20% 0px', // Trigger when section is in middle 60% of viewport
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] // Multiple thresholds for better detection
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