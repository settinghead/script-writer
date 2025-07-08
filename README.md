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

**Chat Interface with Assistant-UI Integration**:
- **Auto-Scroll Functionality** - Smart auto-scroll to bottom when new messages arrive, with user control preservation
- **Modern Message Layout** - Card-based messages with user/assistant avatars and proper alignment
- **Scroll Position Tracking** - Monitors user scroll position with floating scroll-to-bottom button
- **Chinese Localization** - Complete interface in Chinese (觅子智能体)
- **Real-time Streaming** - Maintains Electric SQL streaming with smooth loading animations
- **Keyboard Shortcuts** - Enter to send, Shift+Enter for new lines
- **Performance Optimized** - Efficient scroll tracking without performance impact

### 🎯 Script Writing Workflow

觅光助创 implements a sophisticated linear workflow system specifically designed for Chinese short drama creation, with intelligent action management that guides users through the complete script development process.

**Script Writing Stages**:
1. **灵感生成 (Brainstorm)** - Generate initial story concepts with platform-specific optimization
2. **创意选择 (Idea Selection)** - Select and refine the most promising story idea
3. **剧本框架 (Outline Settings)** - Develop characters, setting, and commercial elements
4. **时间顺序大纲 (Chronicles)** - Create chronological story progression
5. **分集规划 (Episode Planning)** - Break story into episode structure
6. **剧本创作 (Script Writing)** - Generate detailed scripts with dialogue

**Workflow Features**:
- **Linear Progression** - Each stage builds on previous work with intelligent dependency tracking
- **Smart Actions** - Bottom action panel shows only relevant next steps based on current progress
- **Persistent State** - Form data and selections automatically saved across sessions
- **Visual Feedback** - Clear indicators of current stage and completion status
- **Flexible Editing** - Main content area dedicated to editing and viewing, actions separated to bottom panel

**Chinese Drama Specialization**:
- **Platform Optimization** - Tailored for 抖音, 快手, 小红书 content requirements
- **去脸谱化 Content** - Built-in emphasis on modern, non-stereotypical characters and plots
- **Genre Templates** - Specialized prompts for 现代甜宠, 古装甜宠, 复仇爽文, 霸总文
- **Commercial Elements** - Integrated 卖点 (selling points) and 爽点 (satisfaction points) tracking

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

### Script Writing UI Components

觅光助创 uses specialized UI components designed for Chinese short drama script creation, built on the Transform Artifact Framework's editing capabilities.

**Unified Section Management**:
- **SectionWrapper** - Consistent section rendering with automatic status detection for all content areas
- **Automatic Artifact Resolution** - Finds latest versions in editing chains (AI-generated → human-edited)
- **Smart Status Detection** - Loading/failed/normal states based on transform status
- **Visual Indicators** - Clear feedback for editing states and completion status

**Specialized Editing Components**:
- **BrainstormIdeaEditor** - Multi-idea editing with selection and refinement capabilities
- **OutlineSettingsDisplay** - Character development, story foundation, and commercial elements
- **ChroniclesDisplay** - Chronological story timeline with stage-level editing
- **ChronicleStageCard** - Individual stage editing with emotion arcs and relationship developments

**Content-Specific Features**:
- **Chinese Text Optimization** - Proper handling of Chinese character input and display
- **Platform-Aware Forms** - Input validation for different social media platforms
- **Genre-Specific Templates** - Pre-configured forms for different drama types
- **Auto-Save System** - Debounced saving with edit preservation during rapid typing

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

**Step 3: Add Action Component**
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

**Step 4: Update Workflow Logic**
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