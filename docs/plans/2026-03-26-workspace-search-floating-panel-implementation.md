# Workspace Search Floating Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render sidebar workspace search results as a floating panel anchored beneath the input without affecting sidebar height.

**Architecture:** Keep the compact single-line input as-is, but move the result states into an absolutely positioned panel inside a relative wrapper in `WorkspaceSearch`. Use a max-height plus internal scroll so long result sets stay inside the overlay instead of pushing surrounding sidebar content.

**Tech Stack:** React 18, TypeScript, Vitest, Tailwind CSS

---

### Task 1: Add failing floating-panel tests

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/WorkspaceSearch.test.tsx`

**Step 1: Write the failing test**

Add expectations that when the query is non-empty:
- the search shell is a relative anchor
- the result container is an absolute floating panel

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/WorkspaceSearch.test.tsx`

Expected: FAIL because the current result states still render in normal flow.

**Step 3: Write minimal implementation**

Update `WorkspaceSearch.tsx` to wrap the input in a relative anchor and render loading, empty, and result states inside an absolute panel.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/WorkspaceSearch.test.tsx`

Expected: PASS

### Task 2: Final verification

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/WorkspaceSearch.tsx`

**Step 1: Run component tests**

Run: `npm test -- src/features/shell/WorkspaceSearch.test.tsx`

**Step 2: Run production build**

Run: `npm run build`
