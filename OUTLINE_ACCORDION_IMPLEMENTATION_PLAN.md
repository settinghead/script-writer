# Outline Accordion Refactor Implementation Plan

## Overview
Refactor the outline generation to use a two-panel layout with a left sidebar accordion (similar to `ScriptLayout`) that provides navigation to different outline sections and episode structure. The right panel will display the content based on the selected section.

## Current Architecture Analysis

### Current Routing Structure
```
/outlines/:id              → OutlineTab (outline session view)
/scripts/:scriptId         → ScriptLayout (episode generation, scriptId = outline session ID)
/scripts/:scriptId/stages/:stageId → Stage details
/scripts/:scriptId/stages/:stageId/episodes/:episodeId → Episode details
/scripts/:scriptId/stages/:stageId/episodes/:episodeId/script → Script display/editing
```

### Key Relationship
- **Outline Session ID** = **Project ID** (when transitioning to episode generation)
- Episodes reference `outlineSessionId` which equals the project ID
- The outline session becomes the project when episodes are generated

## New Hierarchical Routing Structure

### Root Level: `/projects/:id` 
Where `id` is the outline session ID (which becomes the project ID)

### Route Hierarchy
```
/projects/:id                                          → Main layout with accordion
/projects/:id/outline                                 → Default outline view (all sections)
/projects/:id/outline/title                           → Outline with title section highlighted
/projects/:id/outline/genre                           → Outline with genre section highlighted  
/projects/:id/outline/target-audience                 → Outline with target audience section highlighted
/projects/:id/outline/selling-points                  → Outline with selling points section highlighted
/projects/:id/outline/satisfaction-points             → Outline with satisfaction points section highlighted
/projects/:id/outline/setting                         → Outline with setting section highlighted
/projects/:id/outline/synopsis-stages                 → Outline with synopsis stages section highlighted
/projects/:id/outline/characters                      → Outline with characters section highlighted
/projects/:id/episodes                                → Episode structure (current ScriptLayout functionality)
/projects/:id/stages/:stageId                         → Stage details (existing)
/projects/:id/stages/:stageId/episodes/:episodeId     → Episode details (existing)
/projects/:id/stages/:stageId/episodes/:episodeId/script → Individual episode script display/editing
```

## Implementation Plan

### Phase 1: Create New Layout Component

#### 1.1 Create `ProjectLayout.tsx`
**File**: `src/client/components/ProjectLayout.tsx`

A new layout component that combines outline and episode functionality:

```typescript
interface ProjectLayoutProps {
  projectId: string; // This is the outline session ID
}

const ProjectLayout: React.FC<ProjectLayoutProps> = ({ projectId }) => {
  // State for accordion expansion and tree selection
  // Left panel: Accordion with "大纲" and "剧集结构" 
  // Right panel: Content based on route
}
```

**Left Panel Structure:**
- **大纲 (Outline)** - Accordion panel
  - 剧本标题 (Title)
  - 剧本类型 (Genre)
  - 目标受众 (Target Audience)
  - 产品卖点 (Selling Points)
  - 情感爽点 (Satisfaction Points)
  - 故事设定 (Setting)
  - 分段故事梗概 (Synopsis Stages)
  - 角色设定 (Characters)

- **剧集结构 (Episode Structure)** - Accordion panel
  - Tree view with stages and episodes (reuse from `ScriptLayout`)

**Right Panel:**
- Shows `OutlineResults` component when outline sections are selected
- Shows episode content when episode sections are selected

#### 1.2 Accordion Tree Implementation

Use Antd's `Collapse` component with custom tree nodes:

```typescript
const accordionItems = [
  {
    key: 'outline',
    label: '大纲',
    children: (
      <Tree
        treeData={outlineTreeData}
        onSelect={onOutlineTreeSelect}
        selectedKeys={selectedKeys}
        className="outline-tree"
        showIcon={false}
      />
    )
  },
  {
    key: 'episodes', 
    label: '剧集结构',
    children: (
      <Tree
        treeData={episodeTreeData}
        onSelect={onEpisodeTreeSelect}
        expandedKeys={expandedKeys}
        onExpand={onExpand}
        className="episode-tree"
      />
    )
  }
]
```

### Phase 2: Update Routing

#### 2.1 Update App.tsx Routes
**File**: `src/client/App.tsx`

Replace the current outline routes with the new hierarchical structure:

```typescript
// Remove these routes:
// <Route path="/outlines/:id" element={<OutlineTab />} />

// Add new routes:
<Route path="/projects/:id/*" element={
  <ProtectedRoute>
    <ProjectLayout />
  </ProtectedRoute>
} />

// Keep existing:
<Route path="/new-outline" element={<OutlineTab />} />
<Route path="/outlines" element={<OutlineTab />} />
```

#### 2.2 Create Nested Route Structure
**File**: `src/client/components/ProjectLayout.tsx`

Handle nested routes within the layout:

```typescript
<Routes>
  {/* Default route - show all outline sections */}
  <Route index element={<Navigate to="outline" replace />} />
  
  {/* Outline routes */}
  <Route path="outline" element={<OutlineView />} />
  <Route path="outline/:section" element={<OutlineView />} />
  
  {/* Episode routes - reuse existing ScriptLayout logic */}
  <Route path="episodes" element={<EpisodeView />} />
  <Route path="stages/:stageId" element={<StageDetailView />} />
  <Route path="stages/:stageId/episodes/:episodeId" element={<EpisodeDetailView />} />
  <Route path="stages/:stageId/episodes/:episodeId/script" element={<ScriptDisplayPage />} />
</Routes>
```

### Phase 3: Modify OutlineResults Component

#### 3.1 Add Section Scrolling
**File**: `src/client/components/OutlineResults.tsx`

Add scroll targets and highlighting without major refactoring:

```typescript
// Add ref for each section
const titleRef = useRef<HTMLDivElement>(null);
const genreRef = useRef<HTMLDivElement>(null);
const targetAudienceRef = useRef<HTMLDivElement>(null);
// ... other refs

// Add scroll function  
const scrollToSection = (section: string) => {
  const refs = {
    'title': titleRef,
    'genre': genreRef,
    'target-audience': targetAudienceRef,
    'selling-points': sellingPointsRef,
    'satisfaction-points': satisfactionPointsRef,
    'setting': settingRef,
    'synopsis-stages': synopsisStagesRef,
    'characters': charactersRef
  };
  
  refs[section]?.current?.scrollIntoView({ 
    behavior: 'smooth',
    block: 'start'
  });
};

// Expose via prop or context
useImperativeHandle(ref, () => ({
  scrollToSection
}));

// Add section highlighting
const [activeSection, setActiveSection] = useState<string>('');

// Wrap each section with ref and highlight
<div ref={titleRef} className={activeSection === 'title' ? 'highlighted-section' : ''}>
  {/* Title content */}
</div>
```

#### 3.2 Add CSS for Section Highlighting
**File**: `src/client/index.css`

```css
.highlighted-section {
  outline: 2px solid #1890ff;
  outline-offset: 4px;
  border-radius: 6px;
  transition: outline 0.3s ease;
}

.outline-tree .ant-tree-node-selected .ant-tree-title {
  background-color: #1890ff !important;
  color: white !important;
}

.episode-tree .ant-tree-node-selected .ant-tree-title {
  background-color: #52c41a !important;  
  color: white !important;
}
```

### Phase 4: Update Navigation Links

#### 4.1 Update OutlinesList
**File**: `src/client/components/OutlinesList.tsx`

Change navigation to use new route structure:

```typescript
const handleViewOutline = (sessionId: string) => {
  navigate(`/projects/${sessionId}/outline`);
};
```

#### 4.2 Update DynamicOutlineResults
**File**: `src/client/components/DynamicOutlineResults.tsx`

Update the "开始每集撰写" button:

```typescript
const handleGenerateEpisodes = () => {
  navigate(`/projects/${sessionId}/episodes`);
};
```

#### 4.3 Update Breadcrumbs
**File**: `src/client/components/Breadcrumb.tsx`

Add breadcrumb support for the new route structure:

```typescript
else if (location.pathname.startsWith('/projects/')) {
  const pathParts = location.pathname.split('/');
  const projectId = pathParts[2];
  const section = pathParts[3];
  
  items.push({
    title: '创作工作台',
    icon: <HistoryOutlined />,
    onClick: () => navigate('/ideations')
  });
  
  if (section === 'outline') {
    items.push({
      title: `大纲详情 (${projectId.slice(0, 8)}...)`,
      icon: <FileTextOutlined />
    });
  } else if (section === 'episodes') {
    items.push({
      title: `剧集结构 (${projectId.slice(0, 8)}...)`,
      icon: <PlayCircleOutlined />
    });
  }
}
```

### Phase 5: Data Integration

#### 5.1 Reuse Existing Data Services
The new layout will reuse existing services:

- **Outline data**: Continue using `OutlineService.getOutlineSession()`
- **Episode data**: Continue using existing episode services
- **Streaming**: Continue using existing streaming services

#### 5.2 Context Sharing
Consider creating a shared context for the layout:

```typescript
interface ProjectContextType {
  projectId: string;
  outlineData: OutlineSessionData | null;
  episodeData: EpisodeGenerationSessionData[] | null;
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const ProjectContext = createContext<ProjectContextType>();
```

### Phase 6: Styling and UX

#### 6.1 Layout Dimensions
- **Left Panel**: Fixed width ~400px (same as ScriptLayout)
- **Right Panel**: Flexible width
- **Accordion**: Collapsible panels with smooth transitions
- **Tree Items**: Clear hover and selection states

#### 6.2 Responsive Design
- On mobile: Collapse left panel to drawer (similar to existing mobile navigation)
- Maintain current responsive behavior from OutlineResults

### Phase 7: Testing and Migration

#### 7.1 Backward Compatibility
During transition period, support both route patterns:
- Old: `/outlines/:id` → redirect to `/projects/:id/outline`
- New: `/projects/:id/outline` → primary route

#### 7.2 URL Migration
Add redirect logic in App.tsx:

```typescript
<Route path="/outlines/:id" element={
  <Navigate to="/projects/:id/outline" replace />
} />
```

## Updated Implementation Order

### Core Implementation (Phases 1-7)
1. **Phase 1**: Create `ProjectLayout` component with basic accordion structure
2. **Phase 2**: Update routing and test navigation
3. **Phase 3**: Add scroll-to-section functionality to `OutlineResults`
4. **Phase 4**: Update all navigation links and breadcrumbs
5. **Phase 5**: Test data integration and streaming
6. **Phase 6**: Polish styling and responsive design
7. **Phase 7**: Add migration redirects and cleanup

### Extended Implementation (Phases 8-12)
8. **Phase 8**: Component consolidation - merge `ScriptLayout`, refactor contexts
9. **Phase 9**: Complex route handling - dynamic redirects, parameter preservation
10. **Phase 10**: State management refactor - unified context, cross-section data sharing
11. **Phase 11**: Comprehensive testing - route matrix, streaming continuity, state persistence
12. **Phase 12**: Gradual deployment - feature flags, A/B testing, user migration

### Critical Path Dependencies
```
Phase 1 → Phase 2 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12
     ↓         ↓         ↓         ↓          ↓
Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

**Parallel Execution:**
- Phases 3-7 can run in parallel with Phase 8
- Phase 9-10 depend on Phase 8 completion
- Phase 11 requires all previous phases
- Phase 12 is deployment-only

## Key Benefits

1. **Unified Navigation**: Single interface for both outline and episode management
2. **Better UX**: Quick navigation between outline sections
3. **Consistent Design**: Matches existing ScriptLayout pattern
4. **Minimal Changes**: Reuses existing OutlineResults component with minimal modifications
5. **Future Extensibility**: Easy to add more navigation sections

## Missing Components and Additional Requirements

### Frontend Components Requiring Updates

#### 8.1 Navigation Components
**Files to Update:**
- `src/client/components/ScriptsList.tsx` - Change `navigate(\`/scripts/${script.id}\`)` to `navigate(\`/projects/${script.id}/episodes\`)`
- `src/client/components/HomePage.tsx` - Update tab navigation if needed
- `src/client/components/IdeationTab.tsx` - Update `navigate('/new-outline')` links
- All test files that use old routing patterns

#### 8.2 Context and State Management
**Files to Update:**
- `src/client/contexts/EpisodeContext.tsx` - Update all API calls and navigation
- `src/client/services/apiService.ts` - Ensure APIs don't hardcode route patterns
- `src/client/services/scriptService.ts` - Already uses relative API paths (good)

#### 8.3 Complex Route Migrations
**Critical Routes to Handle:**
```typescript
// OLD → NEW mappings
/outlines/:id → /projects/:id/outline
/scripts/:scriptId → /projects/:scriptId/episodes  
/scripts/:scriptId/stages/:stageId → /projects/:scriptId/stages/:stageId
/scripts/:scriptId/stages/:stageId/episodes/:episodeId → /projects/:scriptId/stages/:stageId/episodes/:episodeId
/scripts/:scriptId/stages/:stageId/episodes/:episodeId/script → /projects/:scriptId/stages/:stageId/episodes/:episodeId/script
```

#### 8.4 Component Consolidation
**Files to Merge/Refactor:**
- `src/client/components/ScriptLayout.tsx` - Merge episode functionality into `ProjectLayout`
- `src/client/components/EpisodeGenerationPage.tsx` - May become redundant 
- `src/client/components/OutlineTab.tsx` - Split outline viewing vs. list functionality

### Backend API Impact Analysis

#### 8.5 WebSocket and Streaming Services
**Files to Review:**
- `src/server/services/streaming/StreamingTransformExecutor.ts` - Uses session IDs, should be OK
- WebSocket room naming patterns - Currently uses user-based rooms, should be fine
- Streaming services use transform IDs, independent of routes

#### 8.6 API Endpoints Analysis
**Backend APIs that are Route-Independent (✅ OK):**
- `/api/episodes/*` - Uses stage/episode IDs, not route patterns
- `/api/scripts/*` - Uses episode/stage IDs, not route patterns  
- `/api/outlines/*` - Uses session IDs, not route patterns
- All artifact and transform APIs use UUIDs

#### 8.7 Session ID Relationships
**Critical Data Flow Validation:**
- Outline Session ID = Project ID ✅
- Episode Generation Sessions reference `outlineSessionId` ✅
- Script artifacts reference `episodeGenerationSessionId` ✅
- All relationships maintained through UUIDs, not routes ✅

### Additional Implementation Phases

#### Phase 8: Component Consolidation
**8.1 Merge ScriptLayout into ProjectLayout**
- Move episode tree logic from `ScriptLayout` to `ProjectLayout`
- Combine outline and episode navigation in single accordion
- Preserve all existing episode functionality

**8.2 Update EpisodeContext**
- Review all `navigate()` calls in `EpisodeContext` 
- Update tree selection handlers for new routes
- Ensure WebSocket connections still work

**8.3 Refactor OutlineTab**
- Split into `OutlineInputForm` (for creation) and main layout
- Move outline viewing logic to `ProjectLayout`

#### Phase 9: Complex Route Handling
**9.1 Dynamic Redirects**
```typescript
// In App.tsx - handle dynamic redirects
<Route path="/outlines/:id" element={
  <Navigate to={`/projects/${useParams().id}/outline`} replace />
} />
<Route path="/scripts/:scriptId" element={
  <Navigate to={`/projects/${useParams().scriptId}/episodes`} replace />
} />
```

**9.2 URL Parameter Preservation**
- Maintain query parameters during redirects
- Preserve streaming transform IDs
- Handle browser back/forward correctly

#### Phase 10: State Management Refactor
**10.1 Create ProjectContext**
```typescript
interface ProjectContextType {
  projectId: string;
  activeSection: 'outline' | 'episodes';
  outlineData: OutlineSessionData | null;
  episodeContext: EpisodeContextType;
  setActiveSection: (section: 'outline' | 'episodes') => void;
}
```

**10.2 Context Composition**
- Wrap both outline and episode contexts
- Handle cross-section data sharing
- Manage unified loading states

### Testing Strategy

#### Phase 11: Comprehensive Testing
**11.1 Route Testing Matrix**
```bash
# Test all old routes redirect correctly
/outlines/session-123 → /projects/session-123/outline
/scripts/session-123 → /projects/session-123/episodes
/scripts/session-123/stages/stage-456/episodes/1 → /projects/session-123/stages/stage-456/episodes/1
/scripts/session-123/stages/stage-456/episodes/1/script → /projects/session-123/stages/stage-456/episodes/1/script
```

**11.2 Streaming Continuity Testing**
- Test outline streaming in new layout
- Test episode generation streaming
- Test script generation streaming
- Verify WebSocket reconnection

**11.3 State Persistence Testing**
- Browser refresh during streaming
- Back/forward navigation
- URL sharing and bookmarking

### Deployment Strategy

#### Phase 12: Gradual Migration
**12.1 Feature Flag Support**
```typescript
// Add feature flag for new layout
const useNewProjectLayout = process.env.REACT_APP_NEW_LAYOUT === 'true';

<Route path="/projects/:id/*" element={
  useNewProjectLayout ? <ProjectLayout /> : <LegacyRedirect />
} />
```

**12.2 A/B Testing Support**
- Allow users to opt-in to new layout
- Maintain old routes during transition
- Gradual user migration

## Risk Mitigation

1. **Route Breaking**: Add comprehensive redirects for old URLs
2. **State Management**: Use existing context patterns to avoid state conflicts  
3. **Performance**: Lazy load episode data only when accordion is expanded
4. **Mobile UX**: Test accordion behavior on small screens
5. **WebSocket Continuity**: Ensure streaming sessions survive route changes
6. **Data Consistency**: Validate all UUID-based relationships remain intact
7. **Backward Compatibility**: Support old URLs during transition period
8. **Context Conflicts**: Carefully manage nested context providers 