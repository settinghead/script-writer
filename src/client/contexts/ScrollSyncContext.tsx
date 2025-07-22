import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface ScrollPosition {
    section: string;
    subId?: string;
    timestamp?: number;
}

export interface ScrollSyncContextValue {
    currentPosition: ScrollPosition | null;
    setPosition: (position: ScrollPosition) => void;
    scrollTo: (section: string, subId?: string) => void;
    registerScrollHandler: (section: string, handler: (subId?: string) => void) => void;
    unregisterScrollHandler: (section: string) => void;
}

const ScrollSyncContext = createContext<ScrollSyncContextValue | null>(null);

export const useScrollSync = () => {
    const context = useContext(ScrollSyncContext);
    if (!context) {
        throw new Error('useScrollSync must be used within a ScrollSyncProvider');
    }
    return context;
};

interface ScrollSyncProviderProps {
    children: React.ReactNode;
}

export const ScrollSyncProvider: React.FC<ScrollSyncProviderProps> = ({ children }) => {
    const [currentPosition, setCurrentPosition] = useState<ScrollPosition | null>(null);
    const [scrollHandlers, setScrollHandlers] = useState<Map<string, (subId?: string) => void>>(new Map());

    const setPosition = useCallback((position: ScrollPosition) => {
        setCurrentPosition(prev => {
            // Avoid unnecessary updates if position hasn't changed
            if (prev?.section === position.section && prev?.subId === position.subId) {
                return prev;
            }
            return {
                ...position,
                timestamp: Date.now()
            };
        });
    }, []);

    const scrollTo = useCallback((section: string, subId?: string) => {
        const handler = scrollHandlers.get(section);
        if (handler) {
            handler(subId);
            // Update position after scroll
            setPosition({ section, subId });
        } else {
            console.warn(`No scroll handler registered for section: ${section}`);
        }
    }, [scrollHandlers, setPosition]);

    const registerScrollHandler = useCallback((section: string, handler: (subId?: string) => void) => {
        setScrollHandlers(prev => {
            const newMap = new Map(prev);
            newMap.set(section, handler);
            return newMap;
        });
    }, []);

    const unregisterScrollHandler = useCallback((section: string) => {
        setScrollHandlers(prev => {
            const newMap = new Map(prev);
            newMap.delete(section);
            return newMap;
        });
    }, []);

    const contextValue = useMemo(() => ({
        currentPosition,
        setPosition,
        scrollTo,
        registerScrollHandler,
        unregisterScrollHandler
    }), [currentPosition, setPosition, scrollTo, registerScrollHandler, unregisterScrollHandler]);

    return (
        <ScrollSyncContext.Provider value={contextValue}>
            {children}
        </ScrollSyncContext.Provider>
    );
}; 