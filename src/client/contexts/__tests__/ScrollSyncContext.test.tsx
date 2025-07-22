import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollSyncProvider, useScrollSync } from '../ScrollSyncContext';

// Test component that uses the scroll sync context
const TestComponent: React.FC<{ onPositionChange?: (position: any) => void }> = ({ onPositionChange }) => {
    const { currentPosition, setPosition, scrollTo, registerScrollHandler, unregisterScrollHandler } = useScrollSync();

    React.useEffect(() => {
        if (onPositionChange && currentPosition) {
            onPositionChange(currentPosition);
        }
    }, [currentPosition, onPositionChange]);

    const handleSetPosition = () => {
        setPosition({ section: 'test-section', subId: 'test-sub' });
    };

    const handleScrollTo = () => {
        scrollTo('test-section', 'test-sub');
    };

    const handleRegisterHandler = () => {
        const mockHandler = vi.fn();
        registerScrollHandler('test-section', mockHandler);
    };

    return (
        <div>
            <div data-testid="current-position">
                {currentPosition ? `${currentPosition.section}:${currentPosition.subId || 'none'}` : 'none'}
            </div>
            <button data-testid="set-position" onClick={handleSetPosition}>
                Set Position
            </button>
            <button data-testid="scroll-to" onClick={handleScrollTo}>
                Scroll To
            </button>
            <button data-testid="register-handler" onClick={handleRegisterHandler}>
                Register Handler
            </button>
        </div>
    );
};

describe('ScrollSyncContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should provide scroll sync context to children', () => {
        render(
            <ScrollSyncProvider>
                <TestComponent />
            </ScrollSyncProvider>
        );

        expect(screen.getByTestId('current-position')).toHaveTextContent('none');
        expect(screen.getByTestId('set-position')).toBeInTheDocument();
        expect(screen.getByTestId('scroll-to')).toBeInTheDocument();
    });

    it('should throw error when useScrollSync is used outside provider', () => {
        // Mock console.error to prevent test output pollution
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => {
            render(<TestComponent />);
        }).toThrow('useScrollSync must be used within a ScrollSyncProvider');

        consoleSpy.mockRestore();
    });

    it('should update position when setPosition is called', async () => {
        const onPositionChange = vi.fn();

        render(
            <ScrollSyncProvider>
                <TestComponent onPositionChange={onPositionChange} />
            </ScrollSyncProvider>
        );

        const setPositionButton = screen.getByTestId('set-position');

        await act(async () => {
            fireEvent.click(setPositionButton);
        });

        expect(screen.getByTestId('current-position')).toHaveTextContent('test-section:test-sub');
        expect(onPositionChange).toHaveBeenCalledWith(
            expect.objectContaining({
                section: 'test-section',
                subId: 'test-sub',
                timestamp: expect.any(Number)
            })
        );
    });

    it('should not update position if same position is set', async () => {
        const onPositionChange = vi.fn();

        render(
            <ScrollSyncProvider>
                <TestComponent onPositionChange={onPositionChange} />
            </ScrollSyncProvider>
        );

        const setPositionButton = screen.getByTestId('set-position');

        // Set position first time
        await act(async () => {
            fireEvent.click(setPositionButton);
        });

        expect(onPositionChange).toHaveBeenCalledTimes(1);

        // Set same position again
        await act(async () => {
            fireEvent.click(setPositionButton);
        });

        // Should not trigger another update
        expect(onPositionChange).toHaveBeenCalledTimes(1);
    });

    it('should call registered scroll handler when scrollTo is invoked', async () => {
        const mockHandler = vi.fn();

        const TestComponentWithHandler: React.FC = () => {
            const { scrollTo, registerScrollHandler } = useScrollSync();

            React.useEffect(() => {
                registerScrollHandler('test-section', mockHandler);
            }, [registerScrollHandler]);

            const handleScrollTo = () => {
                scrollTo('test-section', 'test-sub');
            };

            return (
                <button data-testid="scroll-to" onClick={handleScrollTo}>
                    Scroll To
                </button>
            );
        };

        render(
            <ScrollSyncProvider>
                <TestComponentWithHandler />
            </ScrollSyncProvider>
        );

        const scrollToButton = screen.getByTestId('scroll-to');

        await act(async () => {
            fireEvent.click(scrollToButton);
        });

        expect(mockHandler).toHaveBeenCalledWith('test-sub');
    });

    it('should warn when scrollTo is called for unregistered section', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        render(
            <ScrollSyncProvider>
                <TestComponent />
            </ScrollSyncProvider>
        );

        const scrollToButton = screen.getByTestId('scroll-to');

        await act(async () => {
            fireEvent.click(scrollToButton);
        });

        expect(consoleSpy).toHaveBeenCalledWith('No scroll handler registered for section: test-section');

        consoleSpy.mockRestore();
    });

    it('should unregister scroll handler', async () => {
        const mockHandler = vi.fn();

        const TestComponentWithUnregister: React.FC = () => {
            const { scrollTo, registerScrollHandler, unregisterScrollHandler } = useScrollSync();

            const handleRegisterAndUnregister = async () => {
                registerScrollHandler('test-section', mockHandler);
                unregisterScrollHandler('test-section');
                scrollTo('test-section', 'test-sub');
            };

            return (
                <button data-testid="register-unregister" onClick={handleRegisterAndUnregister}>
                    Register and Unregister
                </button>
            );
        };

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        render(
            <ScrollSyncProvider>
                <TestComponentWithUnregister />
            </ScrollSyncProvider>
        );

        const button = screen.getByTestId('register-unregister');

        await act(async () => {
            fireEvent.click(button);
        });

        expect(mockHandler).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('No scroll handler registered for section: test-section');

        consoleSpy.mockRestore();
    });
}); 