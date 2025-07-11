# 觅光助创

A collaborative Chinese short drama script writing application built on the [Transform Artifact Framework](./TRANSFORM_ARTIFACT_FRAMEWORK.md). Features AI-powered brainstorming, intelligent outline generation, and real-time collaboration for creating compelling short drama content.

## Overview

觅光助创 combines AI-powered content generation with sophisticated editing workflows specifically designed for Chinese short drama production. The application leverages the Transform Artifact Framework to provide intelligent agents, real-time collaboration, and complete content audit trails.

**Key Features**:
- **AI-Powered Script Creation** - From initial brainstorming to complete episode scripts
- **Chinese Short Drama Focus** - Specialized for 抖音, 快手, and other Chinese platforms
- **去脸谱化 Content** - Emphasizes modern, non-stereotypical characters and plots
- **Real-time Collaboration** - YJS-powered collaborative editing with conflict resolution
- **Complete Project Workflow** - 灵感 → 剧本框架 → 时间顺序大纲 → 分集 → 剧本 pipeline

## Application-Specific Features

### 🎭 Script Creation Pipeline

**Complete Workflow**: 灵感生成 → 剧本框架 → 时间顺序大纲 → 分集规划 → 剧本创作

**Brainstorming (灵感生成)**:
- **Platform-Specific Generation** - Optimized for 抖音, 快手, 小红书, etc.
- **Genre Specialization** - 现代甜宠, 古装甜宠, 复仇爽文, etc.
- **Configurable Idea Count** - Generate 1-4 ideas per request based on user preference
- **AI-Powered Editing** - "让这些故事更现代一些，加入一些科技元素"
- **Real-time Streaming** - Ideas appear as they're generated

**Outline Settings (剧本框架)**:
- **Character Development** - Normalized character types (male_lead, female_lead, etc.) with detailed backgrounds
- **Story Foundation** - Genre, target audience, platform settings, and commercial positioning
- **Setting & Context** - Time period, location, and social background for the story
- **Commercial Elements** - Selling points (卖点) and satisfaction points (爽点) for audience engagement
- **Seamless Integration** - "生成剧本框架" workflow from brainstorm to settings

**Chronicles (时间顺序大纲)**:
- **Chronological Structure** - Complete story timeline from earliest events to conclusion (story order, not broadcast order)
- **Episode Planning** - Staged progression with detailed synopsis for each story phase
- **Context-Aware Generation** - References outline settings for consistent character and world development
- **Sequential Workflow** - Generated after outline settings are established
- **Individual Stage Editing** - Granular editing of individual chronicle stages with full field support
- **Stage-Level Human Transforms** - Each stage can be independently edited while preserving the overall chronicles structure
- **Complete Field Editing** - All stage fields editable: title, synopsis, events, emotion arcs, relationship developments, insights

**Episode Generation (分集规划)**:
- **Agent-Based Generation** - Powered by Transform Artifact Framework
- **Context-Aware** - Maintains story consistency across episodes
- **User Feedback Integration** - Captures and utilizes episode-specific feedback

### 🤖 Intelligent Agent System

Built on the [Transform Artifact Framework](./TRANSFORM_ARTIFACT_FRAMEWORK.md) agent architecture:

**Available Tools**:
- ✅ **Brainstorm Generation** - Creates new story ideas with platform-specific optimization
- ✅ **Brainstorm Editing** - AI-powered content modification with context awareness
- ✅ **Outline Settings Generation** - Character development, story foundation, and commercial positioning
- ✅ **Chronicles Generation** - Chronological story timeline and episode progression
- ✅ **Episode Script Generation** - Agent-based generation with Electric SQL integration
- ✅ **Conversational Response** - General chat with project context

**Agent Capabilities**:
- **Dual-Mode Operation** - Automatically detects generation vs editing requests
- **Natural Language Interface** - ChatGPT-style conversation with bilingual support (English/Chinese)
- **Context Enrichment** - Maintains complete project context for AI operations
- **去脸谱化 Requirements** - Built-in emphasis on modern, non-stereotypical content

**Example Agent Interactions**:
```
User: "让这些故事更现代一些，加入一些科技元素"
↓
Agent Analysis: Detects edit request, enriches with context
↓
Tool Selection: Chooses BrainstormEditTool over BrainstormTool
↓
Context Preparation: Current ideas + platform requirements + user instructions
↓
LLM Transform: Generates improved versions with modern tech elements
↓
Artifact Creation: Creates new artifacts with proper lineage tracking
↓
UI Update: Real-time display with edit indicators
```

### 🎨 Script Writing UI

**Modern Chinese Interface**:
- **Dark Theme** - Optimized for long writing sessions
- **Chinese Localization** - Fully translated interface for Chinese creators
- **Responsive Design** - Works on desktop and mobile devices

**Advanced Editor Features**:
- **Dynamic Streaming UI** - Controls render eagerly as content arrives
- **Interactive Workflow Visualization** - Real-time project progress navigation
- **Dual-Mode Project Navigation** - Visual workflow + hierarchical tree views
- **Optimistic State Management** - Electric SQL write patterns with concurrent edit handling
- **Smart Auto-Save System** - Advanced debouncing with edit preservation during saves
- **Edit History Visualization** - Visual indicators (📝 已编辑版本) for modified content
- **Unified Section Management** - `SectionWrapper` component for consistent section rendering with automatic status detection

**Chat Interface with Assistant-UI Integration**:
- **Auto-Scroll Functionality** - Smart auto-scroll to bottom when new messages arrive, with user control preservation
- **Modern Message Layout** - Card-based messages with user/assistant avatars and proper alignment
- **Scroll Position Tracking** - Monitors user scroll position with floating scroll-to-bottom button
- **Chinese Localization** - Complete interface in Chinese (觅光智能体)
- **Real-time Streaming** - Maintains Electric SQL streaming with smooth loading animations
- **Keyboard Shortcuts** - Enter to send, Shift+Enter for new lines
- **Performance Optimized** - Efficient scroll tracking without performance impact

### 🎯 Script Writing Workflow

觅光助创 implements a sophisticated dual-path workflow system specifically designed for Chinese short drama creation, with intelligent action management that guides users through the complete script development process.

## Unified Display and Action Computation System

The application features a centralized, data-driven approach to UI rendering and workflow management that replaces scattered component logic with a unified computation system.

### Core Architecture

**Unified Workflow State**:
The system computes four essential elements for every workflow state:
- **Steps** - Workflow progress with proper states (normal, loading, error)
- **Display Components** - What components to render and in what modes
- **Actions** - Available workflow actions based on current state
- **Parameters** - Context data for components and actions

**Type-Safe Component Management**:
```typescript
// Named component IDs for switch-case reference
type ComponentId = 
  | 'project-creation-form'
  | 'brainstorm-input-editor' 
  | 'project-brainstorm-page'
  | 'single-brainstorm-idea-editor'
  | 'outline-settings-display'
  | 'chronicles-display';

// Discriminated union modes (no optional parameters)
type ComponentMode = 
  | { type: 'hidden' }
  | { type: 'readonly' }
  | { type: 'editable' }
  | { type: 'collapsed' }
  | { type: 'loading' }
  | { type: 'error'; message: string };
```

**Workflow Steps Integration**:
- **Ant Design Steps Component** - Replaces existing spinners throughout the application
- **Dark Theme Styling** - Consistent with application theme
- **Proper Status Handling** - Wait, process, finish, error states
- **Stage-Based Progress** - Visual workflow progression indicators

### Component Registry System

**Centralized Component Management**:
```typescript
// Component registry with type safety
export const componentRegistry: Record<ComponentId, React.ComponentType<any>> = {
  'project-creation-form': ProjectCreationForm,
  'brainstorm-input-editor': BrainstormInputEditor,
  'project-brainstorm-page': ProjectBrainstormPage,
  'single-brainstorm-idea-editor': SingleBrainstormIdeaEditor,
  'outline-settings-display': OutlineSettingsDisplay,
  'chronicles-display': ChroniclesDisplay
};

// Type-safe component resolution
export function getComponent(id: ComponentId): React.ComponentType<any> {
  const Component = componentRegistry[id];
  if (!Component) {
    throw new Error(`Component not found: ${id}`);
  }
  return Component;
}
```

### Unified Display Renderer

**Automatic Component Rendering**:
```typescript
export const UnifiedDisplayRenderer: React.FC<{
  displayComponents: DisplayComponent[]
}> = ({ displayComponents }) => {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {displayComponents.map((displayComponent) => {
        const Component = displayComponent.component;
        
        // Skip hidden components
        if (displayComponent.mode === 'hidden') {
          return null;
        }
        
        return (
          <div key={displayComponent.id}>
            <Component {...displayComponent.props} />
          </div>
        );
      })}
    </Space>
  );
};
```

### Enhanced Action Computation

**Unified State Computation**:
```typescript
export function computeUnifiedWorkflowState(
  projectData: ProjectData, 
  projectId: string
): UnifiedWorkflowState {
  // Get base computation from existing system
  const baseResult = computeParamsAndActionsFromLineage(projectData);
  
  return {
    steps: computeWorkflowSteps(baseResult.currentStage, baseResult.hasActiveTransforms),
    displayComponents: computeDisplayComponents(projectData, baseResult),
    actions: baseResult.actions,
    parameters: computeWorkflowParameters(projectData, baseResult)
  };
}
```

**Component Mode Logic**:
- **hasActiveTransforms** determines readonly vs editable modes
- **Priority-based ordering** (1, 2, 3...) for consistent component sequence
- **Artifact existence** determines component visibility
- **Stage progression** determines which components show

### Integration Benefits

**Centralized Logic**:
- **Single Source of Truth** - All display logic computed in one place
- **Consistent Behavior** - Same logic across all workflow states
- **Easy Testing** - Pre-computed props enable comprehensive testing
- **Performance Optimized** - Efficient computation with minimal re-renders

**Developer Experience**:
- **Type Safety** - Strong TypeScript types prevent runtime errors
- **Maintainability** - Changes to workflow logic happen in one place
- **Debuggability** - Clear component hierarchy and state computation
- **Extensibility** - Easy to add new components and workflow states

**User Experience**:
- **Consistent UI** - Uniform component behavior across all stages
- **Clear Progress** - Visual workflow steps show current position
- **Intuitive Flow** - Components appear/disappear based on workflow logic
- **Responsive Design** - Ant Design components with proper spacing

### Technical Implementation

**Files Created/Modified**:
- `src/client/utils/workflowTypes.ts` - Type definitions for unified system
- `src/client/utils/componentRegistry.ts` - Centralized component mapping
- `src/client/components/WorkflowSteps.tsx` - Ant Design steps component
- `src/client/components/UnifiedDisplayRenderer.tsx` - Automatic component rendering
- `src/client/utils/actionComputation.ts` - Enhanced with unified computation
- `src/client/components/ProjectLayout.tsx` - Integrated unified renderer

**Testing Coverage**:
- **16 new tests** for unified workflow computation
- **All existing tests pass** (78 total tests)
- **Comprehensive scenarios** covering all workflow states
- **Edge case handling** for malformed data and error states

This unified system provides a solid foundation for the Chinese short drama script-writer application's workflow management, ensuring consistent behavior and easy maintenance as the application grows.

## Dual-Path Workflow System

The application supports two distinct paths for script creation, each optimized for different creative approaches:

### Path 1: Manual Entry Path (手动输入路径)
**User Flow**: Manual idea entry → Edit → Generate outline settings → Generate chronicles → Generate episodes → Generate scripts

**Stages**:
1. **手动创意输入 (Manual Idea Entry)** - User manually enters a single story concept
2. **创意编辑 (Idea Editing)** - Refine and develop the manually entered idea
3. **剧本框架生成 (Outline Settings Generation)** - Generate characters, setting, and commercial elements
4. **时间顺序大纲生成 (Chronicles Generation)** - Create chronological story progression
5. **分集规划 (Episode Planning)** - Break story into episode structure
6. **剧本创作 (Script Writing)** - Generate detailed scripts with dialogue

**Key Features**:
- **Direct Control** - Users have full control over the initial story concept
- **Immediate Editing** - Single ideas automatically proceed to editing stage
- **Streamlined Flow** - No selection step required, faster progression

### Path 2: AI Brainstorm Path (AI头脑风暴路径)
**User Flow**: Brainstorm input → AI generates multiple ideas → Select best idea → Edit → Generate outline settings → Generate chronicles → Generate episodes → Generate scripts

**Stages**:
1. **头脑风暴输入 (Brainstorm Input)** - User provides creative brief and requirements
2. **AI创意生成 (AI Idea Generation)** - AI generates multiple story concepts based on input
3. **创意选择 (Idea Selection)** - User selects the most promising idea from AI-generated options
4. **创意编辑 (Idea Editing)** - Refine and develop the selected idea
5. **剧本框架生成 (Outline Settings Generation)** - Generate characters, setting, and commercial elements
6. **时间顺序大纲生成 (Chronicles Generation)** - Create chronological story progression
7. **分集规划 (Episode Planning)** - Break story into episode structure
8. **剧本创作 (Script Writing)** - Generate detailed scripts with dialogue

**Key Features**:
- **AI-Powered Ideation** - Multiple creative options generated automatically
- **Choice and Comparison** - Users can compare different story directions
- **Platform-Specific Optimization** - AI considers platform requirements (抖音, 快手, 小红书)

## Advanced Action Computation System

觅光助创 uses a sophisticated dual-computation system for intelligent workflow management:

### Lineage-Based Action Computation (Primary)
**Modern Approach**: Uses artifact lineage graphs to determine current workflow state and available actions.

**Key Features**:
- **Artifact Lineage Analysis** - Traces relationships between all project artifacts
- **Workflow Node Detection** - Automatically identifies current position in workflow
- **Smart Path Resolution** - Finds the main workflow path through complex artifact relationships
- **Auto-Selection Logic** - Automatically treats single effective ideas as "chosen" for streamlined progression

**Technical Implementation**:
```typescript
// Lineage-based computation flow
const lineageGraph = buildLineageGraph(artifacts, transforms, ...);
const workflowNodes = findMainWorkflowPath(artifacts, lineageGraph);
const currentStage = detectStageFromWorkflowNodes(workflowNodes);
const actions = computeActionsFromLineage(currentStage, context);
```


### Workflow Stage Detection

**Supported Stages**:
- `initial` - Empty project, show creation options
- `brainstorm_input` - Brainstorm input created, ready for AI generation
- `brainstorm_selection` - Multiple AI ideas generated, user must select one
- `idea_editing` - Single idea available (manual or selected), ready for editing
- `outline_generation` - Idea finalized, ready for outline settings generation
- `chronicles_generation` - Outline settings complete, ready for chronicles
- `episode_generation` - Chronicles complete, ready for episode planning

**Smart Action Generation**:
- **Context-Aware Actions** - Only shows relevant next steps based on current stage
- **Prerequisite Validation** - Ensures all required artifacts exist before enabling actions
- **Active Transform Handling** - Disables actions during streaming/processing states
- **Priority Ordering** - Actions displayed in logical workflow order

**Dual-Path Support**:
- **Manual Entry Detection** - Automatically identifies single `brainstorm_idea` with `user_input` origin
- **AI Collection Handling** - Recognizes `brainstorm_collection` from AI generation
- **Workflow Node Mapping** - Creates appropriate workflow nodes for each path type
- **Stage Progression Logic** - Handles different progression patterns for each path

### Error Handling and Resilience

**Robust Computation**:
- **Graceful Degradation** - Falls back to legacy computation when lineage analysis fails
- **Data Validation** - Validates artifact structure before processing
- **Edge Case Handling** - Handles malformed data, missing artifacts, and concurrent edits
- **Debug Logging** - Comprehensive logging for troubleshooting workflow issues

**Production Reliability**:
- **Comprehensive Testing** - 30+ test scenarios covering all workflow combinations
- **Real-World Data Patterns** - Tests based on actual production database patterns
- **Performance Optimization** - Efficient computation with minimal database queries
- **Consistent User Experience** - Seamless switching between computation methods

This dual-computation system ensures that users always see the correct workflow actions regardless of system state, while providing the most advanced lineage-based computation when available.

### 📊 Content Management

**Project-Based Organization**:
- **Project Hierarchy** - Project → Episodes → Scripts structure
- **Artifact Lineage** - Complete audit trail of all content modifications
- **Version Control** - Edit history with "always edit latest" principle
- **Collaborative Editing** - YJS-powered real-time collaborative editing with conflict resolution

**Content Types**:
- **Brainstorm Ideas** - Initial story concepts with platform targeting
- **Outline Settings** - Character development, story foundation, and commercial elements
- **Chronicles** - Chronological story timeline and staged progression
- **Episode Synopses** - Individual episode breakdowns
- **Script Content** - Full dialogue and scene descriptions

## Real-time Collaboration with YJS

觅光助创 supports real-time collaborative editing powered by YJS (Yjs) + Electric SQL:

### Collaboration Features
- **Live Collaborative Editing** - Multiple users can edit artifacts simultaneously
- **Conflict-Free Synchronization** - CRDT-based conflict resolution
- **Optimistic Updates** - Immediate UI feedback with automatic conflict resolution
- **Path-Based Field Access** - Edit any nested field using JSON paths
- **Context-Based Architecture** - Unified state management for all YJS operations

### YJS Integration Architecture

**Hybrid Approach**:
- **YJS Documents** - CRDT-based collaborative data structures for real-time editing
- **Electric SQL Sync** - Persistent storage with real-time updates
- **Transform Framework** - YJS for editing, Electric SQL for audit trails
- **Conflict Resolution** - Automatic merge with user edit priority

### Usage Examples

**Context-Based Editing**:
```typescript
// Enable YJS for artifact editing
<YJSArtifactProvider artifactId={artifactId}>
  <YJSTextField path="title" placeholder="输入标题..." />
  <YJSArrayField path="themes" placeholder="每行一个主题..." />
  <YJSTextField path="characters.male_lead.name" placeholder="男主姓名..." />
</YJSArtifactProvider>
```

**YJS Hook Usage**:
```typescript
// Access YJS document directly
const { doc, provider, isConnected } = useYJSArtifact(artifactId);

// Edit text collaboratively
const yText = doc.getText('content');
yText.insert(0, 'Hello collaborative world!');
```

### Implemented YJS Components

**Completed Migrations**:
- ✅ **BrainstormInputEditor** - Requirements input with YJS textarea field
- ✅ **SingleBrainstormIdeaEditor** - Idea editing with YJS title/body fields  
- ✅ **OutlineSettingsDisplay** - Complex nested editing with character management
- 🚧 **ChronicleStageCard** - Stage descriptions (in progress)

**YJS Field Components**:
- **YJSTextField** - Click-to-edit text input with debounced auto-save
- **YJSTextAreaField** - Multi-line text editing with auto-sizing
- **YJSArrayField** - Array editing with textarea (one item per line)
- **Keyboard shortcuts** - Enter to save, Escape to cancel
- **Visual feedback** - Hover states, loading indicators, collaborative mode indicators

### Benefits Achieved

**Real-time Collaboration**:
- Multiple users can edit brainstorm requirements, story ideas, and outline settings simultaneously
- Immediate visual feedback during collaboration
- Automatic conflict resolution without user intervention

**Code Reduction**:
- ~500+ lines of complex state management code removed
- Eliminated debounced saves, field-level change handlers, and complex path management
- Simplified component architecture with path-based field access

**User Experience**:
- Maintained all existing UI states and interactions while adding collaborative features
- Advanced features like complex nested object editing and dynamic array management
- Rich read-only displays with conditional sections

## Technical Architecture

### Framework Foundation
觅光助创 is built on the **Transform Artifact Framework**. For detailed technical documentation, see [TRANSFORM_ARTIFACT_FRAMEWORK.md](./TRANSFORM_ARTIFACT_FRAMEWORK.md).

**Key Framework Benefits**:
- **Immutable Content History** - All edits tracked with complete lineage
- **Real-time Synchronization** - Electric SQL for instant collaboration
- **Type-Safe Operations** - Zod validation throughout the system
- **Advanced Caching** - Development-optimized streaming response caching

### Script-Writer Transform Usage

觅光助创 leverages the Transform Artifact Framework's dual-mode execution system with TypedArtifact validation for optimal content creation and editing workflows:

**Content Generation (Full-Object Mode)**:
- **Story Brainstorming** - Generate complete collections of story ideas
- **Outline Settings** - Create comprehensive character and story foundations  
- **Chronicles Creation** - Produce complete chronological timelines
- **Episode Generation** - Generate detailed episode structures

**Content Editing (Patch Mode)**:
- **Story Refinement** - Make targeted improvements to existing ideas
- **Character Adjustments** - Modify specific character details
- **Plot Modifications** - Update story elements while preserving structure
- **User-Guided Improvements** - Apply specific user feedback efficiently

**Chinese Short Drama Optimization**:
- **Platform-Specific Templates** - Optimized prompts for 抖音, 快手, 小红书
- **去脸谱化 Requirements** - Built-in anti-stereotyping in all generation modes
- **Genre-Specific Patterns** - Specialized templates for 甜宠, 复仇, 霸总 content
- **Efficient Iteration** - Patch mode enables rapid content refinement

### Application Architecture

**Frontend (React 19 + TypeScript)**:
- **TanStack Query** - Server state management with intelligent caching
- **Zustand** - Global client state for UI interactions
- **Electric SQL React hooks** - Real-time data synchronization
- **YJS Integration** - Real-time collaborative editing with context-based architecture
- **Ant Design** - Component library with dark theme throughout
- **SectionWrapper Architecture** - Unified section management with automatic status detection

**Backend (Express.js + TypeScript)**:
- **Agent Service** - Central orchestration with tool selection
- **Streaming Framework** - Unified pattern for all AI tools
- **Template System** - Chinese short drama specific prompts
- **Electric SQL Proxy** - Authenticated real-time data access
- **YJS Service** - Document creation, persistence, and artifact conversion

**Database (PostgreSQL + Electric SQL)**:
- **Project-Based Access Control** - All content scoped to projects
- **TypedArtifact System** - Immutable content with schema_type and origin_type fields
- **ArtifactSchemaRegistry** - Centralized Zod validation for all artifact types
- **Transform Tracking** - Complete audit trail of all modifications
- **YJS Tables** - Real-time collaborative document storage and updates

### Script Writing UI Components

觅光助创 uses specialized UI components designed for Chinese short drama script creation, built on the Transform Artifact Framework's editing capabilities.

**Unified Section Management**:
- **SectionWrapper** - Consistent section rendering with automatic status detection for all content areas
- **Automatic Artifact Resolution** - Finds latest versions in editing chains (AI-generated → human-edited)
- **Smart Status Detection** - Loading/failed/normal states based on transform status
- **Visual Indicators** - Clear feedback for editing states and completion status

**Specialized Editing Components**:
- **BrainstormIdeaEditor** - Multi-idea editing with TypedArtifact validation
- **OutlineSettingsDisplay** - Character development using ArtifactSchemaRegistry
- **ChroniclesDisplay** - Chronological story timeline with schema-validated editing
- **ChronicleStageCard** - Individual stage editing with typed field validation

**Content-Specific Features**:
- **Chinese Text Optimization** - Proper handling of Chinese character input and display
- **Platform-Aware Forms** - Input validation for different social media platforms
- **Genre-Specific Templates** - Pre-configured forms for different drama types
- **Auto-Save System** - Debounced saving with edit preservation during rapid typing

### Script-Specific Schemas

**Brainstorm Schema**:
```typescript
export const ArtifactSchemaRegistry = {
  'brainstorm_collection': z.object({
    ideas: z.array(IdeaSchema),
    platform: z.string(),
    genre: z.string(),
    total_ideas: z.number()
  }),
  'brainstorm_idea': IdeaSchema
} as const;

export const IdeaSchema = z.object({
  title: z.string(),
  body: z.string(),
  artifactId: z.string().optional()
});
```

**Outline Settings Schema**:
```typescript
export const ArtifactSchemaRegistry = {
  'outline_settings': OutlineSettingsOutputSchema,
  'outline_settings_input': OutlineSettingsInputSchema,
  // ... other schemas
} as const;

export const OutlineSettingsOutputSchema = z.object({
  title: z.string(),
  genre: z.string(),
  target_audience: z.string(),
  platform: z.string(),
  selling_points: z.array(z.string()),     // 卖点
  satisfaction_points: z.array(z.string()), // 爽点
  setting: z.object({
    time_period: z.string(),
    location: z.string(),
    social_context: z.string()
  }),
  characters: z.array(CharacterSchema)
});

export const CharacterSchema = z.object({
  name: z.string(),
  type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 
                'male_supporting', 'female_supporting', 'antagonist', 'other']),
  description: z.string(),
  age: z.string(),
  gender: z.string(),
  occupation: z.string(),
  personality_traits: z.array(z.string()),
  character_arc: z.string(),
  relationships: z.record(z.string(), z.string()),
  key_scenes: z.array(z.string())
});
```

**Chronicles Schema**:
```typescript
export const ArtifactSchemaRegistry = {
  'chronicles': ChroniclesOutputSchema,
  'chronicles_input': ChroniclesInputSchema,
  // ... other schemas
} as const;

export const ChroniclesOutputSchema = z.object({
  synopsis_stages: z.array(z.string())     // Chronological story progression
});
```

### Chronicles Stage Editing System

The application implements a sophisticated individual stage editing system for Chronicles, allowing granular modification of story progression while maintaining the overall narrative structure.

**Chronicle Stage Schema**:
```typescript
export const ChroniclesStageSchema = z.object({
  title: z.string(),
  stageSynopsis: z.string(),
  event: z.string(),
  emotionArcs: z.array(z.object({
    characters: z.array(z.string()),
    content: z.string()
  })),
  relationshipDevelopments: z.array(z.object({
    characters: z.array(z.string()),
    content: z.string()
  })),
  insights: z.array(z.string())
});

// Used in ArtifactSchemaRegistry for validation
export type ChroniclesStage = z.infer<typeof ChroniclesStageSchema>;
```

**Whole-Document Editing**:
- **Complete Chronicles Editing** - Chronicles are edited as complete documents using the ArtifactDisplayWrapper pattern
- **Click-to-Edit Interface** - Clicking on any chronicle section enters whole-document editing mode
- **YJS-Powered Collaboration** - Real-time collaborative editing with automatic conflict resolution
- **Comprehensive Field Access** - All chronicle fields (stages, titles, synopses, etc.) available in single editing session

**UI Features**:
- **Unified Editing Interface** - Single form for editing all chronicle content
- **Stage Management** - Add, remove, and reorder stages within the unified editor
- **Rich Field Support** - Full editing capabilities for all chronicle fields:
  - Stage titles and synopses
  - Event descriptions  
  - Emotion arcs and relationship developments
  - Story insights and character development
- **Visual Consistency** - Consistent with other artifact editing patterns in the application

**Technical Implementation**:
```typescript
// Whole-document editing with ArtifactDisplayWrapper
<ArtifactDisplayWrapper
  artifact={chroniclesArtifact}
  isEditable={isEditable}
  title="时间顺序大纲"
  readOnlyComponent={ReadOnlyArtifactDisplay}
  editableComponent={EditableChroniclesForm}
/>

// YJS-based field editing
const { value: stages, updateValue: setStages } = useYJSField<any[]>('stages');
```

**Benefits**:
- **Simplified Workflow** - Single editing session for entire chronicle
- **Better Collaboration** - Real-time editing with multiple users
- **Consistent UX** - Matches other artifact editing patterns
- **Reduced Complexity** - No need to manage individual stage artifacts
- **Improved Performance** - Fewer database operations and transform chains

## Chinese Short Drama UI/UX Principles

Based on our implementation experience, the following UI/UX principles have emerged for Chinese short drama script creation applications:

### 1. **Hierarchical Content Organization**
**Principle**: Organize content in clear parent-child relationships that mirror the creative workflow.

**Implementation**:
- **Project → Collections → Individual Items** - Clear hierarchy with independent editing capabilities
- **Chronicles → Stages → Fields** - Nested structure allowing granular modifications
- **Visual Hierarchy** - Use cards, borders, and spacing to show relationships

**Benefits**:
- Users understand where they are in the creative process
- Easy to navigate between different levels of detail
- Maintains context while allowing focused editing

### 2. **Click-to-Edit Interaction Pattern**
**Principle**: Make the entire interface element clickable to enter edit mode, not just buttons.

**Implementation**:
- **Entire Stage Cards** - Clicking anywhere on a read-only stage creates an editable version
- **Collection Items** - Clicking on any story idea enters editing mode
- **Visual Feedback** - Clear hover states and click affordances

**Benefits**:
- More intuitive than hunting for small edit buttons
- Faster workflow for content creators
- Reduces cognitive load - entire areas are interactive

### 3. **Smart Array Field Editing**
**Principle**: Automatically detect string arrays and provide textarea-based editing instead of individual input fields.

**Implementation**:
```typescript
// Auto-detect string arrays and use textarea mode
const isStringArray = useMemo(() => {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}, [value]);

// Textarea mode: each line = one array item
const textareaValue = isStringArray ? value.join('\n') : '';
```

**Benefits**:
- Much cleaner UI for fields like "核心事件", "关键洞察", "卖点"
- Faster editing - no need to click individual delete buttons
- More natural for Chinese text input

### 4. **Real-time Collaboration Without Disruption**
**Principle**: Enable real-time collaboration while preserving user focus and preventing interruptions.

**Implementation**:
- **Focus Preservation** - Never lose cursor position during auto-save
- **Debounced Saving** - 1-second delay prevents excessive API calls
- **Optimistic Updates** - Changes appear immediately, sync happens in background
- **Queue-based Conflict Resolution** - Handle rapid typing without data loss

**Benefits**:
- Seamless typing experience for Chinese content creators
- Multiple users can work simultaneously without conflicts
- No disruption to creative flow

### 5. **Visual Status Indicators**
**Principle**: Use consistent visual language to indicate content status and editing capabilities.

**Implementation**:
- **Green Borders** - Editable/edited content (human transforms)
- **Blue Borders** - Read-only AI-generated content
- **"已编辑" Tags** - Clear indication of user modifications
- **"只读" Labels** - Explicit read-only indicators

**Benefits**:
- Users immediately understand what they can edit
- Clear distinction between AI-generated and human-edited content
- Builds confidence in the editing workflow

### 6. **Contextual Field Validation**
**Principle**: Validate content based on Chinese short drama requirements and platform constraints.

**Implementation**:
- **Character Limits** - Appropriate for 抖音 (short) vs 快手 (longer) content
- **Genre Validation** - Ensure content fits selected genre conventions
- **Platform Optimization** - Validate hook strength for different platforms
- **去脸谱化 Checking** - Warn against stereotypical content

**Benefits**:
- Content automatically optimized for target platforms
- Reduces revision cycles
- Maintains quality standards for Chinese audiences

### 7. **Progressive Content Revelation**
**Principle**: Show content complexity progressively as users dive deeper into editing.

**Implementation**:
- **Collection Overview** - Show summary cards with key information
- **Individual Editing** - Reveal full field set when editing specific items
- **Staged Workflow** - Only show next steps when prerequisites are complete
- **Expandable Sections** - Allow users to focus on specific areas

**Benefits**:
- Reduces overwhelming interfaces
- Guides users through complex creative processes
- Maintains focus on current task

### 8. **Intelligent Auto-Save with Conflict Resolution**
**Principle**: Save user work automatically while handling concurrent edits gracefully.

**Implementation**:
```typescript
// Queue-based saving to prevent data loss
if (savingRef.current) {
    pendingSaveRef.current = valueToSave; // Queue latest value
    return;
}

// Process queued values after save completes
if (pendingSaveRef.current && pendingSaveRef.current !== valueToSave) {
    const queuedValue = pendingSaveRef.current;
    setTimeout(() => saveValue(queuedValue), 0);
}
```

**Benefits**:
- No lost work during rapid typing
- Handles network delays gracefully
- Supports collaborative editing without conflicts

### 9. **Schema-Driven UI Generation**
**Principle**: Generate editing interfaces automatically from content schemas while maintaining Chinese-specific optimizations.

**Implementation**:
- **TypedArtifact Integration** - Automatically choose appropriate input components based on schema_type
- **ArtifactSchemaRegistry Validation** - Real-time validation using centralized Zod schemas
- **Chinese Text Optimization** - Proper handling of Chinese character input
- **Platform-Specific Validation** - Built-in validation for different social media platforms
- **Genre-Aware Forms** - Different form layouts for different drama types

**Benefits**:
- Consistent editing experience across all content types
- Reduces development time for new content types
- Maintains Chinese language input optimization

### 10. **Workflow-Aware Action Management**
**Principle**: Present only relevant actions based on current workflow state and available content.

**Implementation**:
- **Lineage-Based Action Computation** - Analyze artifact relationships to determine available actions
- **Stage Detection** - Automatically identify current position in creative workflow
- **Prerequisite Validation** - Only show actions when required content exists
- **Priority Ordering** - Display actions in logical workflow sequence

**Benefits**:
- Users never see irrelevant or impossible actions
- Clear guidance through complex creative workflows
- Reduces decision fatigue and cognitive load

These principles have been battle-tested in the 觅光助创 application and provide a solid foundation for Chinese short drama content creation tools. They balance the need for sophisticated AI-powered workflows with the practical requirements of Chinese content creators working on platforms like 抖音, 快手, and 小红书.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 16
- Docker and Docker Compose

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd script-writer

# Start PostgreSQL + Electric SQL
docker compose up -d

# Install dependencies (includes YJS packages)
npm install

# Run database migrations (includes YJS tables)
npm run migrate

# Seed test users
npm run seed

# Start development server
npm run dev
```

**YJS Dependencies Included**:
- `yjs@^13.6.27` - Core YJS library
- `@electric-sql/y-electric@^0.1.3` - Electric SQL integration
- `y-websocket@^3.0.0` - WebSocket provider for real-time sync

### First Steps

1. **Login** - Use dropdown to select test user (xiyang, xiaolin)
2. **Create Project** - Start with a new script project
3. **Brainstorm Ideas** - Generate initial story concepts
4. **Generate Outline Settings** - Use "生成剧本框架" to create character and story foundation
5. **Create Chronicles** - Generate chronological story timeline and episode progression
6. **Generate Episodes** - Create detailed episode breakdowns
7. **Write Scripts** - Develop full dialogue and scenes

## Available Scripts

**Development**:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Database Management**:
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Roll back last migration
- `npm run seed` - Seed test users and data
- `npm run nuke` - ⚠️ Destroy and recreate database

**Testing**:
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Run tests with Vitest UI

**Utilities**:
- `./run-ts <script>` - Run TypeScript scripts with proper configuration
- `psql -h localhost -U postgres -d script_writer` - Direct database access

## API Reference

### Authentication
- `POST /auth/login` - Login with provider credentials
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout and invalidate session

### Project Management
- `GET /api/projects` - List user's projects
- `POST /api/projects/create` - Create new project
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/create-from-brainstorm` - Create project from brainstorm ideas

### Agent & Chat System
- `POST /api/projects/:id/agent` - Send general agent request
- `POST /api/chat/:projectId/messages` - Send user message to agent
- `GET /api/chat/:projectId/messages` - Get chat history (Electric SQL)

** The chat API endpoint is `/api/chat/:projectId/messages`, NOT `/api/chat`. Always include the projectId in the URL path.

**Chat API Request Format**:
```typescript
// ✅ Correct format
fetch(`/api/chat/${projectId}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
  },
  credentials: 'include',
  body: JSON.stringify({
    content: "Your message content here",
    metadata: {}
  })
});

// ❌ Wrong format (missing projectId in URL)
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    projectId: projectId,  // Wrong - projectId should be in URL path
    message: "content"     // Wrong - should be 'content' not 'message'
  })
});
```

### Content Management
- `POST /api/artifacts/:id/human-transform` - Execute human edit transform (supports chronicle stage editing, field edits, etc.)
- `GET /api/artifacts` - List artifacts with filtering
- `GET /api/projects/:projectId/outline-settings` - Get outline settings for brainstorm ideas
- `GET /api/projects/:projectId/chronicles` - Get chronicles for outline settings

### YJS Collaboration
- `GET /api/yjs/artifact/:artifactId` - Get artifact data for YJS initialization
- `PUT /api/yjs/artifact/:artifactId` - Update artifact from YJS changes
- `POST /api/yjs/update` - Handle YJS document updates
- `POST /api/yjs/awareness` - Handle YJS awareness updates

**Human Transform Examples**:
```bash
# Create editable chronicle stage
POST /api/artifacts/chronicles-artifact-id/human-transform
{
  "transformName": "edit_chronicles_stage",
  "derivationPath": "$.stages[0]",
  "fieldUpdates": {}
}

# Edit specific fields in outline settings
POST /api/artifacts/outline-artifact-id/human-transform
{
  "transformName": "edit_outline_field",
  "derivationPath": "$.title",
  "fieldUpdates": { "title": "New Title" }
}
```

### Electric SQL Proxy
- `GET /api/electric/v1/shape` - Authenticated proxy with user scoping

## Content Creation Guidelines

### Chinese Short Drama Best Practices

**去脸谱化 (De-stereotyping)**:
- Avoid stereotypical character archetypes
- Create complex, multi-dimensional characters
- Modern plots that challenge traditional expectations
- Include diverse backgrounds and perspectives

**Platform Optimization**:
- **抖音/TikTok** - Fast-paced, hook-heavy content (15-60 seconds)
- **快手/Kuaishou** - Authentic, relatable stories (1-3 minutes)
- **小红书/RedBook** - Lifestyle-integrated narratives (30-90 seconds)

**Genre Conventions**:
- **现代甜宠** - Contemporary romance with sugar-sweet moments
- **古装甜宠** - Historical romance with modern sensibilities
- **复仇爽文** - Revenge narratives with satisfying payoffs
- **霸总文** - CEO romance with power dynamics

**Story Structure**:
- **Hook** - Compelling opening within first 3 seconds
- **Conflict** - Clear antagonist or obstacle
- **Escalation** - Rising tension and stakes
- **Payoff** - Satisfying resolution or cliffhanger

## Development

### Contributing Guidelines

1. **Follow Framework Patterns** - Use Transform Artifact Framework conventions
2. **Maintain Chinese Focus** - All content generation should target Chinese audiences
3. **Test Comprehensively** - Use cache-based testing for AI features
4. **Document Templates** - All prompt templates should be well-documented

### Adding New Content Types

1. **Define Schema** - Create Zod schema in `src/common/schemas/`
2. **Create Template** - Add prompt template in `src/server/services/templates/`
3. **Build Tool** - Implement using streaming framework pattern
4. **Add UI Components** - Create React components with Ant Design
5. **Integrate SectionWrapper** - Use `SectionWrapper` for consistent section management
6. **Add YJS Support** - Implement YJS field components for real-time collaboration
7. **Test Integration** - Add cache-based tests for AI functionality

### Adding New Script Content Types

When adding new content types to the script writing workflow:

**Step 1: Define Content Schema**
```typescript
// In src/common/schemas/artifacts.ts
export const NewContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  platform: z.enum(['douyin', 'kuaishou', 'xiaohongshu']),
  genre: z.string(),
  target_audience: z.string()
});

// Add to ArtifactSchemaRegistry
export const ArtifactSchemaRegistry = {
  // ... existing schemas
  'new_content': NewContentSchema
} as const;
```

**Step 2: Create Template**
```typescript
// In src/server/services/templates/
export const newContentTemplate = `
Generate Chinese short drama content following 去脸谱化 principles:
1. Avoid stereotypical characters and plots
2. Include modern, diverse perspectives
3. Platform: {{platform}}
4. Genre: {{genre}}
5. Target Audience: {{target_audience}}

Content Requirements:
{{requirements}}
`;
```

**Step 3: Add YJS Components**
```typescript
// In src/client/components/shared/
export const NewContentEditor: React.FC<{ artifactId: string }> = ({ artifactId }) => {
  return (
    <YJSArtifactProvider artifactId={artifactId}>
      <YJSTextField path="title" placeholder="输入标题..." />
      <YJSTextAreaField path="content" placeholder="输入内容..." />
      <YJSArrayField path="tags" placeholder="每行一个标签..." />
    </YJSArtifactProvider>
  );
};
```

**Step 4: Add Action Component**
```typescript
// In src/client/components/actions/
export const NewContentAction: React.FC<BaseActionProps> = ({ 
  projectId, onSuccess, onError 
}) => {
  return (
    <Form onFinish={handleGenerate}>
      <Form.Item name="platform" rules={[{ required: true }]}>
        <Select placeholder="选择平台">
          <Option value="douyin">抖音</Option>
          <Option value="kuaishou">快手</Option>
          <Option value="xiaohongshu">小红书</Option>
        </Select>
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          生成内容
        </Button>
      </Form.Item>
    </Form>
  );
};
```

**Step 5: Update Workflow Logic**
```typescript
// In src/client/utils/actionComputation.ts
// Add new stage detection for the content type
if (hasNewContentPrerequisites && isLeafNode(prerequisiteArtifact)) {
  return {
    actions: [{
      id: 'generate-new-content',
      type: 'form',
      title: '生成新内容',
      component: NewContentAction,
      enabled: true,
      priority: 6
    }],
    currentStage: 'new_content_generation',
    hasActiveTransforms: false
  };
}

// Update TypedArtifact type to include new content type
export type TypedArtifact = 
  | ArtifactWithData<'new_content', 'v1', NewContentV1>
  | ... // existing types
```

### Chinese Drama Content Guidelines

**去脸谱化 (De-stereotyping) Requirements**:
- All new content types must include explicit anti-stereotyping instructions
- Character development should challenge traditional archetypes
- Plot elements should avoid predictable tropes
- Include diverse backgrounds and modern perspectives

**Platform-Specific Optimization**:
- **抖音 (Douyin)**: Fast-paced, hook-heavy content (15-60 seconds)
- **快手 (Kuaishou)**: Authentic, relatable stories (1-3 minutes)  
- **小红书 (RedBook)**: Lifestyle-integrated narratives (30-90 seconds)

**Genre Templates Available**:
- **现代甜宠** - Contemporary romance with sugar-sweet moments
- **古装甜宠** - Historical romance with modern sensibilities
- **复仇爽文** - Revenge narratives with satisfying payoffs
- **霸总文** - CEO romance with power dynamics

### Custom Prompt Development

All prompts emphasize 去脸谱化 (de-stereotyping) requirements:

```typescript
// Example template
export const brainstormTemplate = `
Generate Chinese short drama ideas that follow 去脸谱化 principles:
1. Avoid stereotypical characters and plots
2. Include modern, diverse perspectives
3. Create complex character motivations
4. Challenge traditional genre expectations

Platform: {{platform}}
Genre: {{genre}}
Requirements: {{requirements}}
`;
```

## Production Deployment

### Environment Setup

**Environment Variables**:
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database
ELECTRIC_URL=http://localhost:5133

# Authentication
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# AI Services
OPENAI_API_KEY=your-openai-key
CLAUDE_API_KEY=your-claude-key
```

**Docker Deployment**:
```bash
# Build application
npm run build

# Deploy with Docker Compose
docker compose -f docker-compose.prod.yml up -d
```

### Monitoring and Analytics

- **Performance Monitoring** - Application performance metrics
- **Content Analytics** - Track popular genres, platforms, and content types
- **User Engagement** - Monitor collaboration patterns and feature usage
- **AI Usage** - Track generation requests and success rates

## License

[Add your license information here]

## Framework Documentation

For detailed technical documentation about the underlying Transform Artifact Framework, including agent architecture, database schemas, and development patterns, see [TRANSFORM_ARTIFACT_FRAMEWORK.md](./TRANSFORM_ARTIFACT_FRAMEWORK.md).

### Chat Interface Architecture

The application uses a modern assistant-ui based chat interface with the following components:

**Component Structure**:
```
ChatSidebarWrapper (Entry Point with Context)
├── ChatProvider (provides context)
└── AssistantChatSidebar (Main Interface)
    ├── Header (with actions and status)
    ├── BasicThread (Message Display with Auto-Scroll)
    │   ├── Viewport (scroll tracking)
    │   ├── Messages (auto-scroll target)
    │   ├── Scroll Button (when not at bottom)
    │   └── Input Area (send messages)
    └── Status/Debug info
```

**Key Features**:
- **Smart Auto-Scroll**: Automatically scrolls to bottom when new messages arrive, but only if user was already at the bottom
- **User Control Preservation**: Users can scroll up to read history without interruption from new messages
- **Visual Feedback**: Floating scroll-to-bottom button appears when user scrolls up
- **Performance Optimized**: Efficient scroll position tracking without impacting performance
- **Backend Compatibility**: Uses existing `/api/chat/:projectId/messages` endpoint with no backend changes required

**Auto-Scroll Implementation**:
```typescript
// Smart scrolling logic
React.useEffect(() => {
    if (isAtBottom) {
        scrollToBottom();
    }
}, [messages, isLoading, isAtBottom]);

// Scroll position tracking with tolerance
const handleScroll = () => {
    if (viewportRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px tolerance
        setIsAtBottom(atBottom);
    }
};
```

### Testing Framework

**Comprehensive Test Coverage**:
- **Unit Tests** - Complete test suite for action computation and lineage resolution
- **Integration Tests** - End-to-end workflow validation with cached LLM responses
- **Cache-Based Testing** - Realistic AI functionality testing with actual cached responses
- **Data-Driven Testing** - Tests based on real production database patterns

**Action Computation Tests**:
- ✅ **21 test scenarios** covering all workflow stages and edge cases
- ✅ **Real data patterns** from production project lineage analysis
- ✅ **Stage detection logic** validation for workflow progression
- ✅ **Active transform handling** for streaming states
- ✅ **Error handling** for malformed data and edge cases

**Test Execution**:
```bash
# Run all tests
npm test

# Run specific test suites
npm run test -- --grep "action computation"
npm run test -- --grep "lineage resolution"

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

All tests use project-based access control patterns and validate the complete workflow from brainstorming through episode generation.