# Short-Term Agent Context Reduction Plan

## Rationale

The current agent system in the script-writer project builds a comprehensive context for every request, including all canonical jsondocs computed from the lineage tree. This leads to excessively long prompts (e.g., 23k+ characters), which burdens the LLM (likely Qwen models) and causes issues like incomplete tool executions. For example, after generating episode synopsis for episodes 1-6, attempts to generate 7-12 fail because the added synopsis jsondoc bloats the context, even though the tool works fine in isolation.

This short-term plan focuses on immediately reducing context length by intelligently selecting and optimizing jsondocs based on the user's intent and workflow stage. Drawing from the logic in actionComputation.ts (which computes unified workflow state including display components and actions) and canonicalJsondocLogic.ts (which prioritizes jsondocs by derivation, user input, leaf status, and recency), we'll introduce:
- **Prioritization**: Rank jsondocs by relevance to the inferred intent (e.g., for synopsis generation, prioritize upstream like brainstorm_idea, 剧本设定, chronicles, episode_planning over unrelated or prior synopses).
- **Trimming**: Reduce content in lower-priority jsondocs (e.g., summarize or truncate bodies while preserving structure, with amount based on priority).
- **Capping**: As a last resort, discard lowest-priority jsondocs if the context still exceeds a max limit (e.g., 16k chars) after trimming.

To discern intent, we'll enhance backend requests to pass structured data (e.g., {intent: 'generate_episode_synopsis', params: {...}}) instead of raw text for button-triggered actions. This aligns with the Transform Jsondoc Framework (see TRANSFORM_JSONDOC_FRAMEWORK.md) by maintaining traceability but prioritizing efficiency. No backward compatibility is needed, as we're in dev phase—replace existing logic directly.

The changes will be verifiable via AgentContextView.tsx, which already computes and displays workflow state, canonical context, and filtered tools.

## Changes Required

- **AgentRequestBuilder.ts (src/server/services/AgentRequestBuilder.ts)**: Modify `buildContextForRequestType` to infer intent from user request (keyword matching or structured data) and prioritize/trim jsondocs. Add max length cap with truncation/discarding. Update `buildPromptForRequestType` to use optimized context.
- **CanonicalJsondocLogic.ts (src/common/canonicalJsondocLogic.ts)**: Enhance `computeCanonicalJsondocsFromLineage` to accept `intent` param, filtering and ranking by relevance (e.g., map intents to required types like ['brainstorm_idea', '剧本设定'] for outline-related actions).
- **ActionComputation.ts (src/client/utils/actionComputation.ts)**: Align client-side computation with new prioritization for consistency (e.g., pass intent to unified context computation).
- **AgentContextView.tsx (src/client/components/debug/AgentContextView.tsx)**: Extend to display prioritized jsondocs, trimming details, and cap status (e.g., add sections for "Prioritized Context" and "Discarded Jsondocs").
- **API Routes (e.g., src/server/routes/chatRoutes.ts)**: For button-triggered requests, send structured intent data instead of raw text.
- Remove unnecessary full-context inclusions (e.g., always loading all episode synopses).

## Implementation Steps

1. **Intent Inference and Structured Data**:
   - In frontend (e.g., button handlers in components like EpisodePlanningDisplay.tsx), construct requests with {intent: 'generate_episode_synopsis', userRequest: text, params: {episodeRange: '7-12', ...}}.
   - In backend (AgentRequestBuilder.ts), parse intent if present; fallback to keyword matching (e.g., regex for "generate episodes X-Y").

2. **Prioritization**:
   - In CanonicalJsondocLogic.ts, add intent-to-types mapping (e.g., 'generate_episode_synopsis' => ['brainstorm_idea', '剧本设定', 'chronicles', 'episode_planning']). Filter canonical context to these types, ranking by: 1) Required for intent, 2) Leaf/user_input status, 3) Recency.

   **Algorithm Sketch for Prioritization**:
   ```
   function prioritizeJsondocs(canonicalContext, intent):
       requiredTypes = getRequiredTypesForIntent(intent)  // e.g., ['brainstorm_idea', 'chronicles']
       allJsondocs = extractAllFromContext(canonicalContext)  // Flatten to array
       
       // Step 1: Filter to relevant types
       relevant = allJsondocs.filter(j => requiredTypes.includes(j.schema_type))
       
       // Step 2: Score each (higher score = higher priority)
       scored = relevant.map(j => {
           score = 0
           if isRequiredForIntent(j.schema_type, intent): score += 10  // Core for task
           if j.isLeaf: score += 5                           // Prefer leaf nodes
           if j.origin_type == 'user_input': score += 3       // Prefer user edits
           score += (now - j.created_at) / someNormalizer     // Recency boost (newer higher)
           return {jsondoc: j, score}
       })
       
       // Step 3: Sort descending by score
       return scored.sort((a, b) => b.score - a.score).map(s => s.jsondoc)
   ```

3. **Trimming**:
   - Add `trimJsondocContent(jsondoc, priority)` function: For high-priority, keep full; medium: summarize bodies (e.g., truncate to 500 chars); low: keep only metadata. Apply based on rank (e.g., top 4 full, next 2 summarized).

   **Algorithm Sketch for Trimming**:
   ```
   function trimJsondocContent(jsondoc, rank, totalCount):  // rank 0 = highest priority
       if rank < 4: return jsondoc  // Top 4: full content
       
       trimmed = deepClone(jsondoc)
       data = trimmed.data  // Assume parsed JSON
       
       // Medium priority: truncate long fields
       if rank < totalCount / 2:
           for key in data:
               if isString(data[key]) and data[key].length > 500:
                   data[key] = data[key].substring(0, 500) + ' [truncated]'
       
       // Low priority: keep only metadata/structure
       else:
           for key in data:
               if isObject(data[key]) or isArray(data[key]):
                   data[key] = { summary: `Original had ${Object.keys(data[key]).length} items` }
               elif isString(data[key]):
                   data[key] = data[key].substring(0, 100) + ' [summarized]'
       
       trimmed.data = data
       trimmed.metadata.trimmed = true
       return trimmed
   ```

4. **Capping**:
   - In buildContextForRequestType, build context string from prioritized/trimmed jsondocs. If >16k chars, iteratively discard lowest-priority until under limit, logging discards.

   **Algorithm Sketch for Capping**:
   ```
   function capContext(prioritizedJsondocs, maxChars=16000):
       currentContext = ""
       included = []
       
       for jsondoc in prioritizedJsondocs:
           trimmed = trimJsondocContent(jsondoc, included.length, prioritizedJsondocs.length)
           addition = stringifyForContext(trimmed)  // Convert to prompt string
           
           if len(currentContext) + len(addition) > maxChars:
               // Cap reached - discard this and all lower
               log("Capped: discarded " + (prioritizedJsondocs.length - included.length) + " jsondocs")
               break
           
           currentContext += addition
           included.push(jsondoc.id)
       
       return currentContext
   ```

5. **Frontend Alignment and Debugging**:
   - Mirror prioritization in actionComputation.ts for client-side consistency.
   - In AgentContextView.tsx, add views for intent, prioritized jsondocs (with trim indicators), and cap logs (e.g., "Context capped: discarded 2 jsondocs").

6. **Logging and Testing**:
   - Log intent, priorities, trims, and caps in AgentService.ts.
   - Test: Generate 7-12 synopsis; verify context excludes 1-6 synopsis, trims if needed, and executes via AgentContextView.tsx.

## Potential Impact and Testing Notes
- **Impact**: Reduces prompt tokens by 20-50%+ for synopsis tasks via smarter selection/trimming, improving reliability and cost. Enhances intent handling for better UX.
- **Testing**: Use `./run-ts src/server/scripts/extract-lineage-tree.ts <project-id>` to verify lineage. Test with `npm test -- --run`. Debug in AgentContextView.tsx (examine prioritized/trimmed context). Access via https://localhost:4610. 