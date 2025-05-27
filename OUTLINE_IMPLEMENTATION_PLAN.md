# Outline Feature Implementation Plan

## Overview
Replace the "生成情節提要" (Generate Plot Outline) functionality with "开始设计大纲" (Start Outline Design), implementing a structured outline generation system that produces 5 separate components using the artifacts and transforms architecture.

## Features to Implement

### 1. **Data Structure Changes**

#### A. New Artifact Types
Add 5 new artifact types to `src/server/types/artifacts.ts`:
```typescript
// Outline component artifacts
export interface OutlineTitleV1 {
    title: string;
}

export interface OutlineGenreV1 {
    genre: string;
}

export interface OutlineSellingPointsV1 {
    selling_points: string;
}

export interface OutlineSettingV1 {
    setting: string;
}

export interface OutlineSynopsisV1 {
    synopsis: string;
}

// Add to type guards and validation functions
```

#### B. Outline Session Container
```typescript
export interface OutlineSessionV1 {
    id: string;
    ideation_session_id: string;  // Link back to original ideation
    status: 'active' | 'completed';
    created_at: string;
}
```

### 2. **Backend Implementation**

#### A. New Service Methods
Add to `src/server/services/IdeationService.ts` (or create new `OutlineService.ts`):
```typescript
// Generate outline from ideation session
async generateOutlineFromIdeation(
    userId: string,
    ideationSessionId: string,
    userInput: string  // Final edited story inspiration
): Promise<{ outlineSessionId: string; artifacts: Artifact[] }>

// Get outline session data
async getOutlineSession(
    userId: string, 
    outlineSessionId: string
): Promise<OutlineSessionData>

// List user's outline sessions  
async listOutlineSessions(userId: string): Promise<OutlineSessionSummary[]>
```

#### B. New API Endpoints
Add to `src/server/index.ts`:
```typescript
// Create outline from ideation
POST /api/outlines/from-ideation/:ideationId
Body: { userInput: string }
Response: { outlineSessionId: string }

// Get outline session
GET /api/outlines/:outlineId
Response: OutlineSessionData

// List outlines
GET /api/outlines  
Response: OutlineSessionSummary[]

// Delete outline
DELETE /api/outlines/:outlineId
```

#### C. LLM Prompt Design
Create outline generation prompt that returns structured JSON:
```json
{
  "title": "剧名",
  "genre": "题材类型", 
  "selling_points": "项目卖点/爽点",
  "setting": "故事设定",
  "synopsis": "故事梗概"
}
```

### 3. **Frontend Implementation**

#### A. Reusable Component: `StoryInspirationEditor.tsx`
```typescript
interface StoryInspirationEditorProps {
    ideationSessionId: string;
    onInputChange?: (value: string, hasChanged: boolean) => void;
    readOnly?: boolean;
}

// Features:
// - Loads latest user_input artifact for ideation session
// - Tracks changes and creates human transforms when modified
// - Handles both brainstorm-generated and manual input
// - Emits current value and change status to parent
```

#### B. Updated `IdeationTab.tsx`
- Replace "生成情節提要" button with "开始设计大纲"
- Use `StoryInspirationEditor` component
- Navigate to `/new-outline?ideation=${ideationRunId}` on button click

#### C. New Component: `OutlineTab.tsx`
```typescript
// URL: /new-outline?ideation=[id] (before generation)
// URL: /outlines/[outline-id] (after generation)

interface OutlineTabProps {}

// Features:
// - Uses StoryInspirationEditor for story inspiration editing
// - Generate outline button
// - Display 5 outline sections after generation
// - Navigation management (URL transitions)
```

#### D. New Component: `OutlineDisplay.tsx`
```typescript
interface OutlineDisplayProps {
    outlineData: {
        title: string;
        genre: string; 
        sellingPoints: string;
        setting: string;
        synopsis: string;
    };
}

// Features:
// - Clean display of 5 outline components
// - Copy/export functionality
// - Edit capabilities (future enhancement)
```

### 4. **Routing Changes**

#### A. Add Routes to `App.tsx`
```typescript
// New outline creation
<Route path="/new-outline" element={
  <ProtectedRoute>
    <OutlineTab />
  </ProtectedRoute>
} />

// Outline session view  
<Route path="/outlines/:id" element={
  <ProtectedRoute>
    <OutlineTab />
  </ProtectedRoute>
} />

// Outline list (future)
<Route path="/outlines" element={
  <ProtectedRoute>
    <OutlinesList />
  </ProtectedRoute>
} />
```

#### B. Update Breadcrumb Navigation
Add outline-related breadcrumb logic in `Breadcrumb.tsx`

### 5. **Data Flow & Navigation**

#### A. User Journey
1. **Ideation Page** (`/ideation/:id`)
   - User has existing ideation with story inspiration
   - Clicks "开始设计大纲" button
   - Navigate to `/new-outline?ideation=${ideationId}`

2. **New Outline Page** (`/new-outline?ideation=[id]`)
   - Loads `StoryInspirationEditor` with existing story inspiration
   - User can edit the inspiration (creates human transform if changed)
   - User clicks "生成大纲" button
   - LLM generates 5 outline components
   - Navigate to `/outlines/${outlineSessionId}`

3. **Outline Session Page** (`/outlines/[outline-id]`)
   - Display story inspiration (read-only)
   - Display 5 outline components
   - Links back to original ideation

#### B. Transform Chain
```
Original Story Inspiration (from ideation)
    ↓ [human transform - if edited]
Edited Story Inspiration  
    ↓ [llm transform]
5 Outline Artifacts (title, genre, selling_points, setting, synopsis)
```

### 6. **Implementation Order**

#### Phase 1: Backend Foundation
1. **Add artifact types** to `artifacts.ts`
2. **Create outline service methods** 
3. **Add API endpoints**
4. **Design and test LLM prompt**

#### Phase 2: Reusable Components
1. **Create `StoryInspirationEditor`** component
2. **Test with existing ideation page**
3. **Update `IdeationTab`** to use new component and button

#### Phase 3: Outline Generation  
1. **Create `OutlineTab`** component
2. **Create `OutlineDisplay`** component
3. **Add routing** for outline pages
4. **Update navigation/breadcrumbs**

#### Phase 4: Integration & Testing
1. **Test complete user flow**
2. **Validate artifact/transform chains**
3. **Error handling and edge cases**
4. **UI/UX polish**

### 7. **Technical Considerations**

#### A. Data Consistency
- Ensure `StoryInspirationEditor` always works with the same underlying artifacts
- Handle concurrent editing scenarios
- Proper error handling for missing ideation sessions

#### B. Performance
- Cache outline sessions for quick loading
- Optimize LLM calls (avoid duplicate generation)
- Efficient artifact querying for outline display

#### C. User Experience
- Loading states during LLM generation
- Clear navigation between ideation and outline phases
- Responsive design for mobile devices

### 8. **Future Enhancements**
- Outline editing capabilities
- Export outline to different formats
- Outline templates/presets
- Collaboration on outline sessions
- Integration with script generation

## Success Criteria
- [x] Users can navigate from ideation to outline generation
- [x] Story inspiration editing creates proper human transforms  
- [x] LLM generates structured outline with 5 components
- [x] All data properly linked via artifacts and transforms
- [x] Clean URL transitions (/new-outline → /outlines/[id])
- [x] Reusable components for story inspiration editing
- [x] Complete replacement of plot generation functionality 