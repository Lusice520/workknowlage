# P1-1 Boundary Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish P1-1 so App/session/api boundaries are explicit, test-guarded, and no longer mixed with unrelated P1-2/P1-3 work.

**Architecture:** Keep `App` as the composition root, `AppShell` as layout orchestration, app hooks as session/action owners, and `shared/lib/workKnowlageApi.ts` as the runtime API entry only. Move implementation details into dedicated shared modules and add source-level contract tests so the boundary does not regress quietly.

**Tech Stack:** React 18, TypeScript, Vitest, Electron preload IPC, browser mock API.

---

## P1-1 Satisfaction Criteria

- `AppShell` has a small, stable prop surface: only shell-local presentation props are allowed. Workspace, search, share, export, and data tools flow through typed context values.
- `src/shared/lib/workKnowlageApi.ts` stays thin: runtime detection, fallback factory wiring, and runtime status only. Mock behavior, tree mutation helpers, and search helpers live outside it.
- `collectTreePackageIds` has one canonical implementation, imported by app/session code and browser mock code.
- UI components under `src/features/**` do not import `getWorkKnowlageApi`; API calls stay in `src/app/**` hooks or `src/shared/lib/**` adapters.
- P1-1 does not carry P1-2/P1-3 behavior as hidden scope. Cross-space move, right-sidebar association computation, and rich-table work are either documented as existing scope bleed or moved to their own plan.
- Verification is green: `npm run typecheck`, `npm test`, and `git diff --check`.

## Non-Goals

- Do not move `deriveSidebarAssociations` out of `RightSidebar` in this phase. That belongs to P1-3.
- Do not split `SharedBlockNoteSurface` in this phase. That belongs to P1-2.
- Do not redesign cross-space move UX in this phase.
- Do not refactor rich table internals beyond fixing test or lifecycle regressions already identified.

## Task 1: Add P1-1 Source Boundary Contract Tests

**Files:**
- Create: `src/app/P1BoundaryContracts.test.ts`
- Read: `src/features/shell/AppShell.tsx`
- Read: `src/shared/lib/workKnowlageApi.ts`
- Read: `src/app/useWorkspaceContentActions.ts`
- Read: `src/shared/lib/workKnowlageApi.mock.ts`

**Step 1: Write failing contract tests**

Create `src/app/P1BoundaryContracts.test.ts` with tests that assert:

```ts
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('P1-1 boundary contracts', () => {
  test('AppShell keeps a narrow prop surface', () => {
    const source = read('src/features/shell/AppShell.tsx');
    const propsBlock = source.match(/interface AppShellProps \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const propNames = [...propsBlock.matchAll(/^\s+([a-zA-Z0-9_]+)\??:/gm)].map((match) => match[1]);

    expect(propNames).toEqual(['documentNavigationFeedback']);
  });

  test('feature components do not import the runtime API directly', () => {
    const featureFiles = fs
      .readdirSync(path.join(repoRoot, 'src/features'), { recursive: true })
      .filter((entry) => typeof entry === 'string' && /\.(ts|tsx)$/.test(entry));

    const offenders = featureFiles
      .map((entry) => `src/features/${entry}`)
      .filter((filePath) => read(filePath).includes('getWorkKnowlageApi'));

    expect(offenders).toEqual([]);
  });

  test('workKnowlageApi remains runtime wiring rather than mock implementation', () => {
    const source = read('src/shared/lib/workKnowlageApi.ts');

    expect(source).toContain('createMutableFallbackDesktopApi');
    expect(source).not.toContain('extractSearchableText');
    expect(source).not.toContain('ensureFolderMoveIsValid');
    expect(source).not.toContain('rebuildBacklinksForSpace');
  });

  test('tree package collection has one shared implementation', () => {
    expect(read('src/shared/lib/workKnowlageTree.ts')).toContain('export const collectTreePackageIds');
    expect(read('src/app/useWorkspaceContentActions.ts')).toContain("from '../shared/lib/workKnowlageTree'");
    expect(read('src/shared/lib/workKnowlageApi.mock.ts')).toContain("from './workKnowlageTree'");
  });
});
```

**Step 2: Run the contract test**

Run: `npm test -- src/app/P1BoundaryContracts.test.ts`

Expected: It may fail if any current boundary is still too loose. Treat failures as the implementation checklist for Tasks 2-4.

**Step 3: Commit**

```bash
git add src/app/P1BoundaryContracts.test.ts
git commit -m "test: guard P1 app api boundaries"
```

## Task 2: Tighten AppShell and Context Boundary

**Files:**
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/app/contexts/WorkspaceSessionContext.tsx`
- Modify: `src/app/contexts/SearchContext.tsx`
- Modify: `src/app/contexts/ShareContext.tsx`
- Modify: `src/app/contexts/ExportContext.tsx`
- Modify: `src/app/contexts/DataToolsContext.tsx`
- Test: `src/app/P1BoundaryContracts.test.ts`
- Test: `src/features/shell/AppShellLayout.test.tsx`

**Step 1: Run the focused tests before changing code**

Run: `npm test -- src/app/P1BoundaryContracts.test.ts src/features/shell/AppShellLayout.test.tsx`

Expected: `P1BoundaryContracts` should identify any prop or direct API violations.

**Step 2: Remove any AppShell prop drift**

Keep `AppShellProps` to:

```ts
interface AppShellProps {
  documentNavigationFeedback?: string | null;
}
```

If new shell behavior needs data, route it through the existing typed context that owns that domain.

**Step 3: Keep contexts domain-shaped**

Each context should expose one concern:

- `WorkspaceSessionContext`: workspace state, active document/folder/space, tree actions, trash actions, editor persistence callbacks.
- `SearchContext`: query, results, loading, result selection.
- `ShareContext`: share state and share actions.
- `ExportContext`: export state and export actions.
- `DataToolsContext`: runtime/storage/settings/data tool actions.

Do not add generic app-wide bags or raw API objects.

**Step 4: Re-run focused tests**

Run: `npm test -- src/app/P1BoundaryContracts.test.ts src/features/shell/AppShellLayout.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/shell/AppShell.tsx src/app/contexts src/app/P1BoundaryContracts.test.ts src/features/shell/AppShellLayout.test.tsx
git commit -m "refactor: tighten AppShell context boundary"
```

## Task 3: Keep Runtime API Entry Thin

**Files:**
- Modify: `src/shared/lib/workKnowlageApi.ts`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Modify: `src/shared/lib/workKnowlageTree.ts`
- Modify: `src/shared/lib/workKnowlageSearchUtils.ts`
- Test: `src/shared/lib/workKnowlageApi.test.ts`
- Test: `src/app/P1BoundaryContracts.test.ts`

**Step 1: Run focused API tests**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts src/app/P1BoundaryContracts.test.ts`

Expected: PASS or boundary-specific failure only.

**Step 2: Enforce `workKnowlageApi.ts` scope**

The file should contain only:

- `WorkKnowlageRuntimeStatus`
- `createFallbackDesktopApi`
- `fallbackDesktopApi`
- `getWorkKnowlageApi`
- `getWorkKnowlageRuntimeStatus`

It should not contain mock mutations, search tokenization, tree traversal, backlink rebuilding, upload URL construction, or document hydration logic.

**Step 3: Keep mock-only behavior in `workKnowlageApi.mock.ts`**

Browser fallback should import helpers:

```ts
import {
  collectTreePackageIds,
  getDescendantFolderIds,
  ...
} from './workKnowlageTree';
```

Search behavior should import from:

```ts
import {
  buildSearchPreview,
  extractSearchableText,
  includesAllTokens,
  scoreSearchResult,
  tokenizeSearchQuery,
} from './workKnowlageSearchUtils';
```

**Step 4: Re-run focused tests**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts src/app/P1BoundaryContracts.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/lib/workKnowlageApi.ts src/shared/lib/workKnowlageApi.mock.ts src/shared/lib/workKnowlageTree.ts src/shared/lib/workKnowlageSearchUtils.ts src/shared/lib/workKnowlageApi.test.ts src/app/P1BoundaryContracts.test.ts
git commit -m "refactor: keep workKnowlage api entry thin"
```

## Task 4: Remove or Isolate P1-1 Scope Bleed

**Files:**
- Modify: `docs/plans/2026-05-06-p1-1-boundary-hardening-plan.md`
- Create if needed: `docs/plans/2026-05-06-p1-3-sidebar-associations-followup.md`
- Read: `src/features/shell/RightSidebar.tsx`
- Read: `src/shared/lib/sidebarAssociations.ts`
- Read: `src/features/shell/MoveToSpaceModal.tsx`
- Read: `src/shared/editor/RichTable.tsx`

**Step 1: Inventory non-P1-1 changes**

Run:

```bash
git diff --name-only
```

Classify touched files into:

- P1-1 boundary work
- P1-3 association work
- cross-space move feature work
- rich-table/editor work
- test/support/doc work

**Step 2: Decide keep vs defer**

Keep only if it is required for P1-1 boundary tests to pass.

Document deferred work in a follow-up plan instead of continuing inside P1-1:

```markdown
# P1-3 Sidebar Associations Follow-Up

Goal: Move `deriveSidebarAssociations` out of `RightSidebar` rendering and behind a data-layer adapter/cache.
```

**Step 3: Avoid reverting user work**

If non-P1-1 changes are already validated and the user wants to keep them, do not revert. Instead, mark them as separate workstreams in docs and keep P1-1 acceptance focused on boundary health.

**Step 4: Commit documentation**

```bash
git add docs/plans/2026-05-06-p1-1-boundary-hardening-plan.md docs/plans/2026-05-06-p1-3-sidebar-associations-followup.md
git commit -m "docs: separate P1 boundary followups"
```

## Task 5: Add Final P1-1 Verification Report

**Files:**
- Create: `docs/plans/2026-05-06-p1-1-verification.md`
- Read: `.context/roadmap.md`

**Step 1: Run final verification commands**

Run:

```bash
npm run typecheck
npm test
git diff --check
```

Expected:

- `npm run typecheck`: PASS
- `npm test`: PASS
- `git diff --check`: no output

**Step 2: Write verification report**

Create `docs/plans/2026-05-06-p1-1-verification.md`:

```markdown
# P1-1 Verification

## Result
PASS / FLAG / BLOCK

## Roadmap Criteria
- AppShell props reduced to typed store/context interface: PASS/FLAG
- workKnowlageApi split into API entry + mock/tree/search modules: PASS/FLAG
- collectTreePackageIds single implementation: PASS/FLAG
- UI calls interface rather than implementation details: PASS/FLAG
- mock/Electron switching remains transparent to UI: PASS/FLAG

## Verification
- npm run typecheck: result
- npm test: result
- git diff --check: result

## Deferred Work
- P1-2: SharedBlockNoteSurface split
- P1-3: sidebar association data-layer decoupling
```

**Step 3: Commit**

```bash
git add docs/plans/2026-05-06-p1-1-verification.md
git commit -m "docs: verify P1-1 boundary hardening"
```

## Task 6: Final Review Before Calling P1-1 Done

**Files:**
- Review: all changed files in current branch

**Step 1: Review diff**

Run:

```bash
git diff --stat
git diff -- src/app src/features/shell src/shared/lib src/shared/types
```

Expected: P1-1 files are understandable and unrelated changes are documented or split.

**Step 2: Run final commands**

Run:

```bash
npm run typecheck
npm test
git diff --check
```

Expected: PASS.

**Step 3: Acceptance decision**

Call P1-1 done only if:

- All P1-1 satisfaction criteria pass.
- `docs/plans/2026-05-06-p1-1-verification.md` says PASS.
- P1-2 and P1-3 items are documented as follow-ups instead of hidden in this phase.

**Step 4: Commit final cleanup if needed**

```bash
git add docs/plans src/app src/features/shell src/shared/lib src/shared/types
git commit -m "chore: finalize P1-1 boundary hardening"
```

## Recommended Iteration Order

1. Contract tests first.
2. AppShell/context cleanup.
3. API entry cleanup.
4. Scope bleed documentation or split.
5. Verification report.
6. Final review.

## Stop Conditions

- Stop if contract tests reveal a boundary conflict that requires changing product behavior.
- Stop if non-P1-1 work cannot be cleanly documented or split without reverting user work.
- Stop if full test suite fails after focused tests pass.
