import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';

export const useProjectStreaming = (projectId: string | undefined) => {
    const setBrainstormIdeas = useProjectStore(state => state.setBrainstormIdeas);
    const setStreamingError = useProjectStore(state => state.setStreamingError);
    const setStreamingStatus = useProjectStore(state => state.setStreamingStatus);
    const ensureProject = useProjectStore(state => state.ensureProject);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!projectId) {
            return;
        }

        // Ensure project exists in store
        ensureProject(projectId);
        setStreamingStatus(projectId, 'connecting');

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
            setStreamingStatus(projectId, 'streaming');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[SSE] Received message:', data);

                if (data.type === 'chunk' && data.data) {
                    console.log('[SSE] Processing chunk data:', data.data);
                    setBrainstormIdeas(projectId, data.data);
                    setStreamingStatus(projectId, 'streaming');
                } else if (data.type === 'final_result' && data.data) {
                    console.log('[SSE] Processing final result data:', data.data);
                    setBrainstormIdeas(projectId, data.data);
                    setStreamingStatus(projectId, 'completed');
                } else if (data.type === 'connection_established') {
                    console.log('[SSE] Connection established for project:', data.projectId);
                } else if (data.type === 'error') {
                     setStreamingError(projectId, data.error || 'An unknown streaming error occurred');
                     setStreamingStatus(projectId, 'error');
                }

            } catch (error) {
                console.error('[SSE] Error parsing message data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('[SSE] Connection error:', error);
            setStreamingError(projectId, 'Connection to the server was lost.');
            setStreamingStatus(projectId, 'error');
            eventSource.close();
        };

        // Cleanup on component unmount
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                console.log(`[SSE] Connection closed for project ${projectId}`);
            }
        };

    }, [projectId, setBrainstormIdeas, setStreamingError, setStreamingStatus]);
}; 