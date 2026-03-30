# Phase Two Backlinks And Capture Implementation Plan

**Goal:** Ship the first real “association and capture” loop by deriving backlinks from `@mention` document references and allowing quick notes to be captured as formal documents.

**Architecture:** Extend the BlockNote schema with a custom inline document mention plus an `@` suggestion menu, rebuild the `backlinks` table per space whenever document state changes, expose the resulting `sourceDocumentId` to the renderer, and wire the right sidebar to navigate back to the source document. For quick-note capture, reuse existing `quickNotes.get`, `documents.create`, and `documents.update` operations from the session layer instead of adding a new persistence primitive.

**Tech Stack:** Electron, SQLite, React, TypeScript, Vitest

---

### Task 1: Add failing tests for phase-two flows

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/RightSidebar.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/QuickNoteCenterPane.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.test.tsx`

Add failing coverage for:

- fallback backlink derivation from persisted document mentions
- clicking a backlink card opens the source document
- quick note “沉淀为文档” opens a newly created formal document

### Task 2: Implement backlink parsing and sync

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/backlinks.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/documents.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`

Implement:

- mention extraction from normalized `contentJson`
- per-space backlink rebuild
- `sourceDocumentId` on hydrated backlink records
- sync hooks after create/update/rename/delete/trash/restore operations

### Task 3: Implement editor `@mention` UI

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/blocknoteReactNoComments.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/blockNoteSchema.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/editorSchema.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.tsx`

Implement:

- custom inline content spec for document mentions
- `@` suggestion menu items sourced from current-space documents
- mention insertion with `documentId` and `title`

### Task 4: Implement clickable backlink UI

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/RightSidebar.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`

Make backlink cards clickable and route them through the existing document-open flow.

### Task 5: Implement quick-note capture

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/workspaceSessionActionTypes.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceContentActions.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceSession.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/QuickNoteCenterPane.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`

Implement:

- session action to create a document from quick note content
- title derivation from first heading with fallback to quick note title
- opening the new formal document immediately after capture

### Task 6: Verify full health

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts src/features/shell/RightSidebar.test.tsx src/features/shell/QuickNoteCenterPane.test.tsx src/app/App.test.tsx`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

## Outcome

已完成并验证：

- fallback / Electron 两条数据链都支持从 `docMention` 解析并重建 backlinks
- 正式文档编辑器支持 `@` 唤起当前空间文档候选，并插入持久化的 inline mention 节点
- 右栏 backlink 卡片可点击打开来源文档
- 重新打开文档时会按需刷新最新持久化内容，避免 backlinks 停留在旧快照
- 每日快记支持“沉淀为文档”，并在创建后直接打开正式文档
- Electron smoke 覆盖了 `reopen -> trash -> restore -> purge` 的 backlink 生命周期

最终验证结果：

- `npm test` 通过，`30` 个测试文件、`114` 个测试全绿
- `npm run typecheck` 通过
- `npm run build` 通过

当前剩余非阻塞项：

- 构建仍有 `> 500 kB` 的编辑器 chunk warning，但不影响第二期功能闭环
