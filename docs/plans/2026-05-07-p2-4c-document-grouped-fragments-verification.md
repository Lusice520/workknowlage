# P2-4c Document-Grouped Fragment Search Verification

**Date:** 2026-05-07
**Status:** Passed

## What Landed

- Changed the `命中片段` section from a flat row list to document-grouped fragment cards.
- Each fragment card now shows:
  - parent document title
  - hit count badge
  - one interactive row per matching fragment
- Preserved the existing search API and result ordering.
- Preserved click selection and keyboard navigation across the grouped presentation.
- Passed `documentId` through the sidebar search presentation layer so fragment grouping does not rely on titles alone.

## Verification Run

Passed:

- `npm run typecheck`
- `npm test -- src/features/shell/WorkspaceSearch.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`

Observed results:

- Full test suite passed: `66 files / 268 tests`
- Production build passed
- `git diff --check` passed cleanly

## Coverage Added / Updated

- `src/features/shell/WorkspaceSearch.test.tsx`
  - verifies grouped fragment cards under one parent document
  - verifies hit counts remain correct after grouping
  - preserves keyboard selection of the highest-ranked fragment result
- `src/app/App.navigation.test.tsx`
  - confirms fragment click selection still opens and focuses the correct document target

## Remaining Follow-up

- Fragment rows still do not visually emphasize matched terms inside the preview.
- Fragment groups are not collapsible yet.
- The next likely UX pass is matched-term emphasis plus optional "show more fragments" behavior for documents with many hits.
