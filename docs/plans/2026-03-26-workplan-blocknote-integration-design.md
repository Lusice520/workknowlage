# WorkPlan BlockNote Integration Design

**Date:** 2026-03-26

**Status:** Approved

**Owner:** Codex + User

## Goal

在保留 `WorkKnowlage` 现有三栏壳体的前提下，把 `WorkPlan` 里的 `BlockNote` 编辑器能力接入到中栏正文区域，并同时带入以下能力：

- `Alert / Callout`
- `RichTable`
- 文件上传
- 图片预览
- 只读分享

明确不接入协同编辑能力。

## Constraints

- 保留当前 `AppShell + LeftSidebar + CenterPane + RightSidebar` 的整体结构。
- 不整体移植 `WorkPlan` 的知识库页面，只做最小 graft。
- SQLite 继续作为本地真实数据源。
- 分享能力通过本地只读分享实现，不引入协同或远端服务依赖。

## Recommended Approach

采用“最小 graft”方案：

1. 保留 `WorkKnowlage` 的三栏布局和数据流。
2. 将 `CenterPane` 内的静态正文替换为一个新的真实编辑器宿主组件。
3. 从 `WorkPlan` 复制并适配 `BlockNote` 核心模块，包括：
   - schema
   - `Alert / Callout`
   - `RichTable`
   - `SharedBlockNoteSurface`
   - 图片预览弹层
   - 上传交互层
4. 将正文真源切换为 `BlockNote JSON`。
5. 上传和分享改为接入 `Electron IPC + 本地文件/本地 HTTP 服务`，而不是沿用 `WorkPlan` 的后端 API。

## Alternatives Considered

### Option 1: 最小 graft

直接在当前中栏替换 `EditorHost`，保留外层壳和右栏。

优点：

- 返工最少
- 与当前刚稳定下来的 SQLite 数据流最一致
- 风险最可控

缺点：

- 需要把 `WorkPlan` 中与后端 API 耦合的上传/分享逻辑拆开重接

### Option 2: 搬整个知识库编辑区

将 `WorkPlan` 的 `KnowledgeBaseEditorArea` 连同工具区整体迁入。

优点：

- 更接近 `WorkPlan` 原始体验

缺点：

- 依赖清理成本高
- 协同、分享、上传、保存假设较多
- 与现有 `CenterPane / RightSidebar` 边界冲突更大

### Option 3: 先抽公共编辑器包

先在两个项目之间抽出共享编辑器模块，再在 `WorkKnowlage` 接入。

优点：

- 长期最干净

缺点：

- 当前前置成本过高
- 会推迟用户可见结果

## Final Decision

选择 **Option 1: 最小 graft**。

## Architecture

### 1. Shell Layer

保留现有：

- `LeftSidebar`
- `RightSidebar`
- `CenterPane` 外层结构

调整：

- `CenterPane` 不再直接渲染静态 `DocumentSection[]`
- `CenterPane` 改为托管新的 `EditorHost`

### 2. Editor Integration Layer

新增 `WorkPlanEditorHost`，职责如下：

- 接收当前 `activeDocument`
- 将文档内容转成 `BlockNote` 初始内容
- 监听编辑器变更并自动保存
- 响应上传、图片预览、分享动作

这层不直接访问 SQLite，只通过 `WorkKnowlageDesktopApi` 与主进程通信。

### 3. Content Model

正文真源切换为 `BlockNote JSON`。

原因：

- 当前 `DocumentSection[]` 无法表达 `RichTable`
- 无法完整表达 `Alert / Callout`
- 无法表达附件块与图片附件块

因此：

- `documents.content_json` 作为正文唯一真源
- `outline` 由主进程从 `BlockNote blocks` 派生
- 旧的 `sections` 仅作为兼容输出或迁移过渡，不再作为编辑真源

### 4. Upload Layer

上传不再调用远端 `/upload`。

改为通过 Electron IPC：

- renderer 收集 `File`
- preload 暴露上传 API
- main process 将文件写入本地应用目录
- 本地服务提供静态访问 URL

上传结果以附件块形式写回 `BlockNote JSON`。

### 5. Image Preview Layer

复用 `WorkPlan` 的事件驱动预览模式：

- 附件块触发图片预览事件
- 图片预览弹层监听该事件并展示本地 URL

### 6. Share Layer

分享采用本地只读分享模型：

- 主进程启动轻量 HTTP 服务
- 分享 token 存在 SQLite
- 分享页只读渲染 BlockNote 内容导出的 HTML
- 不引入协同或在线编辑

## Data Flow

### Load

1. `App` 加载当前 space snapshot
2. `CenterPane` 拿到 `activeDocument`
3. `EditorHost` 读取 `activeDocument.content_json`
4. `BlockNote` 初始化为对应 blocks

### Edit

1. 用户在 BlockNote 中编辑
2. 编辑器内容变更后触发 debounce
3. renderer 调用 `documents.update(id, { contentJson })`
4. main process 存储 JSON，并重新派生 outline
5. renderer 更新当前文档状态
6. `RightSidebar` 使用新 outline 重新渲染

### Upload

1. 用户拖拽 / 粘贴 / 选择文件
2. renderer 调用 `documents.uploadAssets(documentId, assets)`
3. main process 保存文件并返回 URLs
4. 编辑器插入附件块 / 图片块
5. 正文自动保存

### Share

1. 用户点击分享
2. renderer 调用 `shares.createOrCopy(documentId)`
3. main process 先确保文档已保存
4. main process 生成 token
5. 本地服务暴露 `/share/:token`
6. renderer 复制只读链接

## Files To Add Or Modify

### Dependencies

Modify:

- `package.json`

新增依赖：

- `@blocknote/core`
- `@blocknote/react`
- `@blocknote/mantine`
- `@mantine/core`
- `@mantine/hooks`
- `@tiptap/core`
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/extension-table`
- `@tiptap/extension-table-row`
- `@tiptap/extension-table-header`
- `@tiptap/extension-table-cell`
- `@tiptap/extension-underline`
- `prosemirror-tables`

### Editor Modules

Create:

- `src/shared/editor/blockNoteSchema.ts`
- `src/shared/editor/editorSchema.tsx`
- `src/shared/editor/SharedBlockNoteSurface.tsx`
- `src/shared/editor/SharedBlockNoteSurface.css`
- `src/shared/editor/KnowledgeBaseImagePreview.tsx`
- `src/shared/editor/constants.ts`
- `src/shared/editor/Alert.tsx`
- `src/shared/editor/Alert.css`
- `src/shared/editor/RichTable.tsx`
- `src/shared/editor/RichTable.css`
- `src/shared/editor/richTablePasteUtils.ts`
- `src/shared/editor/editorBodyFocusUtils.ts`
- `src/shared/editor/blockAdapter.ts`

### WorkKnowlage UI Integration

Modify:

- `src/features/editor-host/EditorHost.tsx`
- `src/features/shell/CenterPane.tsx`
- `src/app/App.tsx`
- `src/shared/types/preload.ts`
- `src/shared/types/workspace.ts`

### SQLite / Electron

Modify:

- `electron/db/schema.cjs`
- `electron/db/repositories/documents.cjs`
- `electron/main.cjs`
- `electron/preload.cjs`

Create:

- `electron/share/server.cjs`
- `electron/share/repository.cjs`
- `electron/share/render.cjs`
- `electron/uploads/storage.cjs`

## Database Changes

### documents

继续使用现有 `content_json` 字段，但语义变更为：

- 旧语义：简化 section JSON
- 新语义：完整 BlockNote JSON

### new table: document_shares

建议字段：

- `id`
- `document_id`
- `token`
- `enabled`
- `created_at`
- `updated_at`

可选字段：

- `last_accessed_at`

## API Surface Changes

### documents

新增或扩展：

- `documents.update(id, { contentJson })`
- `documents.uploadAssets(documentId, assets)`

### shares

新增：

- `shares.get(documentId)`
- `shares.create(documentId)`
- `shares.regenerate(documentId)`
- `shares.disable(documentId)`

## Error Handling

- 上传失败时提示，不破坏当前编辑状态
- 分享失败时保留当前文档内容，不阻断编辑
- JSON 解析失败时回退到空 BlockNote 文档
- 本地静态服务不可用时，分享功能显示错误并允许重试

## Testing Strategy

### Unit

- Block adapter: `BlockNote JSON <-> UI 派生数据`
- documents repository: `content_json` 保存与 outline 派生
- share repository: token 创建、重置、禁用

### Integration

- `EditorHost` 渲染真实 BlockNote
- 插入 `Alert`
- 插入 `RichTable`
- 编辑后自动保存
- 上传图片后插入附件块
- 图片预览弹层打开
- 分享链接创建与关闭

### Smoke

- `npm test`
- `npm run typecheck`
- `npm run build`

## Rollout Order

1. 安装依赖并复制编辑器模块
2. 接入 `BlockNote + Alert + RichTable`
3. 将正文真源切换为 BlockNote JSON
4. 接入上传与图片预览
5. 接入本地只读分享

## Risks

- `WorkPlan` 编辑器模块依赖较多，首次移植时可能会带来样式与构建问题
- `RichTable` 体积较大，可能影响中栏首次加载性能
- 旧 mock / seed 文档与新 BlockNote 真源之间需要兼容迁移
- 分享页若直接渲染编辑器 runtime，会增加复杂度，因此必须坚持只读 HTML 渲染

## Non-Goals

- 不接协同编辑
- 不重做整个 `CenterPane` 布局
- 不把 `WorkPlan` 全页面直接搬过来
- 不在本阶段抽通用跨仓库编辑器包
