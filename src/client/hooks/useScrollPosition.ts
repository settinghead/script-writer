import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface UseScrollPositionOptions {
    /** Unique key for this scroll container (defaults to current pathname) */
    key?: string;
    /** Whether to restore scroll position immediately on mount */
    restoreOnMount?: boolean;
    /** Delay in ms to wait before restoring scroll position (for async content) */
    restoreDelay?: number;
    /** Maximum number of retry attempts for scroll restoration */
    maxRetries?: number;
    /** Interval in ms between retry attempts */
    retryInterval?: number;
    /** Whether to save scroll position on unmount */
    saveOnUnmount?: boolean;
    /** Debounce delay in ms for saving scroll position */
    saveDebounce?: number;
    /** Whether to enable debug logging */
    debug?: boolean;
}

interface ScrollPosition {
    scrollTop: number;
    scrollLeft: number;
    timestamp: number;
}

const SCROLL_STORAGE_PREFIX = 'scroll_position_';
const DEFAULT_RESTORE_DELAY = 100;
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_RETRY_INTERVAL = 200;
const DEFAULT_SAVE_DEBOUNCE = 100;

/**
 * Hook for preserving scroll position across page refreshes and navigation
 * Handles async content loading by retrying scroll restoration
 */
export const useScrollPosition = (
    containerRef: React.RefObject<HTMLElement | null>,
    options: UseScrollPositionOptions = {}
) => {
    const location = useLocation();
    const {
        key = location.pathname,
        restoreOnMount = true,
        restoreDelay = DEFAULT_RESTORE_DELAY,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryInterval = DEFAULT_RETRY_INTERVAL,
        saveOnUnmount = true,
        saveDebounce = DEFAULT_SAVE_DEBOUNCE,
        debug = false
    } = options;

    const storageKey = `${SCROLL_STORAGE_PREFIX}${key}`;
    const saveTimeoutRef = useRef<number | undefined>(undefined);
    const restoreTimeoutRef = useRef<number | undefined>(undefined);
    const isRestoringRef = useRef(false);

    const log = useCallback((...args: any[]) => {
        if (debug) {
            console.log('[useScrollPosition]', ...args);
        }
    }, [debug]);

    // Save scroll position to localStorage
    const saveScrollPosition = useCallback(() => {
        if (!containerRef.current) return;

        const element = containerRef.current;
        const position: ScrollPosition = {
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(storageKey, JSON.stringify(position));
            log('Saved scroll position:', position);
        } catch (error) {
            console.warn('Failed to save scroll position:', error);
        }
    }, [containerRef, storageKey, log]);

    // Debounced save function
    const debouncedSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            window.clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
            saveScrollPosition();
        }, saveDebounce);
    }, [saveScrollPosition, saveDebounce]);

    // Restore scroll position from localStorage
    const restoreScrollPosition = useCallback((retryCount = 0) => {
        if (!containerRef.current) {
            log('Container not available for restore, retry:', retryCount);
            if (retryCount < maxRetries) {
                restoreTimeoutRef.current = window.setTimeout(() => {
                    restoreScrollPosition(retryCount + 1);
                }, retryInterval);
            }
            return;
        }

        try {
            const savedPosition = localStorage.getItem(storageKey);
            if (!savedPosition) {
                log('No saved scroll position found');
                isRestoringRef.current = false;
                return;
            }

            const position: ScrollPosition = JSON.parse(savedPosition);
            const element = containerRef.current;

            // Check if content is ready (has scrollable height)
            const hasContent = element.scrollHeight > element.clientHeight;

            if (!hasContent && retryCount < maxRetries) {
                log('Content not ready, retrying...', retryCount, {
                    scrollHeight: element.scrollHeight,
                    clientHeight: element.clientHeight
                });

                restoreTimeoutRef.current = window.setTimeout(() => {
                    restoreScrollPosition(retryCount + 1);
                }, retryInterval);
                return;
            }

            // Restore scroll position
            element.scrollTop = position.scrollTop;
            element.scrollLeft = position.scrollLeft;

            log('Restored scroll position:', position, 'after', retryCount, 'retries');
            isRestoringRef.current = false;

            // Verify restoration was successful
            const actualScrollTop = element.scrollTop;
            if (Math.abs(actualScrollTop - position.scrollTop) > 10 && retryCount < maxRetries) {
                log('Scroll restoration incomplete, retrying...', {
                    expected: position.scrollTop,
                    actual: actualScrollTop
                });

                restoreTimeoutRef.current = window.setTimeout(() => {
                    restoreScrollPosition(retryCount + 1);
                }, retryInterval);
            }
        } catch (error) {
            console.warn('Failed to restore scroll position:', error);
            isRestoringRef.current = false;
        }
    }, [containerRef, storageKey, maxRetries, retryInterval, log]);

    // Handle scroll events
    const handleScroll = useCallback(() => {
        if (isRestoringRef.current) {
            log('Skipping save during restoration');
            return;
        }
        debouncedSave();
    }, [debouncedSave, log]);

    // Manually trigger scroll restoration (useful for after async content loads)
    const triggerRestore = useCallback(() => {
        log('Manually triggering scroll restoration');
        isRestoringRef.current = true;

        if (restoreTimeoutRef.current) {
            window.clearTimeout(restoreTimeoutRef.current);
        }

        window.setTimeout(() => {
            restoreScrollPosition(0);
        }, restoreDelay);
    }, [restoreScrollPosition, restoreDelay, log]);

    // Clear saved position
    const clearSavedPosition = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
            log('Cleared saved scroll position');
        } catch (error) {
            console.warn('Failed to clear scroll position:', error);
        }
    }, [storageKey, log]);

    // Setup scroll event listener
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        element.addEventListener('scroll', handleScroll, { passive: true });
        log('Scroll listener attached');

        return () => {
            element.removeEventListener('scroll', handleScroll);
            log('Scroll listener removed');
        };
    }, [handleScroll, log]);

    // Restore scroll position on mount
    useEffect(() => {
        if (restoreOnMount) {
            log('Initiating scroll restoration on mount');
            isRestoringRef.current = true;

            window.setTimeout(() => {
                restoreScrollPosition(0);
            }, restoreDelay);
        }

        return () => {
            // Clear any pending timeouts
            if (restoreTimeoutRef.current) {
                window.clearTimeout(restoreTimeoutRef.current);
            }
        };
    }, [restoreOnMount, restoreScrollPosition, restoreDelay, log]);

    // Save scroll position on unmount
    useEffect(() => {
        return () => {
            if (saveOnUnmount) {
                log('Saving scroll position on unmount');
                saveScrollPosition();
            }

            // Clear any pending save timeout
            if (saveTimeoutRef.current) {
                window.clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [saveOnUnmount, saveScrollPosition, log]);

    // Save scroll position when navigating away
    useEffect(() => {
        const handleBeforeUnload = () => {
            log('Saving scroll position before page unload');
            saveScrollPosition();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [saveScrollPosition, log]);

    return {
        triggerRestore,
        clearSavedPosition,
        saveScrollPosition,
        isRestoring: isRestoringRef.current
    };
}; 