### Generalized “自动修正” for Stale Children (Lineage-Wide)

#### Rationale
- The current UI copy and behavior are implicitly tied to a single upstream edit case (e.g., 由“剧本概要/灵感创意”变化触发)，标题固定为“因为上游内容已经修改…”。
- 服务端的自动修正目标选择存在硬编码的下游偏好（例如 灵感创意 → 故事设定，故事设定 → chronicles），导致无法直接对“被判定为过时”的具体子节点执行修正。
- 当用户在多个位置进行编辑时，会产生多处“过时的下游子节点”，现有 UI 无法聚合展示与多选批量修正。

#### Goals
- 文案：在警示区显示具体被修改的上游条目名称，形如：因为“xxx, xxx, xxx”被修改，以下内容可能过时。
- 选择性修正：为每个“过时的子节点”提供复选框（默认全选），用户可选择要自动修正的部分，然后批量执行。
- 广义适配：不局限于“创意→设定”，对谱系树中“任一节点”的“直接子节点”都适用。即：一旦父节点被编辑，其直接 AI 生成的子节点即为“候选过时项”。
- 聚合视图：当多个上游发生编辑时，聚合展示所有受影响的子节点，并在标题中按逗号分隔展示所有上游来源的名称。
- 兼容现有后端能力：沿用现有 SSE 进度流与批量执行接口；遵循项目的 Transform Jsondoc Framework、鉴权与分项目访问控制规则。

#### Non‑Goals
- 不在此变更中引入新的数据库表或迁移；不改变现有鉴权/项目成员规则。
- 不实现跨越式“推演到更远下游”的自动化（保持“直接子节点”为默认作用域）。

---

### Current Architecture Snapshot (for reference)
- 客户端：
  - `src/client/components/ActionItemsSection.tsx` 负责汇总本地变更，并调用 `computeStaleJsondocs` 计算受影响节点；把结果传给 `AffectedJsondocsPanel`。
  - `src/client/components/AffectedJsondocsPanel.tsx` 显示“因为上游内容…可能过时”的提示与“自动修正”按钮（当前标题与逻辑偏固定）。
- 公共逻辑：
  - `src/common/staleDetection.ts` 提供 `computeStaleJsondocs`，对“上游 diff → 直接子节点”进行影响分析，已记录 `sourceChanges`（能追溯到上游 jsondocId）。
- 服务端：
  - `src/server/services/BatchAutoFixService.ts` 通过 `resolveAutoFixTarget` 存在对“更下游目标”的硬编码偏好（idea→outline，outline→chronicles）。
  - 接口：`POST /api/auto-fix/run` 和 `GET /api/auto-fix/stream/:projectId`（SSE 进度）。

---

### Design

#### 1) 数据结构增强（公共层）
- 扩展 `AffectedJsondoc`（`src/common/staleDetection.ts`）：
  - 新增 `sources: Array<{ id: string; schemaType: string }>` 字段，用于表示“该过时子节点所受影响的所有上游来源”。
  - 生成方式：在 `computeStaleJsondocs` 聚合阶段，基于 `sourceChanges[].jsondocId` 去重，结合 lineage 与 `jsondocs` 列表补齐 `schemaType`。
  - 兼容性：`reason`、`affectedPaths`、`severity` 等字段保持不变。

#### 2) 检测算法（保持即插即用的广义性）
- 仍然以“上游 diff → 直接 AI 子节点”为核心，不限制具体 schema 组合。
- `SCHEMA_IMPACT_MAP` 作为细化权重/严重度的可选映射；若无命中则默认 `low` 严重度。
- 由 `ActionItemsSection` 继续从 `projectData.localUpdates` 生成 diffs 并调用该函数。

#### 3) UI 交互与文案（`AffectedJsondocsPanel.tsx`）
【文案/来源汇总】
- 计算唯一上游来源集合 `uniqueUpstreamIds`（来自 `affected[].sources`），映射到“显示名称”：
  - 若为 `灵感创意`，优先取 `data.title`；
  - 其它 schema 优先取常用简明字段（若无则回退为 `schemaType#短ID`）。
- 标题渲染为：因为“name1, name2, …”被修改，以下内容可能过时。

【复选框与批量执行（实现细节）】
- 组件本地状态：
  - `const [selected, setSelected] = useState<Set<string>>(new Set(affected.map(a => a.jsondocId)))`；
  - 在 `useEffect([affected])` 中同步：当受影响列表更新时，默认全选（保持用户直觉）；若在运行中（`isRunning`），禁止改变选中状态。
- 列表项：
  - 使用 AntD `Checkbox` 渲染在每个条目前；交互切换时更新 `selected`。
  - 顶部提供“全选/全不选”开关；也可加“仅高风险”筛选（可选）。
- 提交逻辑：
  - `const items = affected.filter(a => selected.has(a.jsondocId)).map(a => ({ jsondocId: a.jsondocId, schemaType: a.schemaType, editRequirements }))`；
  - 若 `items.length === 0` 则按钮禁用；按钮文案为“自动修正所选(N)”。
- 运行态：
  - `isRunning` 为真时禁用复选框与开关，防止执行中变更提交集。
- `compact` 与 `card` 两种渲染模式都复用同一状态与行为，差异仅在排版；列表容器限制高度可滚动。

【名称解析的数据来源】
- 在面板内部通过 `useProjectData()` 读取 `projectData.jsondocs` 来做 `id → 名称` 映射，避免父组件传递大型数组；
- 若未来希望完全无上下文依赖，可改为给面板新增 `getDisplayName(jsondocId) => string` 的轻量回调 props。

#### 4) 服务端行为（BatchAutoFixService）
- 目标选择（与复选框支持的关系）：
  - 复选框仅影响“客户端提交的 `items` 子集”；后端无需为“选择”做额外改动。
  - 仍需调整 `resolveAutoFixTarget`：默认“对传入的子节点本身执行编辑”，不再强制偏好更下游目标（否则会出现用户选中 A，但后端去修正 A 的下游 B 的情况）。
  - 为兼容旧行为，可保留可选开关（默认为关闭），用于将来启用“偏好更下游目标”的策略。
- 批处理与进度：
  - 继续沿用现有批处理与 SSE 进度事件；保持鉴权（`requireAuth`）与项目成员校验（`userHasProjectAccess`）。
- 提示上下文：
  - 维持现有 `GenericEditTool` 调用与上下文拼装；如目标 schema 为 `故事设定` 时，可继续计算特定上下文（已存在的 `computeAffectedContextForOutline`）。

【可选的后端增强（非必须）】
- `POST /api/auto-fix/run` 的 `items[]` 可选扩展 `sources?: string[]`（上游名称）用于提示词上下文增强；若不提供，后端照旧使用既有上下文构建逻辑。

---

### API 契约（不破坏性）
- `POST /api/auto-fix/run` 仍为：
  - `{ projectId, items: Array<{ jsondocId, schemaType, editRequirements }> }`
  - 客户端只传“选中的”过时子节点。
- `GET /api/auto-fix/stream/:projectId`（SSE）保持不变。

---

### Implementation Steps
1) Public: enhance `AffectedJsondoc` 与 `computeStaleJsondocs`
   - 聚合 `sourceChanges` → `sources`（去重）；为每个源补齐 `schemaType`。
2) Client: `AffectedJsondocsPanel.tsx`
   - 根据 `affected[].sources` 计算 `uniqueUpstreamIds` 与显示名数组；更新标题文案。
   - 为列表项加入复选框（默认全选），提供“全选/全不选”。
   - “自动修正所选(N)”仅提交选中项；无选中禁用。
   - `compact` 模式适配相同逻辑与进度条。
3) Server: `BatchAutoFixService`
   - 修改 `resolveAutoFixTarget`：默认直接返回传入项；去除或禁用硬编码的 `preferDownstreamTarget` 逻辑。
   - 保持 SSE 事件与错误处理。
4) QA & Tests
   - 单元：`staleDetection` 返回的 `sources` 正确聚合；多上游、多子节点用例。
   - 组件：
     - 标题渲染“因为"name1, name2"被修改…”，`uniqueUpstreamIds` 变化时正确更新；
     - 复选框默认全选、全选/全不选切换；
     - 提交 payload 仅包含已选项；无选中时按钮禁用；运行中禁用交互。
   - 集成：选中若干项后触发批量修正，SSE 进度与完成提示正确。

---

### Risks & Mitigations
- 部分 schema 缺少易读标题字段 → 采用安全回退（schemaType + 短 ID）。
- 旧代码依赖“更下游偏好”的行为 → 通过可选开关保留旧策略，默认关闭。
- 多源/多子节点场景数量过多 → UI 提供折叠与滚动容器，默认全选但可快速反选。

---

### Acceptance Criteria
- 在任意上游节点编辑后，若其直接 AI 子节点存在，则面板出现，标题列出具体上游名称（逗号分隔）。
- 面板提供可选择的子节点复选框；默认全选；可“自动修正所选(N)”。
- 执行后仅所选子节点被送入 `/api/auto-fix/run`，SSE 进度准确，完成提示显示“完成 X / 总数”。
- 方案在 idea→outline、outline→chronicles、以及其它 schema 组合上均保持一致体验。


