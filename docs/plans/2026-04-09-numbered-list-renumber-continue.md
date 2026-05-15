# Numbered List Renumber Continue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight contextual menu for numbered list items that supports renumbering from 1 and continuing numbering from the previous numbered list.

**Architecture:** Detect the current cursor block inside `SharedBlockNoteSurface` using BlockNote selection APIs. When the active block is `numberedListItem`, render a small floating menu inside the editor surface. The menu updates the native BlockNote `numberedListItem.props.start` value via `editor.updateBlock`, avoiding forks or custom list indexing logic.

**Tech Stack:** React, TypeScript, BlockNote, Vitest, Testing Library

---

### Task 1: Add regression coverage for numbered-list menu behavior

**Files:**
- Add: `src/shared/editor/SharedBlockNoteSurfaceNumbering.test.tsx`

**Step 1: Write the failing test**

Assert that:
- A numbered-list contextual menu appears when the active cursor block is `numberedListItem`.
- Clicking `重新编号` calls `editor.updateBlock(currentBlock, { props: { start: 1 } })`.
- Clicking `继续编号` calls `editor.updateBlock(currentBlock, { props: { start: undefined } })` only when a previous block is also `numberedListItem`.
- The menu is not shown for non-numbered blocks.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceNumbering.test.tsx`
Expected: FAIL because no numbered-list contextual menu exists yet.

### Task 2: Implement the contextual numbered-list menu

**Files:**
- Modify: `src/shared/editor/SharedBlockNoteSurface.tsx`
- Modify: `src/shared/editor/SharedBlockNoteSurface.css`

**Step 1: Implement minimal state tracking**

Track the current numbered-list block and previous block from `editor.getTextCursorPosition()`, `editor.getPrevBlock()`, and selection/click updates.

**Step 2: Render the menu**

Render a compact menu near the top-left of the active list block when the active block is `numberedListItem`.

**Step 3: Implement commands**

Use `editor.updateBlock`:
- `重新编号`: set `props.start` to `1`
- `继续编号`: set `props.start` to `undefined`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceNumbering.test.tsx`
Expected: PASS

### Task 3: Verify focused editor regressions

**Files:**
- Verify: `src/shared/editor/SharedBlockNoteSurfaceNumbering.test.tsx`
- Verify: `src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`
- Verify: `src/shared/editor/SharedBlockNoteSurface.test.ts`
- Verify: `src/features/editor-host/EditorHost.test.tsx`
- Verify: `src/features/shell/QuickNoteCenterPane.test.tsx`

**Step 1: Run focused tests**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceNumbering.test.tsx src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx src/shared/editor/SharedBlockNoteSurface.test.ts src/features/editor-host/EditorHost.test.tsx src/features/shell/QuickNoteCenterPane.test.tsx`

**Step 2: Run typecheck**

Run: `npm run typecheck`
