# Quick Note Image Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add image and attachment upload support to daily quick notes while keeping cleanup safe and preserving uploaded media after capture into a formal document.

**Architecture:** Reuse the existing upload storage and `kbAttachment` block pipeline, but introduce a quick-note upload API that stores assets under the persisted quick note id. Extend orphan cleanup to scan both document and quick-note content JSON so quick-note uploads are treated as live references.

**Tech Stack:** React, TypeScript, Electron IPC, SQLite-backed quick notes, Vitest

---

### Task 1: Add failing quick-note upload surface tests first

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/QuickNoteCenterPane.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/QuickNoteCenterPane.tsx`

**Step 1: Write the failing test**

Add a focused test that verifies the quick note center pane passes an upload callback into `SharedBlockNoteSurface`.

Prefer a source-level or prop-level assertion if mounting the full upload flow is too heavy.

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/QuickNoteCenterPane.test.tsx
```

Expected: FAIL because the quick-note editor currently does not wire `uploadFiles`.

**Step 3: Write minimal implementation**

Thread the new upload prop into the quick note pane only.

**Step 4: Run test to verify it passes**

Run the same command and confirm green.

### Task 2: Add quick-note upload API plumbing

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/preload.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/preload.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/quickNotes.cjs`

**Step 1: Write the failing test**

Add a desktop/fallback API regression test covering:

- quick note upload entry exists
- upload resolves using a stable quick note id

If a pure fallback API test is easier, add it there first.

**Step 2: Run test to verify it fails**

Run the focused API test file.

**Step 3: Write minimal implementation**

Implement:

- quick note upload method in preload/types
- IPC handler in Electron
- logic that ensures a quick note exists before storing assets
- fallback/browser mock support in `workKnowlageApi.ts`

**Step 4: Run test to verify it passes**

Re-run the focused API tests.

### Task 3: Hook quick-note uploads into the editor flow

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/QuickNoteCenterPane.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceContentActions.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/workspaceSessionActionTypes.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useWorkspaceSession.ts`

**Step 1: Write the failing test**

Add a focused app/session test that verifies quick notes expose an upload-capable editor path.

Keep the test narrow; it does not need full drag-and-drop simulation if the prop plumbing is covered elsewhere.

**Step 2: Run test to verify it fails**

Run the focused quick-note/app tests.

**Step 3: Write minimal implementation**

Implement a dedicated `uploadQuickNoteFiles(noteDate, files)` action and wire it into `QuickNoteCenterPane`.

**Step 4: Run test to verify it passes**

Re-run the focused tests.

### Task 4: Protect quick-note uploads from orphan cleanup

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/maintenance/dataTools.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/electronPersistenceSmoke.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/scripts/electronPersistenceSmoke.cjs`

**Step 1: Write the failing test**

Extend the Electron smoke flow to:

- upload an asset into a quick note
- run orphan attachment cleanup
- confirm the referenced quick-note upload still exists

**Step 2: Run test to verify it fails**

Run the focused Electron smoke test.

**Step 3: Write minimal implementation**

Extend cleanup reference scanning to include `quick_notes.content_json`.

**Step 4: Run test to verify it passes**

Re-run the focused Electron smoke test.

### Task 5: Verify capture preserves quick-note attachment URLs

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.test.tsx`

**Step 1: Write the failing test**

Add coverage that a quick note containing a `kbAttachment` block can still be captured into a formal document without losing its attachment URL.

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx
```

Expected: FAIL until the upload path is fully integrated.

**Step 3: Write minimal implementation**

Only if needed after the earlier tasks. Avoid adding migration logic; preserving the existing URL is enough for this phase.

**Step 4: Run test to verify it passes**

Re-run the focused app test file.

### Task 6: Run focused and full verification

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/QuickNoteCenterPane.test.tsx
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/electronPersistenceSmoke.test.ts
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build
```

Expected:

- quick-note tests green
- Electron smoke remains green
- full suite, typecheck, and build remain green
