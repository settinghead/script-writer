export interface IdeaWithTitle {
  title: string
  body: string
  artifactId?: string
  originalArtifactId?: string  // For lineage resolution - the original artifact ID for transform lookup
  artifactPath: string        // NEW: JSONPath within collection artifacts (e.g., '$.ideas[0]', '$' for root)
  index?: number  // For consistent ordering
  debugInfo?: string; // DEBUG: Add debug info property
}

export interface BrainstormParams {
  genre: string
  theme: string
  character_setting: string
  plot_device: string
  ending_type: string
  length: string
  platform: string
  additional_requirements?: string
} 