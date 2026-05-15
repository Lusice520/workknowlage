# P2-4c Document-Grouped Fragment Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Group block-level workspace search hits by parent document so repeated fragment matches are easier to scan.

**Architecture:** Keep the search API flat and ranked, pass document metadata into the search presentation layer, then render the `命中片段` section as document cards with nested fragment buttons. Interactive selection still maps back to the original result records.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Extend search result presentation metadata

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.tsx`
- Modify: `src/features/shell/LeftSidebar.tsx`

Pass through the parent `documentId` needed to group fragment hits reliably without relying on titles alone.

### Task 2: Render document-grouped fragment cards

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.tsx`
- Verify: `src/features/shell/WorkspaceSearch.test.tsx`

Render fragment hits as:
- document header
- hit count badge
- nested fragment result rows

Keep existing summary counts and other sections.

### Task 3: Verify navigation behavior still holds

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.test.tsx`
- Verify: `src/app/App.navigation.test.tsx`

Cover:
- multiple fragment hits grouped under one document
- first-result keyboard selection still picks the highest-ranked fragment
- click selection still resolves the original result record

### Task 4: Verification and closeout

**Files:**
- Create: `docs/plans/2026-05-07-p2-4c-document-grouped-fragments-verification.md`

Run:
- `npm run typecheck`
- `npm test -- src/features/shell/WorkspaceSearch.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`
