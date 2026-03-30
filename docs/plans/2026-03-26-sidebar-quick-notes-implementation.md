# Sidebar Quick Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a left-sidebar daily quick note module with a real calendar, one quick note per space per date, and compact BlockNote editing.

**Architecture:** Add a dedicated `quick_notes` SQLite table and expose it through Electron IPC/preload and browser fallback API. Keep quick note UI local to `LeftSidebar`, reusing the shared BlockNote schema and serializer for editing while avoiding document-tree coupling.

**Tech Stack:** Electron, better-sqlite3, React 18, Vite, BlockNote, Vitest

---

### Task 1: Add quick note domain types

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/preload.ts`

**Step 1: Write the failing test**

Add type-driven usage in sidebar/API tests that references `QuickNoteRecord` and `quickNotes`.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

**Step 3: Write minimal implementation**

Add `QuickNoteRecord` and `QuickNoteMonthEntry` plus the `quickNotes` preload API contract.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

### Task 2: Add SQLite quick note storage

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/schema.cjs`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/quickNotes.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/preload.cjs`

**Step 1: Write the failing test**

Add a repository/API test covering `get`, `upsert`, and `listMonth`.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

**Step 3: Write minimal implementation**

Create `quick_notes` table and IPC/preload handlers.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

### Task 3: Add browser fallback quick note API

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`

**Step 1: Write the failing test**

Add fallback API coverage for month listing and date upsert behavior.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

**Step 3: Write minimal implementation**

Store fallback quick notes in mutable in-memory state keyed by `spaceId + noteDate`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

### Task 4: Implement sidebar calendar state and quick note panel

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`

**Step 1: Write the failing test**

Add tests for:
- month switching
- selecting a date
- loading existing quick note content
- showing markers for dates with notes

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

**Step 3: Write minimal implementation**

Replace the static calendar grid with generated month data and mount a compact quick note BlockNote editor under it.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

### Task 5: Add compact quick note persistence

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`
- Reuse: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/index.ts`

**Step 1: Write the failing test**

Add a test showing that editing the quick note saves through `quickNotes.upsert` and reloads on date switch.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

**Step 3: Write minimal implementation**

Use `useCreateBlockNote`, `kbSchema`, `fromDocumentToInitialBlocks`, and `serializeEditorDocument` to power a tight sidebar editor with debounced autosave.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

### Task 6: Verify end-to-end

**Files:**
- No code changes required

**Step 1: Run the full test suite**

Run: `npm test`

**Step 2: Run type checks**

Run: `npm run typecheck`

**Step 3: Run production build**

Run: `npm run build`
