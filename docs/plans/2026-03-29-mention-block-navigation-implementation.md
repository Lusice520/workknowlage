# Mention Block Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let incoming backlink cards open the source document and focus the exact block that contains the mention.

**Architecture:** Persist `sourceBlockId` when extracting backlinks, thread `{ documentId, blockId, requestKey }` through session state, and have the editor layer scroll/highlight the matching DOM block by `data-id`.

**Tech Stack:** Electron, SQLite, React 18, Vite, Vitest, BlockNote

---

### Task 1: Persist source block ids in backlinks

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/documentContent.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/backlinks.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/documents.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/electronPersistenceSmoke.test.ts`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/scripts/electronPersistenceSmoke.cjs`

**Step 1: Write the failing smoke assertions**

- Extend the smoke script output so it expects `sourceBlockId` on rebuilt backlinks.
- Extend the smoke test to assert `sourceBlockId` is present after reopen.

**Step 2: Run the smoke test to verify it fails**

Run: `npm test -- --run src/test/electronPersistenceSmoke.test.ts`
Expected: FAIL because backlink payload has no `sourceBlockId`.

**Step 3: Implement minimal persistence changes**

- In `documentContent.cjs`, include the current source block id when extracting mentions.
- In `backlinks.cjs`, write `source_block_id`.
- In `documents.cjs`, read `source_block_id AS sourceBlockId`.
- In `workspace.ts`, add `sourceBlockId?: string | null` to `BacklinkRecord`.

**Step 4: Run the smoke test again**

Run: `npm test -- --run src/test/electronPersistenceSmoke.test.ts`
Expected: PASS.

### Task 2: Thread block-focus requests through the app session

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/workspaceSessionActionTypes.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceSession.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceSessionActions.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.test.tsx`

**Step 1: Write the failing app-level test**

- Add a test that clicks an incoming backlink and expects the opened editor path to receive the linked `blockId`.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/app/App.test.tsx`
Expected: FAIL because only `documentId` is propagated today.

**Step 3: Implement minimal session state**

- Add a focus request object with `documentId`, `blockId`, `requestKey`.
- Extend `openDocument` to accept optional `focusBlockId`.
- Pass the focus request through `App -> AppShell -> CenterPane -> EditorHost`.

**Step 4: Run the focused app test**

Run: `npm test -- src/app/App.test.tsx`
Expected: PASS.

### Task 3: Make the editor scroll and highlight the targeted block

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/editor-host/EditorHost.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.tsx` only if `EditorHost` needs a shared helper
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.css` only if highlight styling lives there
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/editor-host/EditorHost.test.tsx`

**Step 1: Write the failing editor-host test**

- Mock an editor surface/root element with a block carrying `data-id="mention-block-1"`.
- Assert that a focus request scrolls the block into view and applies a highlight class.
- Assert a second request with a new `requestKey` retriggers the effect.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/editor-host/EditorHost.test.tsx`
Expected: FAIL because there is no focus/highlight effect today.

**Step 3: Implement minimal focus behavior**

- After editor mount or request change, locate the DOM node by `data-id`.
- Scroll it into view.
- Add a temporary highlight class and remove it after a timeout.
- Best effort: move text cursor to the block start when `editor.setTextCursorPosition` is available.
- If the block is missing, no-op safely.

**Step 4: Run the focused editor-host test**

Run: `npm test -- src/features/editor-host/EditorHost.test.tsx`
Expected: PASS.

### Task 4: Update backlink click handling in the right sidebar

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/RightSidebar.tsx`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/RightSidebar.test.tsx`

**Step 1: Write the failing sidebar test**

- Incoming backlink click should call the open callback with both `documentId` and `blockId`.
- Outgoing mention click should continue to call the callback with only `documentId`.

**Step 2: Run the focused sidebar test to verify it fails**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`
Expected: FAIL because the callback only receives a string today.

**Step 3: Implement minimal callback shape change**

- Change the callback prop to a small object payload.
- Wire incoming backlinks with `sourceBlockId`.
- Keep outgoing mentions document-only.

**Step 4: Run the focused sidebar test**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`
Expected: PASS.

### Task 5: Final verification

**Files:**
- No new files.

**Step 1: Run focused suite**

Run:
- `npm test -- src/features/shell/RightSidebar.test.tsx`
- `npm test -- src/features/editor-host/EditorHost.test.tsx`
- `npm test -- src/app/App.test.tsx`
- `npm test -- --run src/test/electronPersistenceSmoke.test.ts`

Expected: PASS.

**Step 2: Run full verification**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`

Expected: PASS, with no new warnings beyond the known chunk size warning.
