# RichTable Architecture Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor RichTable so overlay controls, command execution, and editor rendering are driven by explicit modules instead of one large component with repeated geometry and state logic.

**Architecture:** Keep the existing TipTap/ProseMirror table document model, paste logic, and width utilities. Split the current RichTable monolith into three clear layers: a command layer for table actions, an overlay model layer for geometry and visibility state, and a presentational overlay component that renders toolbar, grips, and edge controls from that model.

**Tech Stack:** React, TipTap table extension, ProseMirror tables, BlockNote custom block renderer, Vitest, CSS

---

## Guardrails

- Do not rewrite the persisted RichTable `data` schema.
- Do not replace TipTap table nodes with a custom grid engine.
- Do not add new user-facing features during this refactor.
- Prefer moving existing logic into smaller modules before changing behavior.
- Every task must preserve the existing equal-width, paste, merge/split, row/column action, and floating portal capabilities unless a failing test proves the current behavior is wrong.

## Accepted CEO Expansions

- Define a user-visible RichTable contract before moving implementation seams.
- Make portal host strategy an explicit architectural decision instead of an inherited assumption.
- Add an Electron-level regression smoke path for the exact overlay bugs that have been recurring.

## Target Shape

```text
RichTable.tsx
  -> useRichTableEditorSync()
  -> useRichTableCommands()
  -> useRichTableOverlayModel()
  -> <RichTableOverlay />
  -> <EditorContent />

Existing helpers kept:
  richTablePasteUtils.ts
  richTableLayout.ts
  richTableColumnWidths.ts
  richTableToolbarPortal.ts
  richTableUiState.ts
```

## User Contract

RichTable is considered healthy only if a user can rely on all of the following:

- selecting a cell makes the correct toolbar and grips appear without visual jumping
- scrolling the page does not change what the toolbar means or where add-row/add-col controls belong semantically
- scrolling inside the editor does not leave floating controls stranded outside the editor surface
- row and column actions always target the row or column the user thinks they are targeting
- equal-width actions never silently eat the last column width
- merge and split actions either work or fail with a clear reason
- pasted tables either map cleanly into the current table or reject merged-cell input clearly
- rounded corners, lane width, and floating controls can all coexist without one fix breaking another

## Behavior Contract

```text
USER CONTRACT
focus/selection changes
  -> correct toolbar/grips appear
  -> no semantic jump in controls

page/editor scroll
  -> controls stay attached to table intent
  -> controls do not leak outside the visible editor

row/col commands
  -> command targets remain stable
  -> geometry recomputes from one overlay snapshot

INTERNAL CONTRACT
  -> overlay model owns one geometry snapshot
  -> command layer owns transactions and failure hints
  -> overlay render consumes state, not ad hoc DOM math
```

### Task 0: Define the RichTable contract and browser regression matrix

**Files:**
- Create: `docs/plans/2026-04-05-rich-table-browser-regression-matrix.md`
- Create: `src/shared/editor/RichTableBehavior.test.tsx`
- Modify: `src/shared/editor/RichTablePortalSource.test.ts`

**Step 1: Write the failing test**

Add a user-facing contract spec that requires:
- the core RichTable interactions above to be encoded as behavior assertions or explicit regression scenarios
- the browser regression matrix to list the minimum scenarios that must stay green during refactor:
  - page scroll with active table
  - editor scroll with active table
  - toolbar visibility and anchor semantics
  - add-row and add-col affordances
  - rounded corners
  - equal-width action
  - merged-cell guardrail

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTablePortalSource.test.ts`
Expected: FAIL because the contract test and regression matrix do not exist yet

**Step 3: Write minimal implementation**

Create the browser regression matrix doc and add the first behavior-level spec file.
Keep this task documentation- and test-first only. Do not restructure production code yet.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTablePortalSource.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-04-05-rich-table-browser-regression-matrix.md src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTablePortalSource.test.ts
git commit -m "test: define rich table user contract"
```

### Task 1: Lock the RichTable behavior contract before moving code

**Files:**
- Create: `src/shared/editor/richTableOverlayHost.ts`
- Create: `src/shared/editor/richTableOverlayHost.test.ts`
- Create: `src/shared/editor/RichTableBehavior.test.tsx`
- Modify: `src/shared/editor/RichTablePortalSource.test.ts`
- Modify: `src/shared/editor/RichTableEdgeHandleSource.test.ts`

**Step 1: Write the failing test**

Add behavior-level tests that require:
- RichTable to expose one overlay render entry point rather than rendering all portal UI inline
- toolbar position to come from one overlay model output
- add-column visibility to be derived from one computed state object, not ad hoc booleans scattered through render
- portal host selection to pass through one explicit adapter instead of directly assuming `document.body`
- row and column affordances to remain anchored after a geometry recompute call

Use source-level and light rendering assertions only. Do not try to finish the full refactor in the test.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTablePortalSource.test.ts src/shared/editor/RichTableEdgeHandleSource.test.ts`
Expected: FAIL because RichTable still inlines overlay render, assumes `document.body` directly, and does not yet expose a single overlay model boundary

**Step 3: Write minimal implementation**

Make only the smallest structural changes needed so the current component exposes real extraction seams:
- add an explicit overlay-host adapter module
- add explicit `overlayModel` and `commandApi` boundaries
- keep existing body portal behavior for now unless the new tests prove the host must move
- update source tests to assert those seams exist

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/richTableOverlayHost.test.ts src/shared/editor/RichTablePortalSource.test.ts src/shared/editor/RichTableEdgeHandleSource.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/editor/richTableOverlayHost.ts src/shared/editor/richTableOverlayHost.test.ts src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTablePortalSource.test.ts src/shared/editor/RichTableEdgeHandleSource.test.ts src/shared/editor/RichTable.tsx
git commit -m "refactor: expose rich table overlay seams"
```

### Task 2: Extract the RichTable command layer

**Files:**
- Create: `src/shared/editor/useRichTableCommands.ts`
- Create: `src/shared/editor/useRichTableCommands.test.ts`
- Modify: `src/shared/editor/RichTable.tsx`
- Test: `src/shared/editor/richTableColumnWidths.test.ts`

**Step 1: Write the failing test**

Add tests that require a command hook to expose:
- `runEdgeAppendAction`
- `equalizeTableColumnWidths`
- row and column selection helpers
- merge/split and formatting action wrappers returning success/failure

Include one test proving merged-cell equal-width requests are rejected without mutating the doc.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/useRichTableCommands.test.ts src/shared/editor/richTableColumnWidths.test.ts`
Expected: FAIL because the command hook file does not exist yet

**Step 3: Write minimal implementation**

Move command-centric logic out of `RichTable.tsx` into `useRichTableCommands.ts`:
- table context lookup
- edge append actions
- equal-width transaction dispatch
- selection collapse/select-axis helpers
- menu-closing and hint-setting callbacks as injected dependencies

Keep DOM measurement out of this hook.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/useRichTableCommands.test.ts src/shared/editor/richTableColumnWidths.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/editor/useRichTableCommands.ts src/shared/editor/useRichTableCommands.test.ts src/shared/editor/RichTable.tsx src/shared/editor/richTableColumnWidths.test.ts
git commit -m "refactor: extract rich table command layer"
```

### Task 3: Extract the overlay model into one geometry and visibility hook

**Files:**
- Create: `src/shared/editor/useRichTableOverlayModel.ts`
- Create: `src/shared/editor/useRichTableOverlayModel.test.ts`
- Modify: `src/shared/editor/RichTable.tsx`
- Modify: `src/shared/editor/richTableToolbarPortal.ts`
- Modify: `src/shared/editor/richTableUiState.ts`
- Modify: `src/shared/editor/richTableToolbarPortal.test.ts`
- Modify: `src/shared/editor/richTableUiState.test.ts`

**Step 1: Write the failing test**

Add tests that require a single hook to return:
- `tableViewportFrame`
- `editorClip`
- `toolbarViewportPosition`
- `rowGripPos`
- `colGripPos`
- `clampedRowEdge`
- `clampedColEdgeHandlePosition`
- visibility booleans for toolbar, grips, row-edge handle, and col-edge handle

Also require the hook to accept a single dependency bundle for:
- editor focus/activity state
- hover state
- open menu state
- container refs

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/useRichTableOverlayModel.test.ts src/shared/editor/richTableToolbarPortal.test.ts src/shared/editor/richTableUiState.test.ts`
Expected: FAIL because the overlay hook does not exist yet and visibility logic is still split across RichTable render/effects/helpers

**Step 3: Write minimal implementation**

Move the following into `useRichTableOverlayModel.ts`:
- `updateTableGripPositions`
- scroll/resize/ResizeObserver wiring
- clip-rect intersection usage
- row/col handle clamp decisions
- toolbar/grip/add-row/add-col visibility derivation

Keep the returned shape plain and explicit. The hook should compute state; it should not render JSX or dispatch commands.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/useRichTableOverlayModel.test.ts src/shared/editor/richTableToolbarPortal.test.ts src/shared/editor/richTableUiState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/editor/useRichTableOverlayModel.ts src/shared/editor/useRichTableOverlayModel.test.ts src/shared/editor/RichTable.tsx src/shared/editor/richTableToolbarPortal.ts src/shared/editor/richTableToolbarPortal.test.ts src/shared/editor/richTableUiState.ts src/shared/editor/richTableUiState.test.ts
git commit -m "refactor: centralize rich table overlay model"
```

### Task 4: Move portal JSX into a pure overlay component

**Files:**
- Create: `src/shared/editor/RichTableOverlay.tsx`
- Create: `src/shared/editor/RichTableOverlay.test.tsx`
- Modify: `src/shared/editor/RichTable.tsx`
- Modify: `src/shared/editor/RichTable.css`
- Modify: `src/shared/editor/RichTablePortalSource.test.ts`

**Step 1: Write the failing test**

Add tests that require:
- `RichTableOverlay.tsx` to own the portal JSX for toolbar and floating controls
- `RichTable.tsx` to pass model state and command callbacks into the overlay component
- overlay rendering to remain in `document.body` portals

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTablePortalSource.test.ts`
Expected: FAIL because the overlay component does not exist yet

**Step 3: Write minimal implementation**

Move all portal render JSX out of `RichTable.tsx` into `RichTableOverlay.tsx`:
- top toolbar portal
- add-row and add-col handles
- row and col grips
- row and col menus

`RichTable.tsx` should only:
- create the editor
- wire state and callbacks
- render `<RichTableOverlay ... />`
- render `<EditorContent />`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTablePortalSource.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/editor/RichTableOverlay.tsx src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTable.tsx src/shared/editor/RichTable.css src/shared/editor/RichTablePortalSource.test.ts
git commit -m "refactor: extract rich table overlay component"
```

### Task 5: Add regression tests for the bug class we keep hitting

**Files:**
- Modify: `src/shared/editor/RichTableBehavior.test.tsx`
- Modify: `src/shared/editor/RichTableOverlay.test.tsx`
- Modify: `src/shared/editor/RichTableStyles.test.ts`
- Modify: `src/shared/editor/richTableLayout.test.ts`
- Modify: `src/shared/editor/richTableColumnWidths.test.ts`
- Create: `scripts/electronRichTableOverlaySmoke.cjs`
- Create: `src/test/electronRichTableOverlaySmoke.test.ts`

**Step 1: Write the failing test**

Add regression coverage for:
- rounded corners remain intact while overlay portals are active
- right action lane reservation does not collapse the final column width
- toolbar anchor semantics stay stable after repeated recomputation
- add-row and add-col affordances do not regress each other
- equal-width action still respects merged-cell guardrails
- the Electron/browser smoke path can exercise the recurring overlay scenarios from the browser regression matrix

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTableStyles.test.ts src/shared/editor/richTableLayout.test.ts src/shared/editor/richTableColumnWidths.test.ts src/test/electronRichTableOverlaySmoke.test.ts`
Expected: FAIL because at least one regression scenario is not yet encoded

**Step 3: Write minimal implementation**

Patch only the behavior gaps exposed by the new tests. Add the Electron smoke script only for scenarios already listed in the browser regression matrix. Avoid broad cleanup in this step.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTableStyles.test.ts src/shared/editor/richTableLayout.test.ts src/shared/editor/richTableColumnWidths.test.ts src/test/electronRichTableOverlaySmoke.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/electronRichTableOverlaySmoke.cjs src/test/electronRichTableOverlaySmoke.test.ts src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTableStyles.test.ts src/shared/editor/richTableLayout.test.ts src/shared/editor/richTableColumnWidths.test.ts src/shared/editor/RichTable.tsx src/shared/editor/RichTable.css
git commit -m "test: cover rich table overlay regressions"
```

### Task 6: Final verification and cleanup

**Files:**
- Modify: `docs/plans/2026-04-05-rich-table-architecture-reset.md`
- Test: `src/shared/editor/RichTableBehavior.test.tsx`
- Test: `src/shared/editor/RichTableOverlay.test.tsx`
- Test: `src/shared/editor/RichTablePortalSource.test.ts`
- Test: `src/shared/editor/RichTableEdgeHandleSource.test.ts`
- Test: `src/shared/editor/RichTableStyles.test.ts`
- Test: `src/shared/editor/richTableToolbarPortal.test.ts`
- Test: `src/shared/editor/richTableLayout.test.ts`
- Test: `src/shared/editor/richTableUiState.test.ts`
- Test: `src/shared/editor/richTableColumnWidths.test.ts`
- Test: `src/shared/editor/richTableKeyboard.test.ts`
- Test: `src/test/electronRichTableOverlaySmoke.test.ts`

**Step 1: Run focused RichTable verification**

Run: `npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTablePortalSource.test.ts src/shared/editor/RichTableEdgeHandleSource.test.ts src/shared/editor/RichTableStyles.test.ts src/shared/editor/richTableToolbarPortal.test.ts src/shared/editor/richTableLayout.test.ts src/shared/editor/richTableUiState.test.ts src/shared/editor/richTableColumnWidths.test.ts src/shared/editor/richTableKeyboard.test.ts src/test/electronRichTableOverlaySmoke.test.ts`
Expected: PASS

**Step 2: Run type safety checks**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Smoke-check the editor manually**

Verify in the running app:
- toolbar position
- row and column grips
- add-row and add-col affordances
- equal-width action
- merged-cell guardrail
- page scroll and editor scroll interactions
- portal host choice is still correct for the editor surface you actually ship

**Step 4: Commit**

```bash
git add docs/plans/2026-04-05-rich-table-architecture-reset.md docs/plans/2026-04-05-rich-table-browser-regression-matrix.md scripts/electronRichTableOverlaySmoke.cjs src/test/electronRichTableOverlaySmoke.test.ts src/shared/editor/RichTable.tsx src/shared/editor/RichTable.css src/shared/editor/RichTableOverlay.tsx src/shared/editor/RichTableOverlay.test.tsx src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/useRichTableCommands.ts src/shared/editor/useRichTableCommands.test.ts src/shared/editor/useRichTableOverlayModel.ts src/shared/editor/useRichTableOverlayModel.test.ts src/shared/editor/richTableOverlayHost.ts src/shared/editor/richTableOverlayHost.test.ts src/shared/editor/RichTablePortalSource.test.ts src/shared/editor/RichTableEdgeHandleSource.test.ts src/shared/editor/RichTableStyles.test.ts src/shared/editor/richTableToolbarPortal.ts src/shared/editor/richTableToolbarPortal.test.ts src/shared/editor/richTableLayout.test.ts src/shared/editor/richTableUiState.ts src/shared/editor/richTableUiState.test.ts src/shared/editor/richTableColumnWidths.test.ts src/shared/editor/richTableKeyboard.test.ts
git commit -m "refactor: stabilize rich table architecture"
```

## Definition of Done

- `RichTable.tsx` is mainly orchestration, not the place where geometry and command logic live.
- One overlay model owns visibility and position outputs.
- One command layer owns table transactions and interaction actions.
- Portal host choice is explicit and test-backed rather than inherited.
- Portal rendering is isolated in a pure overlay component.
- RichTable regression tests cover the actual bug class we have been fighting, including an Electron/browser smoke layer.
- No new user-facing features were bundled into the refactor.
