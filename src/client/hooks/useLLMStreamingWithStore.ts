import { useEffect, useRef } from 'react';
import { useObservableState } from './useObservableState';
import { StreamingResponse, ReasoningEvent } from '../../common/streaming/types';
import { LLMStreamingService } from '../services/streaming/LLMStreamingService';
import { useProjectStore } from '../stores/projectStore';
import type { OutlineSessionData } from '../../server/services/OutlineService';

/**
 * Enhanced LLM streaming hook that integrates with the Zustand project store.
 * This hook automatically pipes streaming data into the global store based on the data type.
 */
export function useLLMStreamingWithStore<T>(
    service: LLMStreamingService<T> | undefined,
    config: {
        transformId?: string;
        projectId?: string;
        dataType?: 'outline' | 'episodes';
        stageId?: string; // Required for episode streaming
    } = {}
) {
    const { transformId, projectId, dataType, stageId } = config;
    const currentTransformIdRef = useRef<string | undefined>(undefined);
    
    // Zustand store actions
    const updateStreamingOutline = useProjectStore(state => state.updateStreamingOutline);
    const updateStreamingEpisodes = useProjectStore(state => state.updateStreamingEpisodes);
    const startStreaming = useProjectStore(state => state.startStreaming);
    const stopStreaming = useProjectStore(state => state.stopStreaming);

    console.log(`[useLLMStreamingWithStore] Hook initialized:`, {
        transformId,
        projectId,
        dataType,
        stageId
    });

    // Subscribe to the response stream
    const response = useObservableState<StreamingResponse<T>>(
        service?.response$,
        {
            status: 'idle',
            items: [],
            rawContent: ''
        }
    );

    // Subscribe to reasoning events
    const reasoningEvent = useObservableState<ReasoningEvent | null>(
        service?.reasoning$,
        null
    );

    // Handle streaming state changes in the store
    useEffect(() => {
        if (!projectId || !dataType) return;

        if (response.status === 'streaming' && transformId) {
            if (dataType === 'episodes' && stageId) {
                startStreaming(projectId, stageId, transformId);
            }
        } else if (response.status === 'completed' || response.status === 'error') {
            stopStreaming(projectId);
        }
    }, [response.status, transformId, projectId, dataType, stageId, startStreaming, stopStreaming]);

    // Pipe streaming data into the store
    useEffect(() => {
        if (!projectId || !response.items?.length) return;

        console.log(`[useLLMStreamingWithStore] Updating store with items:`, {
            dataType,
            itemCount: response.items.length,
            projectId,
            stageId
        });

        if (dataType === 'outline') {
            // Handle outline streaming - convert items to outline components
            try {
                // Assume the items are outline sections that need to be merged
                const latestItem = response.items[response.items.length - 1] as any;
                if (latestItem) {
                    // Transform the item into outline components format
                    const partialOutline = transformToOutlineComponents(latestItem);
                    updateStreamingOutline(projectId, partialOutline);
                }
            } catch (error) {
                console.error('Error updating outline in store:', error);
            }
        } else if (dataType === 'episodes' && stageId) {
            // Handle episode streaming
            try {
                const episodes = response.items as any[];
                updateStreamingEpisodes(projectId, stageId, episodes);
            } catch (error) {
                console.error('Error updating episodes in store:', error);
            }
        }
    }, [response.items, projectId, dataType, stageId, updateStreamingOutline, updateStreamingEpisodes]);

    // Debug log response changes
    useEffect(() => {
        console.log(`[useLLMStreamingWithStore] Response state changed:`, {
            status: response.status,
            itemCount: response.items?.length || 0,
            hasError: !!response.error,
            errorMessage: response.error?.message,
            transformId: transformId,
            dataType,
            projectId,
            stageId
        });
    }, [response.status, response.items?.length, response.error, transformId, dataType, projectId, stageId]);

    // Handle errors by converting them to a status
    useEffect(() => {
        if (!service) {
            console.log(`[useLLMStreamingWithStore] No service provided`);
            return;
        }

        console.log(`[useLLMStreamingWithStore] Setting up error subscription`);
        const subscription = service.response$.subscribe({
            error: (err) => {
                console.error(`[useLLMStreamingWithStore] Response stream error:`, err);
                if (projectId) {
                    stopStreaming(projectId);
                }
            }
        });

        return () => {
            console.log(`[useLLMStreamingWithStore] Cleaning up error subscription`);
            subscription.unsubscribe();
        };
    }, [service, projectId, stopStreaming]);

    // Auto-connect when transformId changes
    useEffect(() => {
        console.log(`[useLLMStreamingWithStore] Auto-connect effect triggered:`, {
            hasService: !!service,
            transformId,
            currentTransformId: currentTransformIdRef.current,
            shouldConnect: !!(service && transformId && transformId !== currentTransformIdRef.current)
        });

        if (!service || !transformId || transformId === currentTransformIdRef.current) {
            return;
        }

        currentTransformIdRef.current = transformId;
        console.log(`[useLLMStreamingWithStore] Connecting to transform ${transformId}`);

        // Connect to the transform stream
        service.connectToTransform(transformId).catch((error) => {
            console.error(`[useLLMStreamingWithStore] Connection error:`, error);
            if (projectId) {
                stopStreaming(projectId);
            }
        });

        return () => {
            if (currentTransformIdRef.current === transformId) {
                console.log(`[useLLMStreamingWithStore] Cleaning up connection for transform ${transformId}`);
                currentTransformIdRef.current = undefined;
            }
        };
    }, [transformId, service, projectId, stopStreaming]);

    return {
        ...response,
        reasoningEvent,
        stop: () => {
            console.log(`[useLLMStreamingWithStore] Stop called for transform ${transformId}`);
            service?.stop();
            if (projectId) {
                stopStreaming(projectId);
            }
        }
    };
}

/**
 * Transform streaming outline data to match the OutlineSessionData components format
 */
function transformToOutlineComponents(item: any): Partial<OutlineSessionData['components']> {
    const components: Partial<OutlineSessionData['components']> = {};

    // Map common fields
    if (item.title) components.title = item.title;
    if (item.genre) components.genre = item.genre;
    if (item.target_audience) components.target_audience = item.target_audience;
    if (item.setting) {
        components.setting = typeof item.setting === 'string' 
            ? item.setting 
            : item.setting?.core_setting_summary;
    }
    if (item.synopsis) components.synopsis = item.synopsis;
    if (item.characters) components.characters = item.characters;
    
    // Handle selling points
    if (item.selling_points) {
        components.selling_points = Array.isArray(item.selling_points)
            ? item.selling_points.join('\n')
            : item.selling_points;
    }
    
    // Handle satisfaction points
    if (item.satisfaction_points) {
        components.satisfaction_points = item.satisfaction_points;
    }

    // Handle synopsis stages
    if (item.synopsis_stages) {
        components.synopsis_stages = item.synopsis_stages;
    }

    return components;
} 