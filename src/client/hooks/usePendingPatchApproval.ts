import { useState, useEffect } from 'react';
import type { ElectricJsondoc } from '../../common/types';

export interface PendingPatchItem {
    patchJsondoc: ElectricJsondoc;
    originalJsondoc: ElectricJsondoc;
    sourceTransformId: string;
    sourceTransformMetadata: any;
    patchIndex: number;
}

export interface PendingPatchApprovalState {
    patches: PendingPatchItem[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to detect pending patch approvals using the new API
 * 
 * This hook fetches all pending patches from the API and returns them in a flattened structure
 */
export function usePendingPatchApproval(projectId: string): PendingPatchApprovalState {
    const [patches, setPatches] = useState<PendingPatchItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!projectId) {
            setPatches([]);
            setIsLoading(false);
            return;
        }

        const fetchPendingPatches = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/patches/pending/${projectId}`, {
                    headers: {
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch pending patches: ${response.status}`);
                }

                const data = await response.json();
                setPatches(data.patches || []);

            } catch (fetchError) {
                console.error('[usePendingPatchApproval] Error fetching pending patches:', fetchError);
                setError(fetchError instanceof Error ? fetchError : new Error('Unknown error fetching pending patches'));
                setPatches([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPendingPatches();

        // Set up polling to check for new patches every 5 seconds
        const interval = setInterval(fetchPendingPatches, 5000);

        return () => {
            clearInterval(interval);
        };
    }, [projectId]);

    return {
        patches,
        isLoading,
        error
    };
} 