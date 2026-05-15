# P2-4a Block Search Index Verification

**Date:** 2026-05-07
**Status:** Passed

## What Landed

- Added a parallel SQLite + FTS5 block-search index:
  - `workspace_block_search_entries`
  - `workspace_block_search`
- Extended workspace search results with `document-block` hits carrying:
  - `documentId`
  - `blockId`
  - `fallbackText`
- Merged block hits into the existing workspace search API without removing document or quick-note hits.
- Wired block hits through app navigation so selecting a fragment opens the document and targets the matching block.
- Mirrored the behavior in the browser mock path so app and component tests stay representative outside Electron.
- Added compatibility for mixed persisted content shapes:
  - modern BlockNote blocks
  - legacy section-style seed content
  - inline `@docMention` text in block-level extraction
- Added a focus UX fallback in `EditorHost`: when block navigation succeeds but transient text highlight cannot match, the target block still receives a temporary block-level highlight.

## Verification Run

Passed:

- `npm run typecheck`
- `npm test -- src/app/App.navigation.test.tsx src/features/editor-host/EditorHost.test.tsx src/shared/lib/workKnowlageApi.test.ts electron/db/repositories/search.smoke.test.ts`
- `npm test`
- `npm run build`
- `git diff --check`

Observed results:

- Full test suite passed: `66 files / 265 tests`
- Production build passed
- `git diff --check` passed cleanly

## Coverage Added

- `electron/db/repositories/search.smoke.test.ts`
  - accepts merged block-first ordering for seeded search
  - verifies persisted block hits survive reopen
- `src/shared/lib/workKnowlageApi.test.ts`
  - verifies block hits from both legacy section content and BlockNote content
- `src/app/App.navigation.test.tsx`
  - verifies selecting a block hit opens the correct document and clears the search UI
- `src/features/editor-host/EditorHost.test.tsx`
  - verifies no-match transient search falls back to block-level highlight with diagnostics

## Remaining Risks / Next Slice

- Search ranking is still intentionally simple; block hits are merged into the current flat result list rather than grouped or tuned with richer ranking signals.
- Quick notes are still indexed only at the note level, not the block level.
- Build still reports large chunk warnings; this does not block P2-4a but remains a follow-up performance task.
- The natural next slice is `P2-4b`: upgrade the sidebar search UI from a flat list to a clearer "document + fragment" browsing experience with stronger jump affordances.
