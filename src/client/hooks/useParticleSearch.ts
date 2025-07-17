import { useState, useCallback } from 'react';
import { apiService } from '../services/apiService';

export interface ParticleSearchResult {
    id: string;
    title: string;
    type: string;
    content_preview: string;
    jsondoc_id: string;
    path: string;
    similarity?: number;
    created_at?: string;
    updated_at?: string;
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

// Hook for listing all particles in a project
export interface UseParticleListOptions {
    projectId: string;
    limit?: number;
}

export interface UseParticleListReturn {
    particles: ParticleSearchResult[];
    loading: boolean;
    error: string | null;
    fetchParticles: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useParticleList(options: UseParticleListOptions): UseParticleListReturn {
    const { projectId, limit = 100 } = options;
    const [particles, setParticles] = useState<ParticleSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchParticles = useCallback(async () => {
        console.log('[useParticleList] Starting fetch for project:', projectId);
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                projectId,
                limit: limit.toString()
            });

            const url = `/api/particles/list?${params.toString()}`;
            console.log('[useParticleList] Fetching from URL:', url);

            const response = await fetch(url);

            if (!response.ok) {
                console.error('[useParticleList] Response not OK:', response.status, response.statusText);
                throw new Error(`Failed to fetch particles: ${response.status}`);
            }

            const results = await response.json();
            console.log('[useParticleList] Received results:', results.length, 'particles');
            setParticles(results);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch particles';
            setError(errorMessage);
            console.error('[useParticleList] Fetch failed:', err);
            setParticles([]);
        } finally {
            setLoading(false);
        }
    }, [projectId, limit]);

    const refresh = useCallback(async () => {
        await fetchParticles();
    }, [fetchParticles]);

    return {
        particles,
        loading,
        error,
        fetchParticles,
        refresh
    };
}

