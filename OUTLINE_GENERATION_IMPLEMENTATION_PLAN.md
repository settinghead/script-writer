# Outline Generation Implementation Plan

## Overview
Implement outline generation capability using the existing agent framework, following the same patterns as brainstorm generation. The feature will allow users to generate detailed story outlines from selected brainstorm ideas.

## ✅ IMPLEMENTATION STATUS: PHASES 1-4 COMPLETED
**Current Status**: Core outline generation feature is fully implemented and functional
**Last Updated**: Phase 1-4 completed, Phase 5 (cleanup) pending

### 🐛 Bug Fixes Applied During Implementation
- **Fixed artifact validation error**: Changed artifact type from `'plot_outline'` to `'outline'` to match registered schema
- **Added type mapping**: Added `'outline': 'outline_schema'` mapping in `mapTypeToSchemaType` function
- **Corrected parameter order**: Fixed `createArtifact` call parameter sequence in OutlineTool

## ✅ Phase 1: Backend Schema & Tool Infrastructure - COMPLETED

### ✅ 1.1 Create Outline Schemas in src/common/schemas/ - COMPLETED

#### ✅ Create `src/common/schemas/outlineSchemas.ts` - COMPLETED
```typescript
import { z } from 'zod';

// Input schema for outline generation (based on OutlineInputForm.tsx)
export const OutlineGenerationInputSchema = z.object({
  sourceArtifactId: z.string().describe('ID of the brainstorm idea to use'),
  totalEpisodes: z.number().min(6).max(200).describe('Total number of episodes'),
  episodeDuration: z.number().min(1).max(30).describe('Duration per episode in minutes'),
  selectedPlatform: z.string().describe('Target platform (抖音, 快手, etc.)'),
  selectedGenrePaths: z.array(z.array(z.string())).describe('Selected genre paths'),
  requirements: z.string().optional().describe('Special requirements')
});

export type OutlineGenerationInput = z.infer<typeof OutlineGenerationInputSchema>;

// Character schema (from outline.ts template)
const CharacterSchema = z.object({
  name: z.string(),
  type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 'male_supporting', 'female_supporting', 'antagonist', 'other']),
  description: z.string(),
  age: z.string(),
  gender: z.string(),
  occupation: z.string(),
  personality_traits: z.array(z.string()),
  character_arc: z.string(),
  relationships: z.record(z.string()),
  key_scenes: z.array(z.string())
});

// Complete outline output schema (from outline.ts template)
export const OutlineGenerationOutputSchema = z.object({
  title: z.string(),
  genre: z.string(),
  target_audience: z.object({
    demographic: z.string(),
    core_themes: z.array(z.string())
  }),
  selling_points: z.array(z.string()),
  satisfaction_points: z.array(z.string()),
  setting: z.object({
    core_setting_summary: z.string(),
    key_scenes: z.array(z.string())
  }),
  characters: z.array(CharacterSchema),
  synopsis_stages: z.array(z.string()),
  stages: z.array(z.object({
    title: z.string(),
    stageSynopsis: z.string(),
    numberOfEpisodes: z.number(),
    timeframe: z.string(),
    startingCondition: z.string(),
    endingCondition: z.string(),
    stageStartEvent: z.string(),
    stageEndEvent: z.string(),
    keyPoints: z.array(z.object({
      event: z.string(),
      timeSpan: z.string(),
      emotionArcs: z.array(z.object({
        characters: z.array(z.string()),
        content: z.string()
      })),
      relationshipDevelopments: z.array(z.object({
        characters: z.array(z.string()),
        content: z.string()
      }))
    })),
    externalPressure: z.string()
  }))
});

export type OutlineGenerationOutput = z.infer<typeof OutlineGenerationOutputSchema>;
```

#### ✅ Update `src/common/schemas/artifacts.ts` - COMPLETED
```typescript
// Add outline schema to ARTIFACT_SCHEMAS
import { OutlineGenerationOutputSchema } from './outlineSchemas';

export const ARTIFACT_SCHEMAS = {
  // ... existing schemas
  'outline_schema': OutlineGenerationOutputSchema
} as const;
```

#### ✅ Update `src/common/schemas/transforms.ts` - COMPLETED
```typescript
// Add outline transform definition to LLM_TRANSFORM_DEFINITIONS
'llm_generate_outline': {
  name: 'llm_generate_outline',
  description: 'AI generation of story outline from brainstorm idea',
  inputTypes: ['brainstorm_idea_schema', 'user_input_schema'],
  outputType: 'outline_schema',
  templateName: 'outline',
  inputSchema: OutlineGenerationInputSchema,
  outputSchema: OutlineGenerationOutputSchema
}
```

### ✅ 1.2 Create Outline Tool - COMPLETED

#### ✅ Create `src/server/tools/OutlineTool.ts` - COMPLETED
Follow the same pattern as BrainstormTool.ts with key differences:
- Tool name: `generate_outline`
- Uses `outline` template from TemplateService
- Creates `plot_outline` type artifacts (legacy mapping)
- Extracts brainstorm idea data from source artifact
- Builds template context with episode configuration and platform requirements

### ✅ 1.3 Update Agent Framework Integration - COMPLETED

#### ✅ Update `src/server/services/AgentRequestBuilder.ts` - COMPLETED
- Add outline generation patterns to `analyzeRequestType()`
- Add `createOutlineToolDefinition` to tool builders
- Support `outline_generation` request type

## ✅ Phase 2: Context Filtering & Agent Integration - COMPLETED

### ✅ 2.1 Smart Context Filtering - COMPLETED  
**Note**: Context filtering implemented in AgentRequestBuilder.ts

#### ✅ Update `src/common/utils/agentContext.ts` - COMPLETED
```typescript
// Add focused context for outline generation
export function prepareAgentPromptContextForOutline(
  projectData: ProjectDataForContext,
  targetArtifactId?: string
): string {
  // Focus on single brainstorm idea if specified
  // Reduces context size and agent confusion
}
```

### ✅ 2.2 Request Type Detection - COMPLETED

Add intelligent detection of outline generation requests:
- Pattern matching: "生成大纲", "创建大纲", "故事大纲"
- Context awareness: Previous brainstorm completion
- Parameter extraction from natural language

## ✅ Phase 3: Frontend Integration - COMPLETED

### ✅ 3.1 Outline Generation Form - COMPLETED

#### ✅ Update `src/client/components/brainstorm/BrainstormIdeaEditor.tsx` - COMPLETED
Add inline outline generation form triggered by "用这个灵感继续" button:
- Modal form with episode configuration
- Platform and genre selection (reusing existing components)
- Requirements text area
- Integration with ProjectDataContext for agent requests

### ✅ 3.2 Agent Request Method - COMPLETED  
**Note**: Uses existing agent request functionality

#### ✅ Update `src/client/contexts/ProjectDataContext.tsx` - COMPLETED
```typescript
interface ProjectDataContextType {
  sendAgentRequest: (userRequest: string) => Promise<void>;
}
```

### ✅ 3.3 Outline Results Display - COMPLETED

#### ✅ Create `src/client/components/OutlineDisplay.tsx` - COMPLETED  
**Note**: Created as OutlineDisplay.tsx instead of in outline/ folder
Comprehensive outline display component:
- Collapsible sections for characters, stages, selling points
- Timeline view for story progression
- Character cards with relationship details
- Responsive design matching existing UI patterns

#### ✅ Update `src/client/components/brainstorm/ProjectBrainstormPage.tsx` - COMPLETED  
Add OutlineResults component that appears when outline artifacts are detected.

## ✅ Phase 4: Database & Type Integration - COMPLETED

### ✅ 4.1 Legacy Type Mapping - COMPLETED  
**Note**: Implemented in `src/server/types/artifacts.ts` instead

#### ✅ Update `src/server/types/artifacts.ts` - COMPLETED
```typescript
private mapSchemaTypeToLegacyType(schemaType: string): string {
  const schemaToLegacyMapping: Record<string, string> = {
    'outline_schema': 'plot_outline', // NEW mapping
    // ... existing mappings
  };
}
```

### ✅ 4.2 Electric SQL Type Definitions - COMPLETED  
**Note**: Types work automatically with existing Electric SQL setup

#### ✅ Update `src/common/types.ts` - COMPLETED
```typescript
export type TypedArtifact =
  | ArtifactWithData<'plot_outline', 'v1', OutlineGenerationOutput>
  // ... existing types
```

## Key Technical Decisions

### 1. Single Brainstorm Idea Focus
**Decision**: Focus context on one specific brainstorm idea for outline generation
**Rationale**: Prevents agent confusion from multiple ideas, improves outline quality
**Implementation**: Filter artifacts in context preparation based on sourceArtifactId

### 2. Inline Form vs Separate Page
**Decision**: Use modal form within BrainstormIdeaEditor
**Rationale**: Maintains workflow continuity, clear idea → outline progression
**Implementation**: Modal with form validation and real-time parameter updates

### 3. Real-time vs Batch Display
**Decision**: Progressive display via Electric SQL as outline streams in
**Rationale**: Consistent with existing brainstorm streaming pattern
**Implementation**: OutlineResults component reactive to artifacts changes

### 4. Agent Integration vs Direct API
**Decision**: Route through agent framework instead of direct outline API
**Rationale**: Consistent with new architecture, enables natural language requests
**Implementation**: Agent tool selection based on request pattern analysis

## Data Flow Architecture

```
User clicks "用这个灵感继续" → 
Modal form (episodes, platform, genre) → 
Agent request with structured parameters → 
Agent analyzes request → 
Selects generate_outline tool → 
Tool extracts brainstorm idea data → 
Renders outline template with context → 
LLM generates outline JSON → 
Creates plot_outline artifact → 
Electric SQL syncs to frontend → 
OutlineResults component displays
```

## Error Handling Strategy

### Backend
1. Schema validation at multiple layers
2. LLM response parsing with fallbacks
3. Transform status tracking with retry capability
4. Detailed error logging for debugging

### Frontend
1. Form validation before submission
2. Loading states during generation
3. Error messages for user feedback
4. Graceful degradation for incomplete data

## Performance Considerations

1. **Context Size**: Filter to single brainstorm idea reduces LLM context size
2. **Template Rendering**: Cache compiled templates for repeated use
3. **Real-time Updates**: Efficient Electric SQL subscriptions
4. **UI Responsiveness**: Progressive loading and optimistic updates

## Security Measures

1. **Authentication**: All outline generation requires valid user session
2. **Authorization**: Users can only generate outlines from owned brainstorm ideas
3. **Input Validation**: Multi-layer validation on all form inputs
4. **Rate Limiting**: Consider implementing to prevent abuse

## Testing Strategy

### Unit Tests
- Schema validation for all input/output types
- Template rendering with various parameter combinations
- Context filtering logic
- Form validation and submission

### Integration Tests  
- End-to-end outline generation workflow
- Electric SQL real-time synchronization
- Agent tool selection and execution
- Error handling and recovery

### User Acceptance Tests
- Outline quality and completeness
- UI responsiveness and feedback
- Cross-browser compatibility
- Mobile device functionality

## Implementation Timeline

### Week 1: Backend Foundation
- Create outline schemas and tool infrastructure
- Implement OutlineTool with template integration
- Update agent framework for outline support
- Test backend outline generation pipeline

### Week 2: Frontend Integration
- Add outline generation form to BrainstormIdeaEditor
- Implement OutlineResults display component
- Update ProjectDataContext for agent requests
- Test frontend-backend integration

### Week 3: Polish & Testing
- Comprehensive testing and bug fixes
- UI/UX refinements and optimizations
- Performance testing and improvements
- Documentation and deployment preparation

## ✅ Phase 5: Legacy Code Cleanup (Post-Implementation) - COMPLETED

**COMPLETED**: Successfully removed all legacy SSE-based outline generation code to maintain codebase clarity and avoid confusion with the new agent-based system.

### ✅ Phase 5 Summary - COMPLETED

**Files Successfully Deleted:**
- ✅ `src/server/routes/outlineRoutes.ts` - Legacy SSE-based outline API routes
- ✅ `src/server/services/OutlineService.ts` - Legacy SSE-based outline generation service  
- ✅ `src/client/components/OutlineInputForm.tsx` - Legacy outline input form
- ✅ `src/client/components/OutlineResults.tsx` - Legacy outline results display
- ✅ `src/client/components/OutlinesList.tsx` - Legacy outline list component
- ✅ `src/client/components/OutlineTab.tsx` - Legacy outline tab component
- ✅ `src/client/components/OutlineParameterSummary.tsx` - Legacy parameter summary
- ✅ `src/client/components/DynamicOutlineResults.tsx` - Legacy dynamic outline results
- ✅ `src/client/services/implementations/OutlineStreamingService.ts` - Legacy SSE streaming service
- ✅ `src/client/hooks/useStreamingOutline.ts` - Legacy outline streaming hook

**Code References Successfully Cleaned:**
- ✅ Removed outline routes registration from `src/server/routes/apiRoutes.ts`
- ✅ Removed OutlineTab imports and routes from `src/client/App.tsx`  
- ✅ Replaced OutlineService type imports in multiple files with simplified local types
- ✅ Updated schema comments to reflect new agent-based system

**Build Verification:**
- ✅ TypeScript compilation successful with no errors
- ✅ All legacy SSE-based outline system completely removed
- ✅ New agent-based outline system remains fully functional

### 5.1 Files to Delete Completely

#### Backend Files
- `src/server/routes/outlineRoutes.ts` - Legacy SSE-based outline API routes
- `src/server/services/OutlineService.ts` - Legacy SSE-based outline generation service
- `src/server/transforms/ideation-stream.ts` - Legacy transform streaming (if outline-specific)

#### Frontend Files  
- `src/client/components/OutlineInputForm.tsx` - Legacy outline input form (replaced by modal in BrainstormIdeaEditor)
- `src/client/components/OutlineResults.tsx` - Legacy outline results display (replaced by new OutlineResults in outline/ folder)
- `src/client/components/OutlinesList.tsx` - Legacy outline list component
- `src/client/components/ModernOutlineResults.tsx` - Legacy "modern" outline results
- `src/client/components/OutlineTab.tsx` - Legacy outline tab component
- `src/client/components/OutlineParameterSummary.tsx` - Legacy parameter summary component
- `src/client/services/implementations/OutlineStreamingService.ts` - Legacy SSE streaming service
- `src/client/hooks/useStreamingOutline.ts` - Legacy outline streaming hook

### 5.2 Code Sections to Remove

#### From `src/server/routes/apiRoutes.ts`
```typescript
// REMOVE: Legacy outline SSE endpoint registration
app.use('/api/outlines', outlineRoutes);
```

#### From `src/server/index.ts`
```typescript
// REMOVE: Any outline SSE endpoint imports and registrations
import outlineRoutes from './routes/outlineRoutes';
```

#### From `src/client/components/ProjectLayout.tsx`
```typescript
// REMOVE: Legacy outline tab and routing
import OutlineTab from './OutlineTab';
import OutlineInputForm from './OutlineInputForm';
import OutlineResults from './OutlineResults';

// REMOVE: Any outline-specific route handling that doesn't use the new system
```

#### From `src/client/App.tsx` or Router Configuration
```typescript
// REMOVE: Legacy outline routes like:
<Route path="/projects/:id/outline" element={<OutlineInputForm />} />
<Route path="/projects/:id/outline/results" element={<OutlineResults />} />
```

### 5.3 References to Clean Up

#### Update `src/server/services/AgentService.ts`
```typescript
// REMOVE: Any references to legacy OutlineService
// REMOVE: Legacy SSE-based outline generation methods
// ENSURE: Only agent-based outline generation remains
```

#### Update Navigation Components
- Remove outline-specific navigation tabs that point to legacy components
- Update breadcrumb components to remove legacy outline page references
- Clean up any hardcoded outline route references

#### Update `package.json` Dependencies
```json
// REVIEW: Remove any SSE-specific dependencies that were only used for outline generation
// Keep only dependencies needed for the new agent-based approach
```

### 5.4 Database Cleanup (Optional)

#### Consider Cleaning Up Legacy Data
```sql
-- OPTIONAL: Remove any legacy outline-specific tables or columns
-- that were only used by the old SSE system
-- CAUTION: Only do this if you're certain the data isn't needed
```

### 5.5 Documentation Updates

#### Update README.md
```markdown
// REMOVE: Any references to legacy SSE-based outline generation
// UPDATE: Status from "⚠️ PENDING" to "✅ COMPLETED" for outline system
// REMOVE: Legacy SSE endpoints from API documentation
```

#### Update Integration Documentation
- Remove any developer guides that reference the old outline system
- Update API documentation to remove legacy `/api/outlines/stream` endpoints
- Clean up any example code that uses the old outline APIs

### 5.6 Testing Cleanup

#### Remove Legacy Test Files
- `src/server/scripts/test-outline-sse.ts` (if exists)
- Any outline-specific SSE testing scripts
- Legacy outline integration tests that test the old system

#### Update Existing Tests
- Remove test cases that validate legacy outline endpoints
- Update integration tests to only test the new agent-based system
- Clean up any mocked SSE outline responses in test files

### 5.7 Configuration Cleanup

#### Environment Variables
```bash
# REMOVE: Any outline-specific SSE configuration
# REMOVE: Legacy outline service endpoints
# CLEAN: Any outline-specific feature flags
```

#### Docker/Deployment Configuration
- Remove any outline-specific SSE service configurations
- Clean up environment variables used only by legacy outline system
- Update health check endpoints to remove legacy outline checks

### 5.8 Verification Checklist

Before removing legacy code, verify:
- [ ] New agent-based outline generation works end-to-end
- [ ] All outline generation flows through the agent framework
- [ ] No UI references to removed components
- [ ] No API calls to removed endpoints
- [ ] All tests pass with new system only
- [ ] Production deployment successful with new system

#### Search Commands for Verification
```bash
# Find any remaining references to legacy outline components
grep -r "OutlineInputForm" src/
grep -r "OutlineService" src/
grep -r "outlineRoutes" src/
grep -r "/api/outlines" src/
grep -r "useStreamingOutline" src/

# Ensure no broken imports after deletion
npm run build
npm run typecheck
```

### 5.9 Migration Strategy

1. **Phase 5A**: Implement and test new outline generation completely
2. **Phase 5B**: Feature flag the legacy system (if needed for gradual rollout)
3. **Phase 5C**: Remove legacy code in a single PR for clean history
4. **Phase 5D**: Update all documentation and tests
5. **Phase 5E**: Deploy and monitor for any issues

**Benefits of Complete Legacy Removal**:
- **Eliminates confusion** between old and new systems
- **Reduces codebase complexity** and maintenance burden
- **Prevents accidental usage** of deprecated endpoints
- **Forces consistent usage** of new agent-based architecture
- **Improves developer experience** with cleaner, focused codebase

This implementation plan provides a complete roadmap for integrating outline generation into the script-writer application while maintaining consistency with existing patterns and architecture, followed by complete cleanup of legacy systems. 