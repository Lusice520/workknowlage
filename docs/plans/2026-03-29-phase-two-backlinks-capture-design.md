# Phase Two Backlinks And Capture Design

**Goal**

开启第二期“关联与沉淀”产品迭代，先完成一个最小但真实可用的知识闭环：

- 文档支持通过 `@` 呼出文档候选并插入内部 mention
- 保存后自动维护反向链接
- 右侧栏 backlink 卡片支持直接跳转
- 每日快记支持“沉淀为文档”

**Why This Slice First**

- 现有数据库已经有 `backlinks` 表，但目前只是展示种子数据，保存链路并不会维护它。
- 现有编辑器已经有普通链接能力，但没有现成的“内部文档链接 UI”。
- 每日快记已经是独立且持久化的真实能力，但还没进入正式知识库主线。

本期先把“可用闭环”做出来，不先重写编辑器交互。

## Official Reference Check

这次设计先参考了官方文档：

- BlockNote 官方说明默认 inline content 只有普通 `Link`，但支持 `SuggestionMenuController` 和自定义 inline content。
- BlockNote 官方也明确支持自定义 schema 和 custom inline content mention。
- Tiptap 官方 `Mention` / `Suggestion` 能力是 headless 的，适合做自定义唤醒菜单。

因此当前最稳的首版方案是：

- 先用编辑器里的 `@` 触发 mention 菜单
- 插入自定义 inline mention 节点，持久化目标文档 id 和标题
- 保存时解析并生成 backlinks
- 后续如果要补更复杂的跨空间/富 mention 卡片，再沿现有 schema 扩展

## Confirmed Scope

本期做：

- `@mention` 文档唤醒
- 当前空间内 backlink 自动重建
- backlink 卡片点击跳转到来源文档
- 快记沉淀为文档
- 沉淀后自动打开新文档

本期不做：

- 跨空间 mention
- 跨空间链接
- 快记自动参与 backlinks
- 链接重命名迁移 UI

## Product Behavior

### 1. 双向链接

用户在正式文档中输入 `@` 后：

- 弹出候选菜单
- 搜索当前空间文档
- 选择目标文档后插入 mention

保存后，系统会根据 mention 中记录的目标文档 id，为目标文档生成 backlink。

`backlink` 卡片显示：

- 来源文档标题
- 一段引用摘要

点击卡片后：

- 中栏打开来源文档
- 左树切回对应文档

### 2. 快记沉淀

在每日快记页头增加：

- `沉淀为文档`

点击后：

- 读取当前快记内容
- 创建一篇正式文档
- 新文档默认进入根目录
- 标题优先使用快记第一条 heading；如果没有 heading，则使用快记标题
- 文档内容复制快记 `contentJson`
- 新文档创建完成后立即打开

当前快记保留，不会被删除，也不会自动清空。

## Data Model

继续复用现有 `backlinks` 表：

- `id`
- `source_doc_id`
- `target_doc_id`
- `description`

不新增新表。

为了让前端能跳转，`DocumentRecord.backlinks` 需要补一个来源文档 id：

- `sourceDocumentId`

## Backlink Strategy

采用“当前空间全量重建 backlinks”的策略，而不是增量修补。

触发时机：

- 文档创建
- 文档内容保存
- 文档重命名
- 文档删除/移入回收站
- 文档恢复
- 文件夹整包删除/恢复

理由：

- 当前产品仍是本地优先、小规模数据，空间级全量重建足够简单可靠。
- 这样天然处理“目标文档被重命名”这种情况，不需要追踪旧标题。
- 实现上比维护复杂增量索引更稳。

## Mention Rules

首版 mention 规则：

- 只在正式文档中启用，不在快记中启用
- 仅搜索当前空间未删除文档
- 菜单由 `@` 触发
- 候选按标题匹配
- inline mention 节点至少持久化：
  - `documentId`
  - `title`
- 同一个来源文档对同一个目标文档只保留一条 backlink
- 不允许文档引用自己

摘要 `description` 规则：

- 优先取 mention 所在段落的纯文本片段
- 如果提取失败，则回退为 `提到：@标题`

## UI Changes

### Right Sidebar

backlink 卡片改为按钮语义，支持：

- hover / focus 态
- 点击打开来源文档

### QuickNoteCenterPane

在页头保存状态旁边新增：

- `沉淀为文档`

沉淀中需要有轻量 loading 防抖，避免重复点击。

## Testing Strategy

1. Fallback contract

- 保存带 mention 的文档后，目标文档能读取到 backlink
- 删除/恢复文档后，backlinks 会同步变化

2. UI behavior

- 右栏点击 backlink 卡片会打开来源文档
- 快记点击“沉淀为文档”后会打开新文档并显示原内容

3. Full regression

- `npm test`
- `npm run typecheck`
- `npm run build`
