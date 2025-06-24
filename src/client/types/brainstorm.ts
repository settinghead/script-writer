export interface IdeaWithTitle {
  title: string
  body: string
  artifactId?: string
  originalArtifactId?: string  // For lineage resolution - the original artifact ID for transform lookup
  index?: number  // For consistent ordering
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