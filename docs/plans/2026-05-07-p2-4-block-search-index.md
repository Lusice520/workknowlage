# P2-4 Block Search Index Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first block-level workspace search slice so search can return direct block hits and open them in-place inside documents.

**Architecture:** Keep the current document/quick-note search index intact and add a parallel block-level SQLite + FTS5 index. Merge result sets in the repository layer, then extend frontend result typing and selection flow so existing UI can consume the new `document-block` result kind with minimal churn.

**Tech Stack:** Electron, SQLite FTS5, React, TypeScript, Vitest

---

### Task 1: Add block-search schema and repository helpers

**Files:**
- Modify: `electron/db/schema.cjs`
- Modify: `electron/db/repositories/search.cjs`
- Verify: `electron/db/repositories/search.smoke.test.ts`

Add:
- `workspace_block_search_entries`
- `workspace_block_search` FTS table
- FTS triggers for insert/update/delete

Then add repository helpers to:
- parse BlockNote JSON into searchable blocks
- build block-level title/body search text
- upsert/remove block search entries per document

### Task 2: Merge block hits into workspace search results

**Files:**
- Modify: `electron/db/repositories/search.cjs`
- Modify: `src/shared/types/preload.ts`
- Verify: `electron/db/repositories/search.smoke.test.ts`

Extend search result typing with:
- `kind: 'document-block'`
- `blockId`
- `fallbackText`

Update `searchWorkspace(...)` to merge:
- existing document hits
- existing quick-note hits
- new block hits

### Task 3: Extend browser mock search and app typing

**Files:**
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Modify: `src/shared/lib/workKnowlageSearchUtils.ts`
- Modify: `src/app/useWorkspaceSearch.ts`
- Verify: `src/app/App.test.tsx`

Mirror the new block-hit behavior in the browser mock so test runs and non-Electron flows remain representative.

### Task 4: Render and open block hits in the existing search UI

**Files:**
- Modify: `src/features/shell/WorkspaceSearch.tsx`
- Modify: `src/features/shell/LeftSidebar.tsx`
- Modify: `src/app/App.tsx`
- Verify: `src/features/shell/WorkspaceSearch.test.tsx`
- Verify: `src/app/App.navigation.test.tsx`

Update the compact search panel to:
- render `document-block` as `片段`
- display document title + snippet coherently
- route block hits through existing document focus navigation

### Task 5: Verification

**Files:**
- Update: `docs/plans/2026-05-07-p2-4-block-search-index-design.md` if implementation differs materially
- Create: `docs/plans/2026-05-07-p2-4-block-search-index-verification.md`

Run:
- `npm run typecheck`
- `npm test -- electron/db/repositories/search.smoke.test.ts src/features/shell/WorkspaceSearch.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`
