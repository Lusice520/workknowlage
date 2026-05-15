# P2-4d Search Match Highlighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add UI-side query-term highlighting to workspace search previews so matched content is easier to scan.

**Architecture:** Keep search results and previews unchanged from the backend, then add a reusable highlighting helper inside the search presentation layer that marks matching query spans for fragment, document, and quick-note rows.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Add preview highlighting helpers

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.tsx`

Add:
- query token normalization
- text span matching
- reusable highlighted preview renderer

### Task 2: Apply highlighting across result rows

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.tsx`
- Verify: `src/features/shell/WorkspaceSearch.test.tsx`

Use the helper for:
- grouped fragment rows
- document rows
- quick-note rows

### Task 3: Verification coverage

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.test.tsx`
- Verify: `src/app/App.navigation.test.tsx`

Cover:
- grouped fragment rows keep rendering and show highlighted terms
- document and quick-note previews also highlight terms
- selection behavior is unaffected

### Task 4: Verification and closeout

**Files:**
- Create: `docs/plans/2026-05-07-p2-4d-search-match-highlighting-verification.md`

Run:
- `npm run typecheck`
- `npm test -- src/features/shell/WorkspaceSearch.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`
