# Mention Block Navigation Design

## Goal

让右侧栏 `被提及于` 的引用卡在点击后不仅打开来源文档，还能直接滚动到产生该提及的具体 block，并给这个 block 一个短暂高亮提示。

## Current State

- 右侧栏点击只传 `documentId`，所以现在只能打开来源文档，不能定位到具体提及位置。
- 反链提取和持久化只保存 `sourceDocumentId + targetDocumentId + description`，没有来源 `blockId`。
- 编辑器 DOM 已经给 block 渲染了 `data-id`，所以前端具备按 block id 查找并滚动到元素的基础条件。

## Scope

本次只做 `被提及于` 的块级定位。

- `被提及于`：支持打开来源文档后定位到具体提及 block，并高亮。
- `提及文档`：继续保持文档级跳转，不做块级定位，因为目标文档本身没有天然的 mention 落点。
- 快记不纳入本次定位范围。

## Data Model Changes

### Backlinks

给 `BacklinkRecord` 增加：

- `sourceBlockId?: string | null`

反链提取时，从命中的来源 block 上读取 `id`，把它作为 `sourceBlockId` 一起返回和持久化。

### Persistence

`backlinks` 表增加一列：

- `source_block_id TEXT`

重建反链时写入该列，读取文档时把该字段组装进 `backlinks`。

## Navigation Flow

1. 用户点击 `被提及于` 卡片。
2. 右侧栏把 `{ documentId, blockId }` 传给文档打开动作。
3. Session 打开文档并记录一次“待聚焦 block”请求。
4. `EditorHost` / 编辑器表面在文档完成挂载后：
   - 查找对应 `data-id="<blockId>"` 的 block 元素
   - 滚动到可视区域中间附近
   - 给该 block 添加短暂高亮样式
   - 尝试把光标移动到该 block 起始位置
5. 相同 block 被重复点击时，也要能重新触发定位，因此前端请求状态需要带一个递增 key，而不能只靠 `blockId` 本身。

## Frontend Approach

### Session State

新增一个轻量的“文档定位请求”状态，至少包含：

- `documentId`
- `blockId`
- `requestKey`

普通文档打开不带 blockId；从 backlink 打开时带 blockId。

### Editor Integration

`EditorHost` 接收 `focusBlockId` / `focusRequestKey`，在编辑器挂载或请求更新时执行滚动与高亮。

高亮实现优先采用 DOM class + timeout 清理，避免污染文档内容 JSON。

## Testing Strategy

### Unit / UI

- `RightSidebar.test.tsx`
  - 点击 incoming backlink 时，传出 `{ documentId, blockId }`
- `App.test.tsx`
  - 从 backlink 打开文档后，定位请求会被写入 session 并传到中心编辑器
- `EditorHost.test.tsx`
  - 收到 `focusBlockId` 后会滚动并打上高亮 class
  - 同一 block 重复请求时仍会重新触发

### Persistence / Node

- `electronPersistenceSmoke.test.ts`
  - 重建后的 backlink 带有 `sourceBlockId`

## Risks

- 如果来源 block 被后续编辑删除，历史 backlink 的 `sourceBlockId` 可能失效。
  - 处理：前端找不到 block 时退化为正常打开文档，不报错。
- 如果使用“打开同一文档”的场景，只更新 blockId 不更新请求 key，效果可能不触发。
  - 处理：请求状态显式带 `requestKey`。

## Out of Scope

- outgoing reference 的块级定位
- 快记内 mention 的块级定位
- 长期高亮或 URL hash 深链接
