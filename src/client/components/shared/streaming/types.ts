export interface FieldUpdate {
  type: 'new-field' | 'update-field';
  path: string;
  value: any;
}

export interface FieldProps {
  value: any;
  path: string;
  onEdit?: (newValue: any) => void;
}

export interface FieldDefinition {
  path: string;                         // JSON path pattern (e.g., "title", "characters[*].name")
  component: React.ComponentType<FieldProps>; // React component to render
  label?: string;                      // Display label
  containerType?: 'card' | 'section' | 'none'; // How to wrap the field
  extractKey?: (data: any) => string; // For arrays, extract unique key
  group?: string;                      // Optional grouping for organization
  order?: number;                      // Optional ordering within groups
  layout?: {                           // Layout configuration
    columns?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number }; // Grid columns
    compact?: boolean;                 // Use compact display
    orientation?: 'horizontal' | 'vertical'; // Field orientation
    maxItems?: number;                 // Max items to show (for arrays)
  };
}

export interface RenderedField {
  id: string;
  path: string;
  definition: FieldDefinition;
  value: any;
  groupKey?: string; // For array items, the parent path
}

export interface DynamicStreamingUIProps {
  fieldRegistry: FieldDefinition[];
  transformId?: string;
  onFieldEdit?: (path: string, value: any) => void;
  data?: any; // Initial/static data
  streamingData?: any[]; // Current streaming items
  streamingStatus?: 'idle' | 'streaming' | 'completed' | 'error';
  isThinking?: boolean; // Whether the AI is in thinking mode
  onStopStreaming?: () => void;
  className?: string;
}

// JSON path utilities
export interface PathMatch {
  definition: FieldDefinition;
  actualPath: string;
  wildcardValues: { [key: string]: string | number };
} 