import { useState, useCallback } from 'react';
import { apiService } from '../services/apiService';

export interface ParticleSearchResult {
    id: string;
    title: string;
    type: string;
    content_preview: string;
    jsondoc_id: string;
    path: string;
}

export interface UseParticleSearchOptions {
    projectId: string;
    limit?: number;
    debounceMs?: number;
}

export interface UseParticleSearchReturn {
    particles: ParticleSearchResult[];
    loading: boolean;
    error: string | null;
    searchParticles: (query: string) => Promise<void>;
    clearResults: () => void;
}

export function useParticleSearch(options: UseParticleSearchOptions): UseParticleSearchReturn {
    const { projectId, limit = 10, debounceMs = 300 } = options;
    const [particles, setParticles] = useState<ParticleSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchParticles = useCallback(async (query: string) => {
        if (!query.trim()) {
            setParticles([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                query: query.trim(),
                projectId,
                limit: limit.toString()
            });

            const response = await fetch(`/api/particles/search?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const results = await response.json();
            setParticles(results);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Particle search failed';
            setError(errorMessage);
            console.error('[useParticleSearch] Search failed:', err);
            setParticles([]);
        } finally {
            setLoading(false);
        }
    }, [projectId, limit]);

    const clearResults = useCallback(() => {
        setParticles([]);
        setError(null);
    }, []);

    return {
        particles,
        loading,
        error,
        searchParticles,
        clearResults
    };
} 