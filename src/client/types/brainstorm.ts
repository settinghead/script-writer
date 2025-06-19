export interface IdeaWithTitle {
  title: string
  body: string
  artifactId?: string
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