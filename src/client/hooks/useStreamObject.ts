import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';

interface UseStreamObjectOptions {
    schema: z.ZodType<any>;
    endpoint: string;
    body?: Record<string, any>;
    onComplete?: (object: any) => void;
    onError?: (error: Error) => void;
}

interface StreamObjectResult<T> {
    object: T | undefined;
    isLoading: boolean;
    error: Error | null;
    submit: (inputBody?: Record<string, any>) => Promise<void>;
    stop: () => void;
    isStreaming: boolean;
}

export function useStreamObject<T>({
    schema,
    endpoint,
    body: initialBody,
    onComplete,
    onError
}: UseStreamObjectOptions): StreamObjectResult<T> {
    const {
        object,
        submit: originalSubmit,
        isLoading,
        error,
        stop
    } = useObject({
        api: endpoint,
        schema,
        onFinish: onComplete,
        onError
    });

    const [isStreaming, setIsStreaming] = useState(false);

    // Track streaming state
    useEffect(() => {
        setIsStreaming(isLoading);
    }, [isLoading]);

    // Wrapper submit function that includes body
    const submit = useCallback(async (inputBody?: Record<string, any>) => {
        const requestBody = inputBody || initialBody || {};
        await originalSubmit(requestBody);
    }, [originalSubmit, initialBody]);

    return {
        object: object as T,
        isLoading,
        error: error || null,
        submit,
        stop,
        isStreaming
    };
}

// Specific schemas for common use cases
export const BrainstormingSchema = z.array(
    z.object({
        title: z.string(),
        body: z.string()
    })
);

export const OutlineSchema = z.object({
    title: z.string(),
    genre: z.string(),
    selling_points: z.array(z.string()),
    satisfaction_points: z.array(z.string()),
    characters: z.array(
        z.object({
            name: z.string(),
            type: z.enum([
                'male_lead',
                'female_lead',
                'male_second',
                'female_second',
                'male_supporting',
                'female_supporting',
                'antagonist',
                'other'
            ]),
            description: z.string()
        })
    ),
    synopsis_stages: z.array(
        z.object({
            stageSynopsis: z.string(),
            numberOfEpisodes: z.number()
        })
    )
});

export const EpisodeArraySchema = z.array(
    z.object({
        episodeNumber: z.number(),
        title: z.string(),
        synopsis: z.string().optional(),
        briefSummary: z.string().optional(),
        keyEvents: z.array(z.string()),
        endHook: z.string().optional()
    })
);

export const ScriptSchema = z.object({
    episodeNumber: z.number(),
    title: z.string(),
    scriptContent: z.string(),
    wordCount: z.number().optional(),
    estimatedDuration: z.number().optional()
});

// Convenience hooks for specific use cases
export function useBrainstormingStream(onComplete?: (ideas: Array<{ title: string, body: string }>) => void) {
    return useStreamObject({
        schema: BrainstormingSchema,
        endpoint: '/api/brainstorm/generate/stream',
        onComplete
    });
}

export function useOutlineStream(onComplete?: (outline: any) => void) {
    return useStreamObject({
        schema: OutlineSchema,
        endpoint: '/api/outline/generate/stream',
        onComplete
    });
}

export function useEpisodeStream(onComplete?: (episodes: any[]) => void) {
    return useStreamObject({
        schema: EpisodeArraySchema,
        endpoint: '/api/episodes/generate/stream',
        onComplete
    });
}

export function useScriptStream(onComplete?: (script: any) => void) {
    return useStreamObject({
        schema: ScriptSchema,
        endpoint: '/api/scripts/generate/stream',
        onComplete
    });
} 