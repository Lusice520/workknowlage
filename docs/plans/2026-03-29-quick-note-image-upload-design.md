# Quick Note Image Upload Design

**Goal**

让每日快记支持图片与附件上传，同时保证：

- 快记内上传后的内容能立即可见
- 数据工具里的“清理孤儿附件”不会误删快记附件
- 快记沉淀为正式文档后，图片仍然能继续显示

## Why Change

当前正式文档编辑器已经支持拖拽 / 粘贴上传附件，但快记页没有把上传能力接进 `SharedBlockNoteSurface`，因此用户在每日快记里无法上传图片。

这会割裂快记作为“快速捕捉入口”的体验，因为很多日常记录本来就伴随截图、照片或图片素材。

## Scope

本次做：

- 每日快记支持拖拽 / 粘贴上传图片与附件
- Electron 侧增加快记附件上传 IPC
- 附件清理逻辑纳入 quick note 引用扫描
- 快记沉淀为正式文档后，原有附件 URL 继续可用

本次不做：

- 沉淀时迁移附件到正式文档目录
- 为快记单独做分享能力
- 改造快记数据库结构来持久化附件元数据
- 快记附件与正式文档附件的统一归属重构

## Options Considered

### 方案 A：快记独立上传目录，沉淀后继续引用原地址（推荐）

做法：

- 快记上传时，按快记资源 id 建目录，例如 `uploads/quick-note-<id>/...`
- `content_json` 里直接写入这条 URL
- 清理孤儿附件时把 `quick_notes.content_json` 也纳入扫描
- 沉淀为正式文档时不迁移文件，文档继续引用原来的 `/uploads/quick-note-<id>/...`

优点：

- 改动最小
- 风险最低
- 不需要做附件迁移和失败回滚

缺点：

- 沉淀后的文档图片物理归属仍在快记目录

### 方案 B：沉淀时迁移附件并重写 URL

优点：

- 正式文档和附件归属完全一致

缺点：

- 要处理文件复制/移动、内容 JSON 改写、失败回滚
- 明显超出这轮“补快记上传”范围

### 方案 C：快记绑定隐式 backing document

优点：

- 模型统一

缺点：

- 会把快记系统整体变重，不适合当前阶段

## Chosen Approach

采用 `方案 A`。

这轮的重点是把“快记也能上传图片”这个用户能力尽快补齐，同时保证不会被附件清理错误删除。归属一致性后面如果真的有必要，再从 A 升级到 B。

## Architecture

### Renderer

- `QuickNoteCenterPane` 补一个 `onUploadQuickNoteFiles` 回调
- 快记编辑器继续复用 `SharedBlockNoteSurface`
- 上传后仍然插入现有的 `kbAttachment` block

### Desktop API

新增快记附件上传接口：

- `quickNotes.uploadAssets(noteDate, assets)`

或等价 API，返回值继续沿用现有 `UploadedAssetRecord[]`

### Electron

- 通过 `quickNotes:get/upsert` 先确保快记有稳定的 `id`
- 用这个快记 `id` 作为上传资源目录 id
- 存储层继续复用现有 `uploads/storage.cjs`

### Cleanup

当前孤儿附件清理只扫描 `documents`，必须扩展为同时扫描：

- `documents.content_json`
- `quick_notes.content_json`

这样 `uploads/quick-note-<id>/...` 不会被误判成孤儿。

## Data Model

不新增数据库表，也不新增附件元数据表。

快记附件的“被引用状态”仍然完全由 `quick_notes.content_json` 决定。

目录命名策略：

- 正式文档：维持现有 `uploads/<documentId>/...`
- 快记：新增 `uploads/<quickNoteId>/...`

因为快记 `id` 已经是稳定 UUID，所以可以直接复用现有目录模型。

## Capture Behavior

快记沉淀为正式文档时：

- 继续按当前逻辑复制 `content_json`
- 不迁移附件文件
- 不改写附件 URL

结果是沉淀后的正式文档会继续引用原快记目录下的图片，但可正常显示和访问。

## Testing

需要覆盖：

1. 快记页把上传能力传入编辑器
2. 快记上传 API 在 renderer / preload / electron 三端打通
3. 孤儿附件清理不会删除被快记引用的上传文件
4. 快记沉淀为正式文档后，原附件 URL 仍保留且文档能打开

## Acceptance

完成后，用户在每日快记里可以直接拖拽或粘贴图片：

- 图片会正常插入
- 重新打开快记仍可见
- 执行附件清理不会误删
- 沉淀为正式文档后图片继续可用
