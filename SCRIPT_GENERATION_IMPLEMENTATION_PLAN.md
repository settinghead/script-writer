# Script Generation Implementation Plan

## Overview
Implement script generation for 短剧 (short dramas) following the existing artifact/transform pattern used for synopsis and outline generation.

## 1. Data Flow & Architecture

### Input Sources
- **Episode Synopsis**: Primary input from `EpisodeSynopsisV1`
- **Cascaded Parameters**: Platform, genre, episode duration, total episodes
- **Outline Context**: Character details, setting, tone
- **User Requirements**: New textarea input for last-minute instructions

### Artifact Structure
```typescript
interface EpisodeScriptV1 {
  episodeNumber: number;
  stageArtifactId: string;
  episodeGenerationSessionId: string;
  
  // Script content
  scriptContent: string;
  scenes: SceneV1[];
  
  // Metadata
  wordCount: number;
  estimatedDuration: number; // in minutes
  generatedAt: string;
  
  // Source references
  episodeSynopsisArtifactId: string;
  userRequirements?: string;
}

interface SceneV1 {
  sceneNumber: number;
  location: string;
  timeOfDay: string;
  characters: string[];
  action: string;
  dialogue: DialogueLineV1[];
}

interface DialogueLineV1 {
  character: string;
  line: string;
  direction?: string; // action/emotional direction
}
```

## 2. Backend Implementation

### 2.1 New Router: `scriptRoutes.ts`
- Separate from episodes router to keep it manageable
- Route: `POST /api/scripts/generate`
- Route: `GET /api/scripts/:scriptId`
- Route: `PUT /api/scripts/:scriptId` (for future editing)

### 2.2 Service: `ScriptGenerationService.ts`
```typescript
class ScriptGenerationService {
  async generateScript(
    userId: string,
    episodeId: string,
    stageId: string,
    userRequirements?: string
  ): Promise<{ transformId: string; sessionId: string }>

  async getGeneratedScript(
    userId: string, 
    scriptId: string
  ): Promise<EpisodeScriptV1>
}
```

### 2.3 Template: `script_generation.md`
- Emphasize 短剧 format (different from movies/TV series)
- Include episode duration context
- Character consistency from outline
- Platform-specific requirements
- Genre-appropriate tone

### 2.4 Streaming Support
- Follow existing `StreamingTransformExecutor` pattern
- Stream script generation progress
- Support stop/cancel functionality

## 3. Frontend Implementation

### 3.1 Update `EpisodeScriptGeneration.tsx`
- Add user requirements textarea
- Implement actual generation (remove placeholder)
- Navigate to script display page after generation
- Show loading states

### 3.2 New Component: `ScriptDisplayPage.tsx`
- Read-only Slate editor for now
- Display generated script with proper formatting
- Show metadata (word count, duration, etc.)
- Breadcrumb navigation
- Future: Edit capabilities

### 3.3 Update Tree Status Icons
- Modify `ScriptLayout.tsx` to check script generation status
- Show spinner icon while generating scripts
- Show green checkmark when script is complete
- Update episode status logic in tree building

### 3.4 Route Updates
- Add new route: `/scripts/:scriptId/stages/:stageId/episodes/:episodeId/script`
- Update navigation in `EpisodeScriptGeneration.tsx`

## 4. Template Content Strategy

### 4.1 短剧 Format Specifics
- Emphasize quick pacing and hook-driven content
- Platform-specific constraints (抖音, 快手, etc.)
- Episode duration adherence (1-3 minutes typical)
- Vertical video considerations
- Mobile viewing optimization

### 4.2 Context Integration
- Episode synopsis as primary source
- Character details from outline
- Previous episodes context (for continuity)
- Platform and genre requirements
- User's final instructions

## 5. Implementation Order

1. **Backend Foundation**
   - Create `scriptRoutes.ts`
   - Implement `ScriptGenerationService.ts`
   - Add script generation template
   - Update server index to mount new routes

2. **Database & Types**
   - Add `EpisodeScriptV1` interface to common types
   - Update artifact repository if needed

3. **Frontend Updates**
   - Update `EpisodeScriptGeneration.tsx` form
   - Create `ScriptDisplayPage.tsx`
   - Update routing in `ScriptLayout.tsx`
   - Update tree status logic

4. **Integration & Testing**
   - Test full generation flow
   - Verify cascaded parameters work
   - Test streaming and status updates
   - Ensure proper navigation

## 6. Key Technical Considerations

### 6.1 Template Requirements
- Use `%%params.episodeDuration%%` for duration context
- Include character consistency requirements
- Platform-specific formatting instructions
- 短剧 pacing and structure guidelines

### 6.2 Status Management
- Track script generation status in episode context
- Update tree icons based on script existence
- Handle generation failures gracefully

### 6.3 Performance
- Stream large script content efficiently
- Handle long scripts without UI blocking
- Proper loading states throughout

## 7. Future Enhancements (Not in Initial Implementation)
- Script editing with auto-save
- Export to various formats
- Collaboration features
- Version history
- AI-powered script improvement suggestions

---

This plan ensures consistency with existing patterns while implementing a robust script generation system specifically tailored for 短剧 format and requirements. 