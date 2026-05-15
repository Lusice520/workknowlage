# P2-4b Search UI Grouping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the left-sidebar workspace search panel from a flat mixed result list to a grouped "fragment / document / quick note" browsing experience.

**Architecture:** Keep the search API and ranking unchanged, then derive visual sections inside the React search component. Preserve the existing flat keyboard-selection model so behavior stays stable while the presentation becomes clearer.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Add grouped result presentation to the search panel

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.tsx`
- Verify: `src/features/shell/WorkspaceSearch.test.tsx`

Add:
- grouped section derivation by result kind
- compact result summary row
- per-kind action hint copy

Keep:
- current input behavior
- current click behavior
- current highlight behavior

### Task 2: Keep the sidebar integration stable

**Files:**
- Modify: `src/features/shell/LeftSidebar.tsx`
- Verify: `src/app/App.navigation.test.tsx`

Only pass through the metadata needed by the grouped presentation and make sure selecting a row still resolves back to the original search record.

### Task 3: Add verification coverage

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.test.tsx`
- Verify: `src/features/shell/WorkspaceSearch.test.tsx`
- Verify: `src/app/App.navigation.test.tsx`

Cover:
- section headers
- counts
- fragment/document/note hints
- keyboard navigation still selecting the expected interactive result

### Task 4: Verification and closeout

**Files:**
- Create: `docs/plans/2026-05-07-p2-4b-search-ui-grouping-verification.md`

Run:
- `npm run typecheck`
- `npm test -- src/features/shell/WorkspaceSearch.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`
