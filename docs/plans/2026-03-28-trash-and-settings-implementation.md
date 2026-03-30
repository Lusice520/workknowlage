# Trash And Settings Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship safe deletion by adding a per-space trash flow for documents and folders, while moving settings into an app-level modal.

**Architecture:** Extend the SQLite `documents` and `folders` tables with soft-delete metadata, make all normal reads filter deleted records by default, add explicit trash operations for list/restore/purge/empty, and reuse the existing center-pane collection-view pattern for a new `trash` view. In parallel, lift settings out of the space switcher into an `AppShell`-level modal so data tools remain accessible without coupling them to the workspace switcher.

**Tech Stack:** Electron, SQLite, React, TypeScript, Vitest

---

### Task 1: Add failing tests for soft-delete data contracts

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/electronPersistenceSmoke.test.ts`

**Step 1: Add a failing fallback API test for trash helpers**

Assert that the fallback API exposes:

- `workspace.getTrash`
- `documents.trash`
- `folders.trash`
- `workspace.restoreTrashItem`
- `workspace.deleteTrashItem`
- `workspace.emptyTrash`

Also assert that trashed documents disappear from the normal snapshot.

**Step 2: Add a failing Electron smoke expectation for trash lifecycle**

Assert that:

- soft-deleted documents disappear from normal reads
- restored documents return
- purged documents do not return

**Step 3: Run the focused tests and confirm failure**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts src/test/electronPersistenceSmoke.test.ts`

Expected: FAIL because trash APIs and filtering do not exist yet.

### Task 2: Implement soft-delete schema, repository behavior, and IPC

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/schema.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/index.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/documents.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/folders.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/search.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/server.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/preload.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/preload.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`

**Step 1: Extend schema and migration helpers**

Add:

- `documents.deleted_at`
- `documents.trash_root_id`
- `folders.deleted_at`
- `folders.trash_root_id`

Make startup migration add missing columns for existing databases.

**Step 2: Make normal queries hide deleted records**

Update document/folder list and get queries so normal app reads only return `deleted_at IS NULL`.

**Step 3: Add trash operations**

Implement minimal repository operations for:

- list trash roots by space
- trash document
- trash folder package
- restore trash root
- purge trash root
- empty space trash

Ensure folder-package delete marks descendants with the same `trash_root_id`.

**Step 4: Wire search and share behavior**

Remove trashed documents from search entries, restore them on recovery, and ensure share routes cannot resolve trashed documents.

**Step 5: Expose the contract over preload and fallback mode**

Add new typed API methods and fallback implementations for trash flows.

**Step 6: Re-run the focused data tests**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts src/test/electronPersistenceSmoke.test.ts`

Expected: PASS

### Task 3: Add failing UI tests for trash view and settings modal

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/TrashCenterPane.test.tsx`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SettingsModal.test.tsx`

**Step 1: Add a failing app-level test for trashing and restoring a document**

Assert that deleting a document removes it from the tree, shows it in `回收站`, and allows restoring it.

**Step 2: Add a failing app-level test for trashing a folder package**

Assert that deleting a folder creates a single trash entry and restoring it returns the folder and nested document.

**Step 3: Add a failing settings-modal test**

Assert that clicking `设置` opens a modal and no longer renders the inline settings panel inside the space switcher.

**Step 4: Add a focused trash center-pane test**

Assert list ordering, counts, restore button, purge button, and empty-state copy.

**Step 5: Run the focused UI tests and confirm failure**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx src/features/shell/TrashCenterPane.test.tsx src/features/shell/SettingsModal.test.tsx`

Expected: FAIL because the trash view and settings modal do not exist yet.

### Task 4: Implement trash state and center-pane UI

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workspaceSelectors.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/workspaceSessionTypes.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/workspaceSessionActionTypes.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceSession.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceContentActions.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SidebarTreeItems.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/TrashCenterPane.tsx`

**Step 1: Extend collection-view state with `trash`**

Add `trash` to the active view state and reset it correctly when opening a concrete document or switching spaces.

**Step 2: Wire left sidebar trash entry**

Make the existing `回收站` button switch the center pane to trash view and visually reflect the active state.

**Step 3: Change destructive tree actions into trash actions**

Update document/folder delete UI copy to “移到回收站” and route actions through the new trash methods.

**Step 4: Build the trash center pane**

Render:

- trash title
- per-item metadata
- folder-package counts
- restore action
- purge action
- empty-trash action

**Step 5: Re-run the focused UI tests**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx src/features/shell/TrashCenterPane.test.tsx src/features/shell/SettingsModal.test.tsx`

Expected: PASS

### Task 5: Move settings into an app-level modal

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SpaceSwitcher.tsx`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SettingsModal.tsx`

**Step 1: Lift settings-open state out of the switcher**

Track modal visibility at the app or shell level instead of inside `LeftSidebar`.

**Step 2: Extract the existing settings content**

Move storage status and maintenance actions into a reusable `SettingsModal`.

**Step 3: Simplify the space switcher**

Leave only the button that requests the modal and remove the inline settings panel markup.

**Step 4: Re-run the focused settings tests**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/SettingsModal.test.tsx src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx`

Expected: PASS

### Task 6: Verify full health

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage`

**Step 1: Run full test suite**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`

Expected: PASS

**Step 2: Run typecheck**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`

Expected: PASS

**Step 3: Run production build**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected: PASS

### Outcome

After implementation:

- documents and folders use trash instead of immediate hard delete
- each space has an independent trash view
- folder deletions restore as a single package
- permanent delete removes attachment directories at the correct lifecycle stage
- settings open in a dedicated modal instead of inside the space switcher
