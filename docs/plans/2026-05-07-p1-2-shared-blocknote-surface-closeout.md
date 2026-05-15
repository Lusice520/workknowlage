# P1-2 SharedBlockNoteSurface Closeout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close P1-2 by turning `SharedBlockNoteSurface` into a composition layer and moving its remaining mixed responsibilities into focused hooks/components with test coverage.

**Architecture:** Keep `SharedBlockNoteSurface` as the renderer that wires together editor controllers and typed hooks. Extract search state/effects, upload and preview behavior, and keyboard/cursor behavior into dedicated modules so each concern can be tested independently and the editor shell stops being the system's junk drawer.

**Tech Stack:** React 18, TypeScript, Tiptap/ProseMirror, Vitest, Electron/browser mock editor flows

---

## Closeout Criteria

- `src/shared/editor/SharedBlockNoteSurface.tsx` becomes a composition shell instead of a 1500+ line behavior bucket.
- Search behavior lives behind a dedicated hook/component boundary.
- Upload, drag/drop, clipboard upload, and image preview state live behind dedicated hook boundaries.
- Alert/list/table keyboard behavior and cursor-visibility behavior are separated from the render tree.
- New or updated tests cover the extracted boundaries without relying only on manual inspection.
- Verification is green: `npm run typecheck`, focused editor tests, full `npm test`, and `npm run build`.

## Task 1: Add a P1-2 structure contract

**Files:**
- Create: `src/shared/editor/SharedBlockNoteSurfaceContract.test.ts`
- Read: `src/shared/editor/SharedBlockNoteSurface.tsx`

Add a source-level contract test that protects the intended end state:

- `SharedBlockNoteSurface.tsx` stays under a small composition-shell threshold.
- The file no longer owns inline search-panel markup.
- The file imports extracted hooks/components for search and upload/preview behavior.

## Task 2: Extract search state and panel UI

**Files:**
- Create: `src/shared/editor/useSharedBlockNoteSearch.ts`
- Create: `src/shared/editor/SharedBlockNoteSearchPanel.tsx`
- Modify: `src/shared/editor/SharedBlockNoteSurface.tsx`
- Verify: `src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`

Move:

- search state
- transient search timing
- search plugin registration
- search result navigation
- search input focus behavior

Keep the panel UI in its own render component and expose only a small view model/actions surface back to `SharedBlockNoteSurface`.

## Task 3: Extract upload and image-preview behavior

**Files:**
- Create: `src/shared/editor/useSharedBlockNoteUploads.ts`
- Create: `src/shared/editor/useSharedBlockNoteImagePreview.ts`
- Modify: `src/shared/editor/SharedBlockNoteSurface.tsx`
- Verify: `src/shared/editor/SharedBlockNoteSurfaceClipboardScroll.test.tsx`
- Verify: `src/features/shell/QuickNoteCenterPaneUpload.test.tsx`

Move:

- file extraction from clipboard/dataTransfer
- upload orchestration
- pasted/dropped attachment insertion
- image preview event subscription
- preview zoom/reset keyboard handling

## Task 4: Extract keyboard and cursor behaviors

**Files:**
- Create: `src/shared/editor/useSharedBlockNoteKeyboardGuards.ts`
- Create: `src/shared/editor/useSharedBlockNoteCursorVisibility.ts`
- Modify: `src/shared/editor/SharedBlockNoteSurface.tsx`
- Verify: `src/shared/editor/SharedBlockNoteSurface.test.ts`
- Verify: `src/features/editor-host/EditorHost.test.tsx`

Move:

- alert/list/table keydown behavior
- alert header normalization
- rich table adjacent key guards
- trailing paragraph insertion focus behavior
- dynamic bottom-space cursor visibility management
- clipboard scroll guard arming

## Task 5: Final verification and P1-2 closeout notes

**Files:**
- Create: `docs/plans/2026-05-07-p1-2-verification.md`
- Create: `docs/releases/0.2.1.md` if the closeout materially changes shipped behavior

Run:

- `npm run typecheck`
- `npm test -- src/shared/editor/SharedBlockNoteSurfaceContract.test.ts src/shared/editor/SharedBlockNoteSurface.test.ts src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx src/shared/editor/SharedBlockNoteSurfaceClipboardScroll.test.tsx src/features/editor-host/EditorHost.test.tsx src/features/shell/QuickNoteCenterPaneUpload.test.tsx`
- `npm test`
- `npm run build`

Because the worktree is already dirty, verify and document completion without assuming a clean commit boundary.
