// Episode Planning Constants
export const EPISODE_PLANNING = {
    MIN_EPISODES: 1,
    MAX_EPISODES: 200,
    DEFAULT_EPISODES: 80
} as const;

// Export individual constants for convenience
export const {
    MIN_EPISODES,
    MAX_EPISODES,
    DEFAULT_EPISODES
} = EPISODE_PLANNING; 