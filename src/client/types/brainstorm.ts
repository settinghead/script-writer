// Re-export the common IdeaWithTitle interface
export { IdeaWithTitle } from '../../common/types';

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