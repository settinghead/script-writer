// Auto-generated TypeScript interfaces for extracted DSPy prompts
// Generated at: 2025-06-18T13:45:07.360828

export interface ExtractedPrompt {
  system_user_prompt?: string;
  messages_format?: Array<{role: string, content: string}>;
  last_full_prompt?: string;
  last_messages?: Array<{role: string, content: string}>;
  template_structure?: string;
}

export interface DemoData {
  genre?: string;
  platform?: string;
  requirements_section?: string;
  title?: string;
  body?: string;
}

export interface ExtractedDemo {
  demo_index: number;
  data: DemoData;
}

export interface ModuleMetadata {
  signature_instructions?: string;
  input_fields?: string[];
  output_fields?: string[];
}

export interface ExtractedModuleData {
  extracted_at?: string;
  module_type?: string;
  prompts: ExtractedPrompt;
  demos: ExtractedDemo[];
  metadata: ModuleMetadata;
  error?: string;
}

export interface AllPromptsData {
  extraction_info: {
    extracted_at: string;
    baseline_available: boolean;
    mlflow_optimized_available: boolean;
    prompts_file_optimized_available: boolean;
  };
  baseline: ExtractedModuleData;
  optimized_mlflow: ExtractedModuleData;
  optimized_prompts_file: ExtractedModuleData;
}

// Usage example:
// import promptsData from './all_prompts_for_typescript.json';
// const data: AllPromptsData = promptsData;
// 
// // Get the best available optimized prompt
// const getBestPrompt = (): ExtractedPrompt => {
//   if (data.extraction_info.mlflow_optimized_available && data.optimized_mlflow.prompts) {
//     return data.optimized_mlflow.prompts;
//   }
//   if (data.extraction_info.prompts_file_optimized_available && data.optimized_prompts_file.prompts) {
//     return data.optimized_prompts_file.prompts;
//   }
//   return data.baseline.prompts;
// };
