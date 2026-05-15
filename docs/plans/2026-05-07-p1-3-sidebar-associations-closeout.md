# P1-3 Sidebar Associations Closeout Plan

**Date:** 2026-05-07
**Status:** Completed

## Goal

Close P1-3 by moving sidebar association derivation out of `RightSidebar` render flow and behind an app-level adapter that can cache, defer, and invalidate prepared association view models.

## Closeout Criteria

- `RightSidebar` consumes prepared association state instead of calling `deriveSidebarAssociations(...)` during render.
- Association derivation is orchestrated from the app layer with invalidation tied to active document, workspace content, folder tree, and focused outline item.
- Sidebar rendering tests assert UI behavior from prepared association data instead of full workspace recomputation inside the component.
- Source-level guardrails prevent future regressions back into the old coupling shape.

## Implemented Shape

- Added `src/app/useSidebarAssociations.ts` as the app-layer adapter for deferred association computation.
- Moved focused-outline-item state into `src/features/shell/AppShell.tsx`, which now owns association orchestration and passes prepared state into `RightSidebar`.
- Kept `src/shared/lib/sidebarAssociations.ts` as the pure derivation layer, but removed direct invocation from sidebar rendering.
- Updated sidebar behavior tests so semantic results are supplied explicitly as prepared view models.
- Added source and hook contract coverage to lock the boundary.

## Guardrails Added

- `src/app/useSidebarAssociations.test.tsx`
- `src/features/shell/RightSidebarContract.test.ts`

## Verification Targets

- `npm run typecheck`
- `npm test -- src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebarContract.test.ts src/features/shell/RightSidebar.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`
