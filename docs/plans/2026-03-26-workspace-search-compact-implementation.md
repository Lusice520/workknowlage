# Workspace Search Compact Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compress the sidebar workspace search into a single-line default state with a stable 12px input font size.

**Architecture:** Keep the existing search behavior and result panel logic, but simplify the default empty-query layout in `WorkspaceSearch`. Use a stronger input style override to guarantee the rendered font size stays at 12px and remove the empty-state helper copy entirely.

**Tech Stack:** React 18, TypeScript, Vitest, Tailwind CSS

---

### Task 1: Add failing compact-layout tests

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/WorkspaceSearch.test.tsx`

**Step 1: Write the failing test**

Add expectations that:
- the helper text is absent when the query is empty
- the search input uses compact height
- the search input has an explicit 12px font-size style

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/WorkspaceSearch.test.tsx`

Expected: FAIL because helper text still renders and the input is not yet explicitly styled to 12px.

**Step 3: Write minimal implementation**

Update `WorkspaceSearch.tsx` to remove the helper text, tighten the empty-state wrapper, and add a compact input style override.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/WorkspaceSearch.test.tsx`

Expected: PASS

### Task 2: Verify the rest of the search behavior still works

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/WorkspaceSearch.tsx`

**Step 1: Run the component test file**

Run: `npm test -- src/features/shell/WorkspaceSearch.test.tsx`

**Step 2: Run production build**

Run: `npm run build`
