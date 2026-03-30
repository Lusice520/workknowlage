# Data Tools Phase Three Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete local data-tools workflow in settings with open-data-folder, backup, restore, search-index rebuild, and orphan-attachment cleanup.

**Architecture:** Add a small Electron maintenance layer that owns filesystem-heavy operations, expose it through preload and typed renderer APIs, and wire the settings panel to show action buttons plus execution feedback. Keep restore as full replace, then reinitialize SQLite and rebuild search so the app returns to a consistent state.

**Tech Stack:** Electron, Node fs/path, better-sqlite3, React, Vitest, Testing Library

---

### Task 1: Define Data Tools API Surface

**Files:**
- Modify: `electron/preload.cjs`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/shared/lib/workKnowlageApi.ts`
- Test: `src/shared/lib/workKnowlageApi.test.ts`

**Step 1: Write the failing test**

Add tests in `src/shared/lib/workKnowlageApi.test.ts` that expect the desktop API surface to expose:

- `maintenance.openDataDirectory()`
- `maintenance.createBackup()`
- `maintenance.restoreBackup()`
- `maintenance.rebuildSearchIndex()`
- `maintenance.cleanupOrphanAttachments()`

Also add fallback behavior expectations for browser-mock mode:

- methods exist
- they resolve with safe mock feedback

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`
Expected: FAIL because `maintenance` APIs/types do not exist.

**Step 3: Write minimal implementation**

- Add maintenance method types to `src/shared/types/preload.ts`
- Bridge methods from preload in `electron/preload.cjs`
- Provide fallback implementations in `src/shared/lib/workKnowlageApi.ts`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`
Expected: PASS

**Step 5: Commit**

Not possible right now because this workspace does not contain a `.git` repository.

### Task 2: Implement Electron Maintenance Module

**Files:**
- Create: `electron/maintenance/dataTools.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/db/index.cjs`
- Modify: `electron/uploads/storage.cjs`
- Test: `src/test/electronPersistenceSmoke.test.ts`

**Step 1: Write the failing smoke test**

Extend `src/test/electronPersistenceSmoke.test.ts` or add a focused smoke flow that:

- creates test data
- creates a backup
- mutates local data
- restores from backup
- verifies original DB state and uploaded files are back

**Step 2: Run test to verify it fails**

Run: `npm test -- src/test/electronPersistenceSmoke.test.ts`
Expected: FAIL because no maintenance backup/restore flow exists.

**Step 3: Write minimal implementation**

In `electron/maintenance/dataTools.cjs`, implement helpers for:

- resolving data paths from `userData`
- opening the data directory
- copying DB sidecars and uploads to a timestamped backup directory
- validating a backup directory manifest
- closing DB, replacing DB/uploads, reinitializing DB, rebuilding search

Then wire IPC handlers in `electron/main.cjs`.

Add any tiny exports needed from `electron/db/index.cjs` and `electron/uploads/storage.cjs`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/test/electronPersistenceSmoke.test.ts`
Expected: PASS

**Step 5: Commit**

Not possible right now because this workspace does not contain a `.git` repository.

### Task 3: Add Search Rebuild and Attachment Cleanup Engine

**Files:**
- Create: `electron/maintenance/attachmentCleanup.cjs` or keep inside `electron/maintenance/dataTools.cjs`
- Modify: `electron/db/repositories/search.cjs`
- Modify: `electron/db/repositories/documents.cjs`
- Modify: `electron/uploads/storage.cjs`
- Test: `electron/db/repositories/search.smoke.test.ts`
- Test: `src/test/electronPersistenceSmoke.test.ts`

**Step 1: Write the failing test**

Add node/electron coverage that expects:

- explicit search rebuild action returns success
- orphaned document upload directories are removed
- still-referenced files are preserved

**Step 2: Run test to verify it fails**

Run: `npm test -- electron/db/repositories/search.smoke.test.ts src/test/electronPersistenceSmoke.test.ts`
Expected: FAIL because cleanup/rebuild workflow is not implemented end-to-end.

**Step 3: Write minimal implementation**

Implement orphan cleanup rules:

- if `uploads/<documentId>` has no live document, remove the directory
- if document exists, parse `contentJson`, collect referenced upload URLs/file names, delete unreferenced files
- remove empty directories

Keep rebuild search as a callable maintenance action that returns human-readable counts/feedback.

**Step 4: Run test to verify it passes**

Run: `npm test -- electron/db/repositories/search.smoke.test.ts src/test/electronPersistenceSmoke.test.ts`
Expected: PASS

**Step 5: Commit**

Not possible right now because this workspace does not contain a `.git` repository.

### Task 4: Upgrade Settings UI Into Actionable Data Tools Panel

**Files:**
- Modify: `src/features/shell/SpaceSwitcher.tsx`
- Modify: `src/features/shell/LeftSidebar.tsx`
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/app/useWorkspaceDiagnostics.ts`
- Modify: `src/app/useWorkspaceSession.ts`
- Modify: `src/app/App.tsx`
- Test: `src/features/shell/LeftSidebar.test.tsx`
- Test: `src/app/App.test.tsx`

**Step 1: Write the failing test**

Add UI tests expecting the settings panel to show:

- `打开数据目录`
- `创建备份`
- `从备份恢复`
- `重建搜索索引`
- `清理孤儿附件`

Also verify action feedback renders after a mocked successful call.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx src/app/App.test.tsx`
Expected: FAIL because the buttons and feedback do not exist.

**Step 3: Write minimal implementation**

- Extend diagnostics/session state with `dataToolsFeedback`, `isRunningDataTool`
- Add action handlers in `App.tsx` / session layer that call maintenance APIs
- Render the new button group and feedback block in `SpaceSwitcher.tsx`
- Keep the existing storage status section intact

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx src/app/App.test.tsx`
Expected: PASS

**Step 5: Commit**

Not possible right now because this workspace does not contain a `.git` repository.

### Task 5: Add Restore Confirmation and Error Feedback

**Files:**
- Modify: `src/features/shell/SpaceSwitcher.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/shell/LeftSidebar.test.tsx`

**Step 1: Write the failing test**

Add a test that `从备份恢复` shows a destructive confirmation message before the restore call runs.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx`
Expected: FAIL because restore confirmation is missing.

**Step 3: Write minimal implementation**

Use the same local confirmation style already used for delete actions:

- clear “整包覆盖当前本地数据” warning
- abort if user cancels

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

Not possible right now because this workspace does not contain a `.git` repository.

### Task 6: Run Full Verification

**Files:**
- Modify: none unless failures require fixes

**Step 1: Run targeted tests**

Run:
- `npm test -- src/shared/lib/workKnowlageApi.test.ts`
- `npm test -- src/test/electronPersistenceSmoke.test.ts`
- `npm test -- electron/db/repositories/search.smoke.test.ts`
- `npm test -- src/features/shell/LeftSidebar.test.tsx src/app/App.test.tsx`

Expected: PASS

**Step 2: Run full project verification**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`

Expected: PASS

**Step 3: Document any residual concerns**

Record any non-blocking warnings, especially:

- existing React `act(...)` warnings if they remain
- any large bundle warnings

**Step 4: Commit**

Not possible right now because this workspace does not contain a `.git` repository.
