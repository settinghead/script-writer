import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';

export const useProjectStreaming = (projectId: string | undefined) => {
    const setBrainstormIdeas = useProjectStore(state => state.setBrainstormIdeas);
    const setStreamingError = useProjectStore(state => state.setStreamingError);
    const ensureProject = useProjectStore(state => state.ensureProject);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!projectId) {
            return;
        }

        // Ensure project exists in store
        ensureProject(projectId);

        // Close any existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        // Open new SSE connection
        const eventSource = new EventSource(`/api/streaming/project/${projectId}`, { withCredentials: true });
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log(`[SSE] Connection opened for project ${projectId}`);
            setStreamingError(projectId, null);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[SSE] Received message:', data);

                if (data.type === 'chunk' && data.data) {
                    console.log('[SSE] Processing chunk data:', data.data);
                    // Assuming the chunk is for brainstorming for now
                    // This can be expanded with more message types
                    setBrainstormIdeas(projectId, data.data);
                }
                
                if (data.type === 'error') {
                     setStreamingError(projectId, data.error || 'An unknown streaming error occurred');
                }

            } catch (error) {
                console.error('[SSE] Error parsing message data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('[SSE] Connection error:', error);
            setStreamingError(projectId, 'Connection to the server was lost.');
            eventSource.close();
        };

        // Cleanup on component unmount
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                console.log(`[SSE] Connection closed for project ${projectId}`);
            }
        };

    }, [projectId, setBrainstormIdeas, setStreamingError]);
}; 