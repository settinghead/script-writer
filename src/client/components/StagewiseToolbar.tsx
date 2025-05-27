import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { StagewiseToolbar as Toolbar } from '@stagewise/toolbar-react';

const stagewiseConfig = {
    plugins: []
};

const StagewiseToolbarComponent: React.FC = () => {
    return <Toolbar config={stagewiseConfig} />;
};

// Global variables to manage the toolbar state
let globalToolbarRoot: ReactDOM.Root | null = null;
let globalToolbarContainer: HTMLElement | null = null;

const StagewiseToolbar: React.FC = () => {
    const initializedRef = useRef(false);

    useEffect(() => {
        // Only run in development mode and only once
        if (process.env.NODE_ENV === 'development' && !initializedRef.current) {
            initializedRef.current = true;

            // Check if we already have a global container
            if (!globalToolbarContainer) {
                globalToolbarContainer = document.getElementById('stagewise-toolbar-root');

                if (!globalToolbarContainer) {
                    globalToolbarContainer = document.createElement('div');
                    globalToolbarContainer.id = 'stagewise-toolbar-root';
                    document.body.appendChild(globalToolbarContainer);
                }
            }

            // Create a React root only if we don't have one
            if (!globalToolbarRoot && globalToolbarContainer) {
                globalToolbarRoot = ReactDOM.createRoot(globalToolbarContainer);
                globalToolbarRoot.render(<StagewiseToolbarComponent />);
            }

            // Cleanup function
            return () => {
                // Use setTimeout to defer the cleanup to avoid race condition
                setTimeout(() => {
                    try {
                        if (globalToolbarRoot) {
                            globalToolbarRoot.unmount();
                            globalToolbarRoot = null;
                        }
                        if (globalToolbarContainer && globalToolbarContainer.parentNode) {
                            globalToolbarContainer.parentNode.removeChild(globalToolbarContainer);
                            globalToolbarContainer = null;
                        }
                    } catch (error) {
                        console.warn('StagewiseToolbar cleanup error:', error);
                    }
                }, 0);
            };
        }
    }, []);

    // This component doesn't render anything in the main app tree
    return null;
};

export default StagewiseToolbar; 