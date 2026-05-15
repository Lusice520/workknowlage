# P1-3 Verification

**Date:** 2026-05-07
**Verdict:** PASS

P1-3 can be considered closed. Sidebar association derivation now lives behind an app-level adapter, and `RightSidebar` renders prepared association data instead of recomputing workspace relationships during render.

## Acceptance Results

- PASS: `RightSidebar` no longer imports or calls `deriveSidebarAssociations(...)`.
- PASS: `AppShell` owns focused-outline-item state and injects prepared `associationState` into `RightSidebar`.
- PASS: `useSidebarAssociations` defers computation, caches results, and invalidates on semantic input changes including focused outline item and document tag changes.
- PASS: Sidebar rendering tests now validate prepared semantic results rather than relying on hidden derivation inside the component.
- PASS: Source-level guardrails protect the new app-layer association boundary.

## Key Module Sizes

- `src/shared/lib/sidebarAssociations.ts`: 629
- `src/app/useSidebarAssociations.ts`: 152
- `src/features/shell/RightSidebar.tsx`: 619

## Guardrails Added

- `src/app/useSidebarAssociations.test.tsx` verifies cache reuse, invalidation, and cache-key semantics.
- `src/features/shell/RightSidebarContract.test.ts` ensures association derivation stays outside the sidebar render path.

## Verification Commands

- `npm run typecheck`
- `npm test -- src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebarContract.test.ts src/features/shell/RightSidebar.test.tsx src/app/App.navigation.test.tsx`
- `npm test`
- `npm run build`
- `git diff --check`
- `npm run package:mac`
