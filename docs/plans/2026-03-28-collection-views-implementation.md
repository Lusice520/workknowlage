# Collection Views Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship phase-one collection views by turning `所有笔记 / 收藏夹` into real center-pane views backed by persisted favorites and a single workspace snapshot loader.

**Architecture:** Extend the document model with a persisted `isFavorite` flag, add a workspace snapshot API that returns all folders and documents for a space in one call, and introduce a small view-state layer so the app can switch between tree-driven document editing and collection-driven list pages without disturbing the existing file tree.

**Tech Stack:** Electron, SQLite, React, TypeScript, Vitest

---

### Task 1: Add failing tests for the new data contract

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workspaceSelectors.test.ts`

**Step 1: Add a failing fallback API test for favorites and workspace snapshot**

Assert that:

- documents expose `isFavorite`
- a new snapshot API returns both folders and documents
- toggling favorite persists in fallback mode

**Step 2: Add a failing selector test for snapshot-based workspace loading**

Assert that `loadWorkspaceState` prefers the snapshot API over per-folder document listing when available.

**Step 3: Run the focused tests and confirm failure**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts src/shared/lib/workspaceSelectors.test.ts`

Expected: FAIL because snapshot and favorites do not exist yet.

### Task 2: Implement workspace snapshot and document favorites in the data layer

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/schema.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/documents.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/preload.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/preload.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`

**Step 1: Extend schema and assembled document shape**

Add `is_favorite` to `documents` and map it onto `DocumentRecord.isFavorite`.

**Step 2: Add repository operations**

Implement:

- `listWorkspaceSnapshot(spaceId)`
- document favorite update support through `documents.update`

**Step 3: Expose snapshot over preload**

Add a new `workspace.getSnapshot(spaceId)` API shape in Electron and fallback mode.

**Step 4: Re-run the focused data tests**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts src/shared/lib/workspaceSelectors.test.ts`

Expected: PASS

### Task 3: Add failing UI tests for collection views

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CollectionCenterPane.test.tsx`

**Step 1: Add a failing app-level test for opening `所有笔记`**

Assert that clicking `所有笔记` shows a collection page instead of the current document editor.

**Step 2: Add a failing app-level test for favorites persistence in the view**

Assert that favoriting a document makes it appear inside `收藏夹`, and removing the favorite removes it.

**Step 3: Add a focused collection-pane render test**

Assert sorting, counts, empty state copy, and item click behavior.

**Step 4: Run the focused UI tests and confirm failure**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx src/features/shell/CollectionCenterPane.test.tsx`

Expected: FAIL because collection view UI does not exist yet.

### Task 4: Implement collection view state and center-pane UI

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
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CollectionCenterPane.tsx`

**Step 1: Add collection-view session state**

Track:

- `tree`
- `all-notes`
- `favorites`

Reset it when opening a concrete document or switching spaces.

**Step 2: Wire left sidebar quick links**

Make `所有笔记 / 收藏夹` buttons actually switch the center pane into collection mode and visually reflect active state.

**Step 3: Build the collection center pane**

Render:

- collection title
- total count
- empty state
- sorted document rows
- inline favorite toggle

**Step 4: Make row click open the target document**

Opening an item should restore the normal editor center pane.

**Step 5: Re-run the focused UI tests**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx src/features/shell/LeftSidebar.test.tsx src/features/shell/CollectionCenterPane.test.tsx`

Expected: PASS

### Task 5: Verify end-to-end health

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

- `所有笔记 / 收藏夹` become real views
- favorites persist in SQLite and browser fallback mode
- workspace loading uses a single snapshot API
- the existing tree, quick notes, search, and editor flows continue to work
