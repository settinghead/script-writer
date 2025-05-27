import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { StagewiseToolbar as Toolbar } from '@stagewise/toolbar-react';

const stagewiseConfig = {
    plugins: []
};

const StagewiseToolbarComponent: React.FC = () => {
    return <Toolbar config={stagewiseConfig} />;
};

const StagewiseToolbar: React.FC = () => {
    useEffect(() => {
        // Only run in development mode
        if (process.env.NODE_ENV === 'development') {
            // Create a separate DOM element for the toolbar
            let toolbarContainer = document.getElementById('stagewise-toolbar-root');

            if (!toolbarContainer) {
                toolbarContainer = document.createElement('div');
                toolbarContainer.id = 'stagewise-toolbar-root';
                document.body.appendChild(toolbarContainer);
            }

            // Create a separate React root for the toolbar
            const toolbarRoot = ReactDOM.createRoot(toolbarContainer);
            toolbarRoot.render(<StagewiseToolbarComponent />);

            // Cleanup function
            return () => {
                // Use setTimeout to defer the unmount to avoid race condition
                setTimeout(() => {
                    try {
                        toolbarRoot.unmount();
                        if (toolbarContainer && toolbarContainer.parentNode) {
                            toolbarContainer.parentNode.removeChild(toolbarContainer);
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