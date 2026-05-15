# Cross-Space Move From Sidebar Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users move a document or folder to another space from the left sidebar `...` menu by choosing a target space in a dialog.

**Architecture:** Add a lightweight modal at the shell level and trigger it from folder/document sidebar menus. Keep v1 intentionally narrow: choose a target space only, always move into that space root. Frontend actions call new cross-space API methods, Electron IPC delegates to repository helpers, and the main process re-syncs both source and target spaces so tree data, search, and backlinks stay correct.

**Tech Stack:** React, TypeScript, Electron IPC, better-sqlite3 repositories, Vitest, Testing Library

---

### Task 1: Add failing sidebar tests for the new menu flow

**Files:**
- Modify: `src/features/shell/LeftSidebar.test.tsx`

**Step 1: Write failing tests**

Assert that:
- The document `更多操作` menu exposes `移动到空间`.
- The folder `更多操作` menu exposes `移动到空间`.
- Clicking the action opens a dialog that lists spaces other than the current active space.
- Confirming the dialog calls the new move-to-space callbacks with the selected target space id.

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`
Expected: FAIL because the menu action and dialog do not exist yet.

### Task 2: Add the shell dialog and wire sidebar menu actions

**Files:**
- Add: `src/features/shell/MoveToSpaceModal.tsx`
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/features/shell/LeftSidebar.tsx`
- Modify: `src/features/shell/SidebarTreeItems.tsx`

**Step 1: Add shell state**

Track the pending move request (`document` or `folder`) and open/close the modal from `AppShell`.

**Step 2: Add sidebar menu entries**

Expose `移动到空间` for both documents and folders from the `...` menus without disturbing existing rename/delete actions.

**Step 3: Implement the modal**

Render a focused dialog that:
- Shows the selected item name
- Lists other spaces as buttons or selectable rows
- Confirms move into the chosen space root
- Disables the confirm button until a target space is selected

### Task 3: Add cross-space workspace actions and API contracts

**Files:**
- Modify: `src/app/workspaceSessionActionTypes.ts`
- Modify: `src/app/useWorkspaceSessionActions.ts`
- Modify: `src/app/useWorkspaceContentActions.ts`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/shared/lib/workKnowlageApi.ts`
- Modify: `electron/preload.cjs`

**Step 1: Extend action types**

Add explicit methods for moving a folder/document to another space root.

**Step 2: Implement frontend actions**

Call the new API methods, reload workspace state, and switch to the target space when the moved item is the currently active document or folder context.

**Step 3: Mirror in browser mock and preload**

Keep the browser fallback and preload contract aligned with the desktop API shape.

### Task 4: Implement Electron IPC and repository move helpers

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/db/repositories/folders.cjs`
- Modify: `electron/db/repositories/documents.cjs`

**Step 1: Add IPC handlers**

Expose `folders:moveToSpace` and `documents:moveToSpace`.

**Step 2: Implement repository helpers**

- Document move: update `space_id`, reset `folder_id` to `null`.
- Folder move: update the folder subtree to the new `space_id`, move the root folder to `parent_id = null`, and update descendant documents to the new `space_id`.

**Step 3: Re-sync source and target spaces**

After a move completes, refresh search and backlinks for both spaces.

### Task 5: Verify focused regressions

**Files:**
- Verify: `src/features/shell/LeftSidebar.test.tsx`
- Verify: `src/features/shell/SidebarTreeItems.tsx`
- Verify: `src/app/useWorkspaceContentActions.ts`
- Verify: `electron/main.cjs`
- Verify: `electron/db/repositories/folders.cjs`
- Verify: `electron/db/repositories/documents.cjs`

**Step 1: Run focused tests**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

**Step 2: Run broader regressions**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx src/features/shell/QuickNoteCenterPane.test.tsx src/features/editor-host/EditorHost.test.tsx`

**Step 3: Run typecheck**

Run: `npm run typecheck`
