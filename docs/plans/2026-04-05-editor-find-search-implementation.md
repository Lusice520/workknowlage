# Editor Find Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the coarse block-level BlockNote search prototype with exact in-text search highlights and precise match navigation.

**Architecture:** Keep the editor-local search panel in `SharedBlockNoteSurface`, but move match discovery and highlighting onto the underlying ProseMirror document. Store search state in React, render highlights through a dedicated ProseMirror decoration plugin, and move the active match with a true text selection plus viewport-centering scroll.

**Tech Stack:** React, TypeScript, BlockNote, Tiptap, ProseMirror, Vitest, Testing Library

---

### Task 1: Build precise search indexing and decoration utilities

**Files:**
- Create: `src/shared/editor/prosemirrorSearch.ts`
- Create: `src/shared/editor/prosemirrorSearch.test.ts`
- Modify: `src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`

**Step 1: Write the failing test**

Add tests that prove:
- multiple matches inside one paragraph produce distinct `{ from, to }` ranges
- nested content still yields ordered matches
- empty queries return no matches
- active match decoration is distinguishable from passive matches

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/prosemirrorSearch.test.ts`
Expected: FAIL because the module does not exist yet.

**Step 3: Write minimal implementation**

Implement a utility that:
- walks a ProseMirror document
- collects case-insensitive match ranges
- returns ordered match descriptors
- builds `DecorationSet` output for all matches and the active match

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/prosemirrorSearch.test.ts`
Expected: PASS

**Step 5: Commit**

Do not commit in this task unless explicitly requested.

### Task 2: Replace block-level search navigation with exact text selection

**Files:**
- Modify: `src/shared/editor/SharedBlockNoteSurface.tsx`
- Modify: `src/shared/editor/SharedBlockNoteSurface.css`
- Modify: `src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`

**Step 1: Write the failing test**

Extend the surface search test to prove:
- all matches are decorated inline
- the active match gets the strong highlight class
- typing in the search box does not call text-selection navigation
- explicit next/previous navigation calls precise text-selection logic instead of `setTextCursorPosition(blockId, "start")`
- the search input keeps focus after explicit navigation
- closing search removes decorations

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`
Expected: FAIL because the current implementation still highlights whole blocks and jumps to block start.

**Step 3: Write minimal implementation**

Update the shared surface to:
- keep search query and active match state
- register or update the decoration plugin on the underlying Tiptap editor
- set text selection to the active match range
- scroll the active match DOM range into the editor viewport center
- remove old block-level search highlight logic and CSS

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`
Expected: PASS

**Step 5: Commit**

Do not commit in this task unless explicitly requested.

### Task 3: Verify editor integrations did not regress

**Files:**
- Verify: `src/features/editor-host/EditorHost.test.tsx`
- Verify: `src/features/shell/QuickNoteCenterPane.test.tsx`
- Verify: `src/features/shell/QuickNoteCenterPaneUpload.test.tsx`
- Verify: `src/shared/editor/SharedBlockNoteSurface.test.ts`

**Step 1: Run the targeted regression suite**

Run:
`npm test -- src/features/editor-host/EditorHost.test.tsx src/features/shell/QuickNoteCenterPane.test.tsx src/features/shell/QuickNoteCenterPaneUpload.test.tsx src/shared/editor/SharedBlockNoteSurface.test.ts src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx src/shared/editor/prosemirrorSearch.test.ts`

Expected: PASS

**Step 2: Run typecheck**

Run:
`npm run typecheck`

Expected: PASS

**Step 3: Review cleanup**

Confirm the old coarse search helpers are removed or no longer referenced, and that search decorations clean up on close.

**Step 4: Commit**

Do not commit in this task unless explicitly requested.
