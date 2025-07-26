# Long-Term Context Caching and History Reconstruction Plan

## Rationale

The script-writer project uses Qwen models (via LLM config), but prompts aren't optimized for Qwen's Context Cache, leading to inefficient repeated computations (e.g., shared jsondocs aren't cached as prefixes). Additionally, for multi-batch tasks like episode synopsis generation (e.g., 1-6 then 7-12), we lack a way to reconstruct and append to prior LLM conversation history, forcing full re-contextualization each time. This causes failures in agent tool execution due to bloated contexts and misses caching opportunities (cached tokens cost 40% of input tokens, per [Context Cache](https://help.aliyun.com/zh/model-studio/context-cache)).

**Explicit Goal**: Ensure all episode synopsis generations leverage Qwen's Context Cache by restoring the exact conversation history from the DB, appending a new user message with instructions for the next group (e.g., episode range and title), and sending the updated history to the agent LLM. The LLM will then call the `generate_单集大纲` tool with the new parameters, enabling efficient continuations while reusing cached prefixes for shared context (e.g., upstream jsondocs).

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

   **Algorithm Sketch for Prompt Restructuring**:
   ```
   function restructurePrompt(template):
       sections = splitTemplateIntoSections(template)  // Split by markers like ## 任务
       
       // Identify fixed (cacheable) and variable sections
       fixed = sections.filter(s => !s.contains('%%params%%') and s.isReferenceMaterial())  // e.g., 参考资料, 创作要求
       variable = sections.filter(s => s.contains('%%params%%') or s.isOutputSpecific())  // e.g., 生成参数
       
       // Reorder: fixed first, then variable
       restructured = fixed.concat(variable)
       
       // Ensure min length for caching
       prefixLength = calculateLength(fixed.join('\n'))
       if prefixLength < 256:
           addPaddingToFixed(fixed)  // e.g., expand instructions or add comments
       
       return restructured.join('\n')
   ```

3. **History Storage**:
   - In `AgentService.ts`, after tool execution, group messages by `toolCallId` and store in `chat_conversations` via new repo method (e.g., `saveConversation(toolCallId, projectId, toolName, messages)`). For episode synopsis, store the full LLM input/output as a multi-message array.

   **Algorithm Sketch for History Storage**:
   ```
   function saveConversation(toolCallId, projectId, toolName, rawMessages):
       // Group messages by toolCallId
       conversation = rawMessages.filter(m => m.metadata.toolCallId == toolCallId)
       
       // Sort chronologically
       sorted = conversation.sort((a, b) => a.created_at - b.created_at)
       
       // Convert to multi-message format (role/content pairs)
       messagesArray = sorted.map(m => ({role: m.role, content: m.content}))
       
       // Store in DB
       db.insert('chat_conversations', {
           id: generateUUID(),
           project_id: projectId,
           tool_name: toolName,
           messages: JSON.stringify(messagesArray),
           created_at: now()
       })
   ```

4. **Reconstruction Logic**:
   - In `ChatMessageRepository.ts`, implement `reconstructHistoryForAction(toolName, projectId, params)`: Query prior conversations for toolName (e.g., 'generate_单集大纲'), sort by created_at, reconstruct the exact multi-message history, and append a new user message (e.g., {role: 'user', content: `Generate the next episode synopsis group: ${JSON.stringify(params)}`}).
   - In `EpisodeSynopsisTool.ts`, check for prior synopsis conversations (e.g., by groupTitle or episodes). If found, reconstruct the history and pass as multi-message array to LLM via `executeStreamingTransform` (add `conversationHistory` param). This ensures caching of shared prefixes.

   **Algorithm Sketch for Reconstruction**:
   ```
   function reconstructHistoryForAction(toolName, projectId, params):
       // Query prior conversations
       conversations = db.select('chat_conversations')
           .where('project_id', projectId)
           .where('tool_name', toolName)
           .orderBy('created_at desc')
           .limit(1)  // Get most recent for continuation
       
       if conversations.empty():
           return []  // New conversation
       
       history = JSON.parse(conversations[0].messages)
       
       // Append new user message
       newMessage = {
           role: 'user',
           content: `Generate next group: ${JSON.stringify(params)}`  // e.g., episodes, groupTitle
       }
       history.push(newMessage)
       
       return history  // Full array for LLM multi-message input
   ```

5. **Integration in Agent**:
   - In `AgentService.ts`, before streaming, check if request is a continuation (e.g., keyword "continue" or matching tool/params). If yes, reconstruct history and use multi-message prompt. The agent LLM will process the appended message and call `generate_单集大纲` with new params (e.g., episodes 7-12).

   **Algorithm Sketch for Agent Integration**:
   ```
   function runGeneralAgent(request, projectId, userId):
       // Check for continuation
       isContinuation = request.contains('continue') or matchesPriorParams(request.params)
       
       if isContinuation:
           history = reconstructHistoryForAction('generate_单集大纲', projectId, request.params)
           prompt = buildMultiMessagePrompt(history)  // Convert to Qwen-compatible multi-message
       else:
           prompt = buildStandardPrompt(request)
       
       // Stream with prompt (multi-message enables caching)
       result = streamText({model: qwenModel, prompt})
       
       // If tool called successfully, save updated history
       if result.toolCalled == 'generate_单集大纲':
           updatedMessages = history.concat(result.newMessages)  // Append LLM response/tool result
           saveConversation(result.toolCallId, projectId, 'generate_单集大纲', updatedMessages)
   ```

6. **Testing**:
   - Generate 1-6 synopsis, then 7-12 as continuation—verify cache hits via logs (`cached_tokens` in LLM response) and successful tool call.
   - Use `inspect-content.ts` for jsondocs, `RawChatMessages.tsx` for history verification.

## Potential Impact and Testing Notes
- **Impact**: Improves efficiency (e.g., 30%+ cost savings via caching), enables seamless continuations. Aligns with framework by linking to transforms/jsondocs. Achieves the goal of history-based caching for all synopsis generations.
- **Testing**: Use `npm test -- --run` for new methods. Debug with `./run-ts src/server/scripts/extract-lineage-tree.ts <project-id>` and `inspect-content.ts`. Ensure Qwen caching works by checking response `usage.prompt_tokens_details.cached_tokens` and confirm LLM successfully calls the tool after history append. 