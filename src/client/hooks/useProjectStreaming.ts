import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ProjectStreamingState {
    status: 'idle' | 'connecting' | 'connected' | 'error';
    operations: Array<{
        transformId: string;
        type: string;
        status: string;
        created_at: string;
    }>;
    streamingData: any[];
    error: string | null;
    connectionTime?: string;
}

export const useProjectStreaming = (projectId: string | null) => {
    const queryClient = useQueryClient();
    const eventSourceRef = useRef<EventSource | null>(null);
    const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);

    const queryKey = ['project-streaming', projectId];

    const { data: streamingState } = useQuery<ProjectStreamingState>({
        queryKey,
        queryFn: () => Promise.resolve({
            status: 'idle',
            operations: [],
            streamingData: [],
            error: null,
        }),
        initialData: {
            status: 'idle',
            operations: [],
            streamingData: [],
            error: null,
        },
        staleTime: Infinity,
        gcTime: Infinity,
        enabled: !!projectId,
    });

    const connect = () => {
        if (!projectId || eventSourceRef.current || isManuallyDisconnected) {
            return;
        }

        console.log(`[Project Streaming] Connecting to project ${projectId}`);

        // Update state to connecting
        queryClient.setQueryData<ProjectStreamingState>(queryKey, (oldData) => ({
            ...(oldData || {}),
            status: 'connecting',
            error: null,
        } as ProjectStreamingState));

        const eventSource = new EventSource(`/api/project-stream/${projectId}/stream`, {
            withCredentials: true,
        });

        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log(`[Project Streaming] Connected to project ${projectId}`);
            queryClient.setQueryData<ProjectStreamingState>(queryKey, (oldData) => ({
                ...(oldData || {}),
                status: 'connected',
                connectionTime: new Date().toISOString(),
                error: null,
            } as ProjectStreamingState));
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log(`[Project Streaming] Received data:`, data);

                queryClient.setQueryData<ProjectStreamingState>(queryKey, (oldData) => {
                    if (!oldData) return oldData;

                    const newData = { ...oldData };

                    switch (data.type) {
                        case 'active_operations':
                            newData.operations = data.operations || [];
                            break;
                        case 'chunk':
                            // Handle streaming chunks from active operations
                            if (Array.isArray(data.data)) {
                                newData.streamingData = data.data;
                            }
                            break;
                        case 'complete':
                            // Handle completion of operations
                            if (Array.isArray(data.results)) {
                                newData.streamingData = data.results.flat();
                            }
                            break;
                        case 'error':
                            newData.error = data.error;
                            break;
                        case 'status':
                            // Handle status messages
                            console.log(`[Project Streaming] Status: ${data.message}`);
                            break;
                        default:
                            // Handle other streaming formats (like "0:..." chunks)
                            if (typeof event.data === 'string' && event.data.startsWith('0:')) {
                                try {
                                    const chunkContent = JSON.parse(event.data.substring(2));
                                    if (Array.isArray(chunkContent)) {
                                        newData.streamingData = chunkContent;
                                    }
                                } catch (e) {
                                    console.warn('[Project Streaming] Failed to parse chunk:', e);
                                }
                            }
                    }

                    return newData;
                });
            } catch (e) {
                console.error('[Project Streaming] Error parsing message:', e);
            }
        };

        eventSource.onerror = (error) => {
            console.error(`[Project Streaming] Connection error for project ${projectId}:`, error);
            queryClient.setQueryData<ProjectStreamingState>(queryKey, (oldData) => ({
                ...(oldData || {}),
                status: 'error',
                error: 'Connection failed',
            } as ProjectStreamingState));

            // Clean up
            eventSource.close();
            eventSourceRef.current = null;

            // Retry connection after a delay unless manually disconnected
            if (!isManuallyDisconnected) {
                setTimeout(() => {
                    if (!isManuallyDisconnected) {
                        connect();
                    }
                }, 3000);
            }
        };
    };

    const disconnect = () => {
        console.log(`[Project Streaming] Disconnecting from project ${projectId}`);
        setIsManuallyDisconnected(true);
        
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        queryClient.setQueryData<ProjectStreamingState>(queryKey, (oldData) => ({
            ...(oldData || {}),
            status: 'idle',
        } as ProjectStreamingState));
    };

    const reconnect = () => {
        setIsManuallyDisconnected(false);
        disconnect();
        setTimeout(connect, 100);
    };

    // Auto-connect when projectId changes
    useEffect(() => {
        if (projectId && !isManuallyDisconnected) {
            connect();
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [projectId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, []);

    return {
        streamingState,
        connect,
        disconnect,
        reconnect,
        isConnected: streamingState?.status === 'connected',
        isConnecting: streamingState?.status === 'connecting',
        hasError: streamingState?.status === 'error',
    };
}; 