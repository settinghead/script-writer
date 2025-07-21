# Long-Term Context Caching and History Reconstruction Plan

## Rationale

The script-writer project uses Qwen models (via LLM config), but prompts aren't optimized for Qwen's Context Cache, leading to inefficient repeated computations (e.g., shared jsondocs aren't cached as prefixes). Additionally, for multi-batch tasks like episode synopsis generation (e.g., 1-6 then 7-12), we lack a way to reconstruct and append to prior LLM conversation history, forcing full re-contextualization each time. This causes failures in agent tool execution due to bloated contexts and misses caching opportunities (cached tokens cost 40% of input tokens, per [Context Cache](https://help.aliyun.com/zh/model-studio/context-cache)).

**Explicit Goal**: Ensure all episode synopsis generations leverage Qwen's Context Cache by restoring the exact conversation history from the DB, appending a new user message with instructions for the next group (e.g., episode range and title), and sending the updated history to the agent LLM. The LLM will then call the `generate_episode_synopsis` tool with the new parameters, enabling efficient continuations while reusing cached prefixes for shared context (e.g., upstream jsondocs).

This long-term plan introduces:
- Prompt restructuring for cache-friendly prefixes.
- Full conversation history storage, linked to lineage tree via toolCallId.
- Reconstruction for continuations (e.g., append to 1-6 history for 7-12).
- Integration with Transform Jsondoc Framework for traceability.

No backward compatibility needed—replace existing storage/logic. Follow repo rules: Use repository pattern, Zod schemas, and project-based access.

## Changes Required

- **EpisodeSynopsis.ts (src/server/services/templates/episodeSynopsis.ts)**: Restructure prompt template to put fixed content (jsondocs, instructions) first, variables (params) last for caching.
- **ChatMessageRepository.ts (src/server/transform-jsondoc-framework/ChatMessageRepository.ts)**: Add methods for conversation grouping and reconstruction. New table `chat_conversations` (migration needed).
- **TransformRepository.ts (src/server/transform-jsondoc-framework/TransformRepository.ts)**: Add `tool_call_id` field to transforms for linking to messages.
- **AgentService.ts (src/server/transform-jsondoc-framework/AgentService.ts)**: Enhance `runGeneralAgent` to check for existing history and append for continuations. Use multi-message arrays for LLM calls.
- **EpisodeSynopsisTool.ts (src/server/tools/EpisodeSynopsisTool.ts)**: Modify `execute` to reconstruct/append history if prior batches exist.
- **Migrations (src/server/database/migrations/)**: New migration for `tool_call_id` in transforms and `chat_conversations` table.

## Implementation Steps

1. **Database Changes**:
   - Create migration: Add `tool_call_id varchar(255)` to `transforms` table. Create `chat_conversations` table with `id uuid`, `project_id uuid`, `tool_name text`, `created_at timestamp`, `messages jsonb[]` (array of raw messages).
   - Run `./run-ts src/server/scripts/migrate.ts`.

2. **Prompt Restructuring for Caching**:
   - In `episodeSynopsis.ts`, move `%%jsondocs%%` and fixed instructions to the prompt start, per [Context Cache](https://help.aliyun.com/zh/model-studio/context-cache). Ensure prefixes >=256 tokens for caching eligibility.

3. **History Storage**:
   - In `AgentService.ts`, after tool execution, group messages by `toolCallId` and store in `chat_conversations` via new repo method (e.g., `saveConversation(toolCallId, projectId, toolName, messages)`). For episode synopsis, store the full LLM input/output as a multi-message array.

4. **Reconstruction Logic**:
   - In `ChatMessageRepository.ts`, implement `reconstructHistoryForAction(toolName, projectId, params)`: Query prior conversations for toolName (e.g., 'generate_episode_synopsis'), sort by created_at, reconstruct the exact multi-message history, and append a new user message (e.g., {role: 'user', content: `Generate the next episode synopsis group: ${JSON.stringify(params)}`}).
   - In `EpisodeSynopsisTool.ts`, check for prior synopsis conversations (e.g., by groupTitle or episodes). If found, reconstruct the history and pass as multi-message array to LLM via `executeStreamingTransform` (add `conversationHistory` param). This ensures caching of shared prefixes.

5. **Integration in Agent**:
   - In `AgentService.ts`, before streaming, check if request is a continuation (e.g., keyword "continue" or matching tool/params). If yes, reconstruct history and use multi-message prompt. The agent LLM will process the appended message and call `generate_episode_synopsis` with new params (e.g., episodes 7-12).

6. **Testing**:
   - Generate 1-6 synopsis, then 7-12 as continuation—verify cache hits via logs (`cached_tokens` in LLM response) and successful tool call.
   - Use `inspect-content.ts` for jsondocs, `RawChatMessages.tsx` for history verification.

## Potential Impact and Testing Notes
- **Impact**: Improves efficiency (e.g., 30%+ cost savings via caching), enables seamless continuations. Aligns with framework by linking to transforms/jsondocs. Achieves the goal of history-based caching for all synopsis generations.
- **Testing**: Use `npm test -- --run` for new methods. Debug with `./run-ts src/server/scripts/extract-lineage-tree.ts <project-id>` and `inspect-content.ts`. Ensure Qwen caching works by checking response `usage.prompt_tokens_details.cached_tokens` and confirm LLM successfully calls the tool after history append. 