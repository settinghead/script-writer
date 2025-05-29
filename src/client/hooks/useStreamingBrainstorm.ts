import { useMemo, useEffect, useState } from 'react';
import { useLLMStreaming } from './useLLMStreaming';
import { BrainstormingStreamingService, IdeaWithTitle } from '../services/implementations/BrainstormingStreamingService';

export function useStreamingBrainstorm(transformId?: string) {
    const service = useMemo(() => {
        return new BrainstormingStreamingService({
            debounceMs: 16, // Smooth streaming at ~60fps
            completionTimeoutMs: 2000
        });
    }, []);

    const streamingResult = useLLMStreaming(service, { transformId });
    const [itemsWithArtifactIds, setItemsWithArtifactIds] = useState<IdeaWithTitle[]>([]);

    // When streaming completes, fetch the real artifact IDs
    useEffect(() => {
        if (streamingResult.status === 'completed' && transformId && service) {
            // Fetch real artifact IDs from the server
            service.fetchArtifactIds(transformId).then(idMap => {
                // Update items with real artifact IDs
                const updatedItems = streamingResult.items.map(item => {
                    const artifactId = idMap.get(item.body);
                    return {
                        ...item,
                        artifactId: artifactId || item.artifactId
                    };
                });
                setItemsWithArtifactIds(updatedItems);
            });
        } else if (streamingResult.status === 'streaming') {
            // During streaming, use items without artifact IDs
            setItemsWithArtifactIds(streamingResult.items);
        }
    }, [streamingResult.status, streamingResult.items, transformId, service]);

    return {
        ...streamingResult,
        items: itemsWithArtifactIds.length > 0 ? itemsWithArtifactIds : streamingResult.items
    };
} 