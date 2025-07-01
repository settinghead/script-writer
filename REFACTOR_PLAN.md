# Outline Refactor Plan: Split into Settings & Chronicles

## Overview
Splitting the current chronological outline generation into two sequential steps:
1. **剧本设定 (Outline Settings)** - Everything except chronological stages 
2. **时序大纲 (Chronicles)** - Only the chronological stages

**Workflow**: `brainstorm idea → outline settings → chronicles`

## 📋 Task Checklist

### Phase 1: Schema & Type Definitions
- [ ] **1.1** Split `outlineSchemas.ts` into two schemas
  - [ ] Create `OutlineSettingsInputSchema` and `OutlineSettingsOutputSchema` 
  - [ ] Create `ChroniclesInputSchema` and `ChroniclesOutputSchema`
  - [ ] Update exports and type definitions
- [ ] **1.2** Update `artifacts.ts` schema registry
  - [ ] Add `outline_settings_schema` entry
  - [ ] Add `chronicles_schema` entry
  - [ ] Update `ARTIFACT_SCHEMAS` object
- [ ] **1.3** Update type mappings across codebase
  - [ ] Update `HumanTransformExecutor.ts` schema mapping
  - [ ] Update `artifacts.ts` type guard mappings
  - [ ] Update any other schema type references

### Phase 2: Template System
- [ ] **2.1** Split `outline.ts` template intelligently
  - [ ] Create `outlineSettings.ts` template (everything except stages)
  - [ ] Create `chronicles.ts` template (only chronological stages)
  - [ ] Ensure 去脸谱化 requirements in both templates
- [ ] **2.2** Update `TemplateService.ts`
  - [ ] Register `outline_settings` template
  - [ ] Register `chronicles` template  
  - [ ] Remove old `chronological_outline` template
- [ ] **2.3** Update template variable handling
  - [ ] Ensure outline settings variables are properly extracted
  - [ ] Ensure chronicles can reference outline settings artifact

### Phase 3: Tool Definitions
- [ ] **3.1** Create `OutlineSettingsTool.ts`
  - [ ] Follow existing tool pattern from `BrainstormTools.ts`
  - [ ] Input: brainstorm idea artifact ID
  - [ ] Output: outline settings artifact
  - [ ] Use `outline_settings` template
- [ ] **3.2** Create `ChroniclesTool.ts`
  - [ ] Input: outline settings artifact ID
  - [ ] Output: chronicles artifact
  - [ ] Extract outline settings data for context
  - [ ] Use `chronicles` template
- [ ] **3.3** Update `AgentRequestBuilder.ts`
  - [ ] Add new request types: `outline_settings_generation`, `chronicles_generation`
  - [ ] Update `analyzeRequestType()` function
  - [ ] Update context building functions
  - [ ] Update tool building functions
  - [ ] Update prompt building functions
- [ ] **3.4** Remove old `OutlineTool.ts`

### Phase 4: Agent Integration
- [ ] **4.1** Update `AgentService.ts` success messages
  - [ ] Add success message for outline settings generation
  - [ ] Add success message for chronicles generation
  - [ ] Update existing outline generation message handling
- [ ] **4.2** Test agent integration
  - [ ] Update test files to use new tools
  - [ ] Update cached responses for new workflow

### Phase 5: UI Components & Utilities
- [ ] **5.1** Split `OutlineDisplay.tsx`
  - [ ] Create `OutlineSettingsDisplay.tsx` (title, genre, audience, selling points, setting, characters)
  - [ ] Create `ChroniclesDisplay.tsx` (only chronological stages)
  - [ ] Update artifact filtering logic for new schema types
- [ ] **5.2** Update `ProjectLayout.tsx`
  - [ ] Add separate `TextDivider` for "剧本设定" with `id="outline-settings"`
  - [ ] Add separate `TextDivider` for "时序大纲" with `id="chronicles"`
  - [ ] Import and render both new display components
  - [ ] Remove old outline display
- [ ] **5.3** Update `ProjectTreeView.tsx`
  - [ ] Add separate top-level node for "剧本设定"
  - [ ] Add separate top-level node for "时序大纲"
  - [ ] Update navigation targets: `#outline-settings`, `#chronicles`
  - [ ] Update highlight logic for both sections
  - [ ] Remove old outline tree node
- [ ] **5.4** Update export utilities
  - [ ] Update `outlineExporter.ts` to handle both settings and chronicles
  - [ ] Update `OutlineExportModal.tsx` to properly merge settings + chronicles
  - [ ] Update `episodeExporter.ts` to work with new outline structure
  - [ ] Update `shared/index.ts` exports as needed
- [ ] **5.5** Update hooks and stores
  - [ ] Update `useProjectData.ts` outline-related queries and logic
  - [ ] Update `projectStore.ts` to handle settings and chronicles separately
  - [ ] Update any other hooks that reference outline artifacts

### Phase 6: Navigation & State Management
- [ ] **6.1** Update `useCurrentSection.ts` hook
  - [ ] Add `outline-settings` section type
  - [ ] Add `chronicles` section type  
  - [ ] Update section detection logic
- [ ] **6.2** Update navigation target mappings
  - [ ] Ensure `#outline-settings` and `#chronicles` work correctly
  - [ ] Test smooth scrolling to new sections
- [ ] **6.3** Update any store references
  - [ ] Check `projectStore.ts` for outline-related state
  - [ ] Update if needed for new artifact types

### Phase 7: Agent Chat Integration  
- [ ] **7.1** Update `SingleBrainstormIdeaEditor.tsx`
  - [ ] Update outline generation button to trigger outline settings first
  - [ ] Add UI guidance for sequential generation
- [ ] **7.2** Test chat agent workflow
  - [ ] Ensure agent can handle "生成剧本设定" requests
  - [ ] Ensure agent can handle "生成时序大纲" requests
  - [ ] Test full workflow: brainstorm → settings → chronicles


### Phase 10: Testing & Validation
- [ ] **10.1** Update existing tests
  - [ ] Update `agent-service-integration.test.ts`
  - [ ] Update `end-to-end-workflow.test.ts` 
  - [ ] Update `streaming-workflow.test.ts`
  - [ ] Update any other tests referencing outline generation
- [ ] **10.2** Update test fixtures and mocks
  - [ ] Update `fixtures/artifacts.ts` with new outline schema types
  - [ ] Update `mocks/aiSdkMocks.ts` to provide separate settings/chronicles responses
  - [ ] Create mock data for outline settings and chronicles
  - [ ] Update any other test data files
- [ ] **10.3** Create new tests
  - [ ] Test outline settings generation
  - [ ] Test chronicles generation
  - [ ] Test sequential workflow
- [ ] **10.4** Manual testing
  - [ ] Test complete workflow in browser
  - [ ] Test UI navigation between sections
  - [ ] Test agent chat integration

### Phase 11: Documentation
- [ ] **11.1** Update `README.md`
  - [ ] Update workflow description: 灵感 → 剧本设定 → 时序大纲 → 分集 → 剧本
  - [ ] Update feature descriptions for two-step outline process
  - [ ] Update API reference sections
  - [ ] Update UI/UX documentation sections
- [ ] **11.2** Update `TRANSFORM_ARTIFACT_FRAMEWORK.md`
  - [ ] Add examples showing new artifact types
  - [ ] Update tool documentation
  - [ ] Update schema documentation

## 🗂️ Files to Modify

### Schema & Types (8 files)
- `src/common/schemas/outlineSchemas.ts` ✅ Split schemas
- `src/common/schemas/artifacts.ts` ✅ Add schema registry entries  
- `src/common/types.ts` ✅ Update type definitions
- `src/server/types/artifacts.ts` ✅ Update type mappings
- `src/server/transform-artifact-framework/HumanTransformExecutor.ts` ✅ Update schema mappings
- `src/common/schemas/transforms.ts` ✅ Update if needed
- `src/common/streaming/types.ts` ✅ Update if needed
- `src/common/schemas/streaming.ts` ✅ Update if needed

### Templates & Tools (7 files)  
- `src/server/services/templates/outlineSettings.ts` ✅ Create new
- `src/server/services/templates/chronicles.ts` ✅ Create new
- `src/server/services/templates/TemplateService.ts` ✅ Register new templates
- `src/server/tools/OutlineSettingsTool.ts` ✅ Create new
- `src/server/tools/ChroniclesTool.ts` ✅ Create new
- `src/server/services/AgentRequestBuilder.ts` ✅ Add new request types & tools
- `src/server/tools/OutlineTool.ts` ❌ Remove old

### Agent & Service (2 files)
- `src/server/transform-artifact-framework/AgentService.ts` ✅ Update success messages
- `src/server/services/prompt-tools-gen.ts` ✅ Update if needed

### UI Components (4 files)
- `src/client/components/OutlineSettingsDisplay.tsx` ✅ Create new
- `src/client/components/ChroniclesDisplay.tsx` ✅ Create new  
- `src/client/components/ProjectLayout.tsx` ✅ Add both sections
- `src/client/components/ProjectTreeView.tsx` ✅ Add both tree nodes

### Utilities & Exports (4 files)
- `src/client/utils/outlineExporter.ts` ✅ Update for split data
- `src/client/components/shared/OutlineExportModal.tsx` ✅ Update export handling
- `src/client/utils/episodeExporter.ts` ✅ Update outline references
- `src/client/components/shared/index.ts` ✅ Update exports

### Navigation & Hooks (4 files)
- `src/client/hooks/useCurrentSection.ts` ✅ Add new section types
- `src/client/hooks/useProjectData.ts` ✅ Update outline-related logic
- `src/client/stores/projectStore.ts` ✅ Update store for split artifacts
- `src/client/components/brainstorm/SingleBrainstormIdeaEditor.tsx` ✅ Update UI guidance

### API Services (2 files)
- `src/common/streaming/types.ts` ✅ Update request/response types

### Testing (6 files)
- `src/server/__tests__/agent-service-integration.test.ts` ✅ Update tests
- `src/server/__tests__/end-to-end-workflow.test.ts` ✅ Update tests
- `src/server/__tests__/streaming-workflow.test.ts` ✅ Update tests
- `src/__tests__/fixtures/artifacts.ts` ✅ Update test artifacts
- `src/__tests__/mocks/aiSdkMocks.ts` ✅ Update mock responses
- `src/__tests__/mocks/databaseMocks.ts` ✅ Update if needed

### Documentation (2 files)
- `README.md` ✅ Update application features & workflow
- `TRANSFORM_ARTIFACT_FRAMEWORK.md` ✅ Update framework examples

### Cleanup (2 files)
- `src/client/components/OutlineDisplay.tsx` ❌ Remove old component
- `src/server/tools/OutlineTool.ts` ❌ Remove old tool

## 🔍 Key Considerations

### Schema Splitting Strategy
- **Outline Settings**: title, genre, target_audience, selling_points, satisfaction_points, setting, characters
- **Chronicles**: Only stages/chronological_stages array with emotionArcs, relationshipDevelopments, insights

### Template Content Division
- **Outline Settings Template**: Focus on character development, setting, audience, commercial aspects
- **Chronicles Template**: Focus on time-ordered story progression, stage development, event sequencing

### Agent Tool Dependencies  
- **OutlineSettingsTool**: Takes brainstorm idea as input
- **ChroniclesTool**: Takes outline settings artifact as input + references brainstorm context
- Both tools should include 去脸谱化 requirements

### UI Navigation Flow
- User completes brainstorm ideas
- User generates outline settings first
- User then generates chronicles based on settings
- Two separate sections in UI with clear visual separation

### Backward Compatibility
- Existing outline artifacts may need migration or special handling
- Old URLs/navigation should redirect appropriately
- Test data should support new workflow

---

**Estimated Timeline**: 2-3 days for implementation + 1 day for testing & documentation
**Risk Level**: Medium (significant refactor but well-structured plan)
**Dependencies**: None (can be implemented incrementally) 