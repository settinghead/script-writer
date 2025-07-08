# 觅光助创

A collaborative Chinese short drama script writing application built on the [Transform Artifact Framework](./TRANSFORM_ARTIFACT_FRAMEWORK.md). Features AI-powered brainstorming, intelligent outline generation, and real-time collaboration for creating compelling short drama content.

## Overview

觅光助创 combines AI-powered content generation with sophisticated editing workflows specifically designed for Chinese short drama production. The application leverages the Transform Artifact Framework to provide intelligent agents, real-time collaboration, and complete content audit trails.

**Key Features**:
- **AI-Powered Script Creation** - From initial brainstorming to complete episode scripts
- **Chinese Short Drama Focus** - Specialized for 抖音, 快手, and other Chinese platforms
- **去脸谱化 Content** - Emphasizes modern, non-stereotypical characters and plots
- **Real-time Collaboration** - Multiple creators can work simultaneously
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

**Chat Interface**:
- **ChatGPT-style Sidebar** - Resizable (250px-600px) with mobile responsive design
- **Project-Scoped History** - Complete conversation context per project
- **Event-Driven Messaging** - 6 event types for comprehensive interaction tracking
- **Message Sanitization** - Two-layer system preventing trade secret exposure

### 🎯 Centralized Action Items System

The application implements a sophisticated centralized action system that separates content editing from workflow actions, providing a clean and intuitive user experience.

**Design Philosophy**:
- **Main Area for Editing** - The primary content area in `ProjectLayout` is dedicated to editing and viewing content, especially large text fields and complex data structures
- **Bottom Actions for Workflow** - All workflow actions (buttons, forms, parameters) are centralized in the bottom `ActionItemsSection` for consistent user experience
- **Linear Progression** - Actions follow strict linear workflow progression based on artifact lineage and project state
- **Smart State Management** - Actions automatically appear/disappear based on current project state and available artifacts

**Action Items Architecture**:

**Centralized Action Management**:
- **ActionItemsSection Component** - Sticky bottom section that displays all available actions
- **Action Computation Logic** - `computeParamsAndActions()` function analyzes project state and determines available actions
- **Global State Management** - `useActionItemsStore()` with localStorage persistence for form data and selections
- **Linear Workflow Detection** - Automatic stage detection from `initial` → `brainstorm_input` → `brainstorm_selection` → `idea_editing` → `outline_generation` → `chronicles_generation` → `episode_generation`

**Action Components**:
- **BrainstormCreationActions** - Project creation buttons (brainstorm/manual creation)
- **BrainstormInputForm** - Simple "开始头脑风暴" button with parameter validation
- **BrainstormIdeaSelection** - Confirm button for selected brainstorm ideas
- **OutlineGenerationForm** - Outline settings generation with episode/platform parameters
- **ChroniclesGenerationAction** - One-click chronicles generation from outline settings
- **EpisodeGenerationAction** - Final episode script generation from chronicles

**Workflow Stage Management**:
```typescript
interface WorkflowStage {
  'initial'              // No brainstorm input → Show creation buttons
  'brainstorm_input'     // Has input artifact (leaf) → Show brainstorm form
  'brainstorm_selection' // Has generated ideas, no chosen → Show selection
  'idea_editing'         // Has chosen idea (leaf) → Show outline form
  'outline_generation'   // Has outline settings (leaf) → Show chronicles
  'chronicles_generation' // Has chronicles (leaf) → Show episode generation
  'episode_generation'   // Has episodes → Show script generation
}
```

**Smart Action Logic**:
- **Leaf Node Detection** - Actions only appear when artifacts are "leaf nodes" (no descendants in transform chain)
- **Dependency Validation** - Each action validates required predecessor artifacts exist
- **Loading State Management** - Actions hide during active transforms to prevent conflicts
- **Error State Handling** - Failed transforms show retry options and error messages

**Form Data Persistence**:
- **Auto-Save Drafts** - All form data automatically saved to localStorage with project scoping
- **Selection State** - Brainstorm idea selections persist across page refreshes
- **Form Validation** - Real-time validation with helpful error messages
- **Optimistic Updates** - Form submissions use optimistic state management

**Benefits**:
- **Consistent UX** - All actions follow the same visual and behavioral patterns
- **Reduced Cognitive Load** - Users always know where to find actions (bottom of screen)
- **Preserved Editing** - Main content area remains focused on editing and viewing
- **Workflow Guidance** - Clear progression through linear workflow stages
- **State Persistence** - No lost form data or selections during navigation

**Example Action Flow**:
```
1. User opens new project → ActionItemsSection shows creation buttons
2. User clicks "创建头脑风暴" → Creates brainstorm input artifact
3. Main area shows brainstorm parameters form → User fills parameters
4. ActionItemsSection shows "开始头脑风暴" button → User clicks to generate
5. Ideas appear in main area → User selects preferred idea
6. ActionItemsSection shows "Continue with Selected Idea" → User confirms
7. Main area shows chosen idea editing → ActionItemsSection shows outline form
8. User fills outline parameters → Clicks "生成剧本框架"
9. Process continues through chronicles → episodes → scripts
```

### 📊 Content Management

**Project-Based Organization**:
- **Project Hierarchy** - Project → Episodes → Scripts structure
- **Artifact Lineage** - Complete audit trail of all content modifications
- **Version Control** - Edit history with "always edit latest" principle
- **Collaborative Editing** - Multiple users can edit different parts simultaneously

**Content Types**:
- **Brainstorm Ideas** - Initial story concepts with platform targeting
- **Outline Settings** - Character development, story foundation, and commercial elements
- **Chronicles** - Chronological story timeline and staged progression
- **Episode Synopses** - Individual episode breakdowns
- **Script Content** - Full dialogue and scene descriptions

## Technical Architecture

### Framework Foundation
觅光助创 is built on the **Transform Artifact Framework**. For detailed technical documentation, see [TRANSFORM_ARTIFACT_FRAMEWORK.md](./TRANSFORM_ARTIFACT_FRAMEWORK.md).

**Key Framework Benefits**:
- **Immutable Content History** - All edits tracked with complete lineage
- **Real-time Synchronization** - Electric SQL for instant collaboration
- **Type-Safe Operations** - Zod validation throughout the system
- **Advanced Caching** - Development-optimized streaming response caching

### Application Architecture

**Frontend (React 19 + TypeScript)**:
- **TanStack Query** - Server state management with intelligent caching
- **Zustand** - Global client state for UI interactions
- **Electric SQL React hooks** - Real-time data synchronization
- **Ant Design** - Component library with dark theme throughout
- **SectionWrapper Architecture** - Unified section management with automatic status detection

**Backend (Express.js + TypeScript)**:
- **Agent Service** - Central orchestration with tool selection
- **Streaming Framework** - Unified pattern for all AI tools
- **Template System** - Chinese short drama specific prompts
- **Electric SQL Proxy** - Authenticated real-time data access

**Database (PostgreSQL + Electric SQL)**:
- **Project-Based Access Control** - All content scoped to projects
- **Artifact System** - Immutable content with edit lineage
- **Transform Tracking** - Complete audit trail of all modifications

### SectionWrapper Architecture

The application uses a unified `SectionWrapper` component that provides consistent section rendering with intelligent status detection across all major content areas.

**Component Features**:
- **Automatic Artifact Resolution** - Finds the latest/deepest artifact in lineage chains
- **Smart Status Detection** - Automatically detects loading/failed/normal states based on transform status
- **Lineage Chain Support** - Handles AI-generated → human-edited artifact flows seamlessly
- **Type-Safe Schema Types** - Uses TypeScript enums for artifact schema type safety

**Usage Pattern**:
```typescript
<SectionWrapper
  schemaType={ArtifactSchemaType.BRAINSTORM_COLLECTION}
  title="头脑风暴"
  sectionId="brainstorm-ideas"
  artifactId={specificArtifactId} // Optional: for precise artifact targeting
>
  {/* Section content */}
</SectionWrapper>
```

**Implemented Sections**:
- **ProjectBrainstormPage** - `BRAINSTORM_COLLECTION` with automatic artifact resolution
- **SingleBrainstormIdeaEditor** - `BRAINSTORM_ITEM` with specific artifact targeting
- **OutlineSettingsDisplay** - `OUTLINE_SETTINGS` with effective artifact detection
- **ChroniclesDisplay** - `CHRONICLES` with automatic latest artifact resolution
- **ChronicleStageCard** - `CHRONICLE_STAGE` with individual stage editing support

**Status Detection Logic**:
- **Loading State** - When transforms are running/pending that produce or modify the artifact
- **Failed State** - When transforms have failed, with red color scheme and warning indicators
- **Normal State** - When artifacts exist and are successfully created/edited

**Benefits**:
- **Consistent UX** - All sections follow the same visual and behavioral patterns
- **Reduced Boilerplate** - No need to manually implement TextDivider and status logic
- **Automatic Updates** - Status changes are reflected immediately across all sections
- **Lineage Awareness** - Automatically handles complex artifact inheritance chains

### Optimistic State Implementation

Following the [Electric SQL write guide patterns](https://electric-sql.com/docs/guides/writes), the application implements sophisticated optimistic state management:

**Concurrent Edit Handling**:
- **Queue-Based Saves** - Pending edits are queued during active saves to prevent data loss
- **Recursive Processing** - Queued values are automatically processed after current saves complete
- **No Lost Edits** - Latest user input is preserved even during rapid typing

**Smart State Synchronization**:
- **Edit Preservation** - Local edits are protected during optimistic state updates
- **Fresh Data Fetching** - Save operations always use current artifact data to prevent stale closures
- **Conditional Prop Syncing** - Props only update local state when not actively saving

**Race Condition Prevention**:
```typescript
// Example: Concurrent edit handling with queueing
if (savingRef.current) {
    pendingSaveRef.current = valueToSave; // Queue latest value
    return;
}

// After save completes, process any queued values
if (pendingSaveRef.current && pendingSaveRef.current !== valueToSave) {
    const queuedValue = pendingSaveRef.current;
    setTimeout(() => saveValue(queuedValue), 0); // Save queued value
}
```

**Benefits**:
- **Seamless UX** - Users can type continuously without interruption
- **Data Integrity** - No edits are lost during network operations
- **Real-time Collaboration** - Multiple users can edit simultaneously without conflicts

### Script-Specific Schemas

**Brainstorm Schema**:
```typescript
export const BrainstormIdeaSchema = z.object({
  title: z.string(),
  synopsis: z.string(),
  genre: z.string(),
  platform: z.string(),
  target_audience: z.string(),
  key_elements: z.array(z.string())
});
```

**Outline Settings Schema**:
```typescript
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
  characters: z.array(CharacterDetailSchema)
});

export const CharacterDetailSchema = z.object({
  name: z.string(),
  type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 
                'male_supporting', 'female_supporting', 'antagonist', 'other']),
  age: z.string(),
  occupation: z.string(),
  personality: z.string(),
  appearance: z.string(),
  background: z.string()
});
```

**Chronicles Schema**:
```typescript
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
```

**Stage-Level Human Transforms**:
- **Individual Stage Artifacts** - Each stage can be converted to a `chronicle_stage_schema` artifact for independent editing
- **JSONPath Targeting** - Uses paths like `$.stages[0]`, `$.stages[1]` for precise stage identification
- **Transform Name**: `edit_chronicles_stage` for all stage-level modifications
- **Lineage Preservation** - Original chronicles collection remains intact while individual stages can be edited

**UI Features**:
- **Smart Editability Detection** - Only stages with `chronicle_stage_schema` artifacts show as editable (green border)
- **Complete Field Editing** - All stage fields become editable when in edit mode:
  - `title` - Stage title (text input)
  - `stageSynopsis` - Stage overview (textarea)
  - `event` - Core event description (textarea)
  - `emotionArcs` - Character emotion development (textarea array)
  - `relationshipDevelopments` - Character relationship progression (textarea array)
  - `insights` - Key story insights (textarea array)
- **Edit Button** - Non-editable stages show "编辑阶段" button to create editable versions
- **Visual Indicators** - Green border and "已编辑" tag for edited stages

**Data Conversion**:
- **Complex Fields** - `emotionArcs` and `relationshipDevelopments` convert to/from "characters: content" format for editing
- **Simple Arrays** - `insights` edited directly as string arrays
- **Textarea Mode** - All array fields use textarea editing with one item per line

**Technical Implementation**:
```typescript
// Stage editability check
const isEditable = isUserInput && isStageArtifact && !hasDescendants;

// Transform creation for stage editing
projectData.createHumanTransform.mutate({
  transformName: 'edit_chronicles_stage',
  sourceArtifactId: chroniclesArtifactId,
  derivationPath: `$.stages[${stageIndex}]`,
  fieldUpdates: {}
});

// Individual field saving
await handleSave('title', newValue);
await handleSave('emotionArcs', convertedEmotionArcs);
```

**Benefits**:
- **Granular Control** - Edit individual stages without affecting the entire chronicles
- **Preserved Structure** - Original AI-generated chronicles remains as reference
- **Complete Audit Trail** - All stage modifications tracked through transform system
- **Flexible Editing** - Can edit some stages while leaving others unchanged
- **Type Safety** - Full TypeScript support for all stage fields and operations

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

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed test users
npm run seed

# Start development server
npm run dev
```

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

### Content Management
- `POST /api/artifacts/:id/human-transform` - Execute human edit transform (supports chronicle stage editing, field edits, etc.)
- `GET /api/artifacts` - List artifacts with filtering
- `GET /api/projects/:projectId/outline-settings` - Get outline settings for brainstorm ideas
- `GET /api/projects/:projectId/chronicles` - Get chronicles for outline settings

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
6. **Test Integration** - Add cache-based tests for AI functionality

### Adding New Action Items

When adding new workflow actions, follow the centralized action items pattern:

**Step 1: Update Action Computation Logic**
```typescript
// In src/client/utils/actionComputation.ts
export const computeParamsAndActions = (projectData: ProjectDataContextType): ComputedActions => {
  // Add new stage detection logic
  if (hasNewContentType && isLeafNode(newArtifact)) {
    return {
      actions: [{
        id: 'new-action',
        type: 'button',
        title: '新操作',
        component: NewActionComponent,
        props: { /* action-specific props */ },
        enabled: true,
        priority: 5
      }],
      currentStage: 'new_stage',
      hasActiveTransforms: false
    };
  }
};
```

**Step 2: Create Action Component**
```typescript
// In src/client/components/actions/NewActionComponent.tsx
interface NewActionProps extends BaseActionProps {
  // Action-specific props
}

export const NewActionComponent: React.FC<NewActionProps> = ({ 
  projectId, onSuccess, onError, ...props 
}) => {
  // Keep action components focused on:
  // - Immediate parameters (not large text editing)
  // - Action buttons and forms
  // - Validation and submission logic
  
  return (
    <Space>
      <Button type="primary" onClick={handleAction}>
        执行新操作
      </Button>
    </Space>
  );
};
```

**Step 3: Register Action Component**
```typescript
// In src/client/components/actions/index.ts
export { NewActionComponent } from './NewActionComponent';

// Update ActionItemRenderer to handle new action type
```

**Action Component Guidelines**:
- **Keep Actions Small** - Action components should focus on buttons, forms, and immediate parameters
- **Avoid Large Text Editing** - Large text fields belong in the main content area, not action items
- **Use BaseActionProps** - All action components must extend `BaseActionProps` interface
- **Validate Prerequisites** - Check for required artifacts before enabling actions
- **Handle Loading States** - Show loading indicators during action execution
- **Provide Clear Feedback** - Use success/error callbacks for user feedback

**Main Area vs Action Items**:
- **Main Area**: Large text editing, complex data structures, detailed content viewing
- **Action Items**: Workflow buttons, parameter forms, immediate action controls

### SectionWrapper Integration Pattern

When creating new content sections, follow this established pattern:

**Step 1: Add Schema Type**
```typescript
// In src/client/components/shared/SectionWrapper.tsx
export enum ArtifactSchemaType {
  // ... existing types
  NEW_CONTENT = 'new_content_schema'
}
```

**Step 2: Replace TextDivider Usage**
```typescript
// Before:
<>
  <TextDivider title="Section Title" id="section-id" mode="normal" />
  <div id="section-id">
    {/* content */}
  </div>
</>

// After:
<SectionWrapper
  schemaType={ArtifactSchemaType.NEW_CONTENT}
  title="Section Title"
  sectionId="section-id"
  artifactId={specificArtifactId} // Optional: for precise targeting
>
  {/* content */}
</SectionWrapper>
```

**Step 3: Update Imports**
```typescript
// Remove TextDivider import
import { SectionWrapper, ArtifactSchemaType } from './shared';
```

**Common Patterns Established**:
- **Automatic Status Detection** - All sections automatically show loading/failed/normal states
- **Consistent Visual Design** - Unified TextDivider styling with red failed state
- **Artifact Lineage Support** - Handles AI-generated → human-edited chains
- **Type Safety** - Schema types enforced through TypeScript enums
- **Flexible Targeting** - Can use automatic resolution or specific artifact IDs

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