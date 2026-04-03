# RichTable Scroll And Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RichTable default to 3 columns, start horizontal scrolling from 6 columns onward, and keep the table toolbar sticky while it scrolls horizontally with the table.

**Architecture:** Extract RichTable layout rules into a small pure helper so default column count and scroll thresholds are testable. Then restructure the RichTable editor shell so the toolbar and table live in the same horizontal scroll track, with the toolbar using sticky top positioning instead of absolute floating coordinates.

**Tech Stack:** React, TipTap table extension, BlockNote custom block renderer, Vitest, CSS

---

### Task 1: Capture RichTable layout rules in tests

**Files:**
- Create: `src/shared/editor/richTableLayout.ts`
- Create: `src/shared/editor/richTableLayout.test.ts`
- Modify: `src/shared/editor/RichTableStyles.test.ts`

**Step 1: Write the failing test**

Add tests that require:
- the default RichTable document to have 3 columns
- the horizontal scroll threshold to start at 6 columns
- the computed minimum track width to stay fluid below 6 columns and widen from 6 columns onward
- the CSS source to include the shared horizontal scroll track and sticky toolbar rules

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/richTableLayout.test.ts src/shared/editor/RichTableStyles.test.ts`
Expected: FAIL because the helper file and new CSS rules do not exist yet

**Step 3: Write minimal implementation**

Implement a helper module exporting:
- default column count
- scroll threshold
- minimum column width
- default table document builder
- table column count reader
- horizontal track width calculator

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/richTableLayout.test.ts src/shared/editor/RichTableStyles.test.ts`
Expected: PASS

### Task 2: Move RichTable to a shared horizontal track

**Files:**
- Modify: `src/shared/editor/RichTable.tsx`
- Modify: `src/shared/editor/RichTable.css`

**Step 1: Write the failing test**

Add or extend source-level assertions so RichTable must:
- use the new default table document helper
- render a horizontal scroll shell and track
- apply sticky toolbar layout instead of absolute top/left positioning

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/richTableLayout.test.ts src/shared/editor/RichTableStyles.test.ts`
Expected: FAIL because the RichTable component still uses the old floating toolbar and inner table wrapper scrolling

**Step 3: Write minimal implementation**

Refactor RichTable so:
- new tables start at 3 columns
- toolbar and editor content live in one horizontal scroll track
- track width is derived from current column count and starts widening at 6 columns
- toolbar uses sticky top positioning and horizontal motion comes from the shared track
- old floating toolbar position state and resize/scroll listeners are removed

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/richTableLayout.test.ts src/shared/editor/RichTableStyles.test.ts`
Expected: PASS

### Task 3: Regression verification

**Files:**
- Modify: `src/shared/editor/RichTable.tsx`
- Modify: `src/shared/editor/RichTable.css`
- Test: `src/shared/editor/richTableLayout.test.ts`
- Test: `src/shared/editor/RichTableStyles.test.ts`

**Step 1: Run focused verification**

Run: `npm test -- src/shared/editor/richTableLayout.test.ts src/shared/editor/RichTableStyles.test.ts`
Expected: PASS

**Step 2: Run type safety checks**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-04-03-rich-table-scroll-and-toolbar.md src/shared/editor/richTableLayout.ts src/shared/editor/richTableLayout.test.ts src/shared/editor/RichTable.tsx src/shared/editor/RichTable.css src/shared/editor/RichTableStyles.test.ts
git commit -m "feat: improve rich table scroll and sticky toolbar"
```
