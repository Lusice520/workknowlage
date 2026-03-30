# Editor Typography And Sidebar Root Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update editor body typography, hide sidebar tree actions until interaction, add delete affordances, and support real root-level documents across fallback and Electron persistence layers.

**Architecture:** Keep typography changes centralized in shared BlockNote CSS, make sidebar interaction changes inside `LeftSidebar`, and extend the document model from folder-only to nullable root placement across types, selectors, fallback API, preload, Electron IPC, and SQLite repositories. Validate each behavior with failing tests before production changes.

**Tech Stack:** React, TypeScript, Vitest, Tailwind utility classes, BlockNote CSS, Electron IPC, better-sqlite3.

---

### Task 1: Lock The Editor Typography Contract

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurfaceStyles.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.css`

**Step 1: Write the failing test**

- Assert the CSS contains `--kb-body-font-size: 14px;`
- Assert heading blocks use a more relaxed line-height than `1.1`
- Assert heading gap is larger than the current 20px token
- Assert bullet marker styling no longer uses `font-weight: 700`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceStyles.test.ts`

Expected: FAIL on the old body font size, heading line-height/gap, and bold bullet marker assertion.

**Step 3: Write minimal implementation**

- Update the shared CSS tokens and selectors only inside `SharedBlockNoteSurface.css`
- Do not touch `CenterPane` header title styles

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceStyles.test.ts`

Expected: PASS

### Task 2: Add Root-Level Document Coverage To Shared State Loading

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workspaceSelectors.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workspaceSelectors.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/preload.ts`

**Step 1: Write the failing test**

- Add a selector test where `api.documents.list(null)` returns a root-level document
- Assert `loadWorkspaceState()` includes both root and folder documents
- Assert the root document can become the active document

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workspaceSelectors.test.ts`

Expected: FAIL because document list/create/move signatures only accept folder ids.

**Step 3: Write minimal implementation**

- Change `DocumentRecord.folderId` to `string | null`
- Change preload API signatures for document list/create/move to accept nullable folder ids
- Load root documents in `loadSpaceSnapshot`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workspaceSelectors.test.ts`

Expected: PASS

### Task 3: Extend Fallback API For Root Documents

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/mocks/workspace.ts`

**Step 1: Write the failing test**

- Add a fallback API test for creating a root-level document with `folderId: null`
- Add a fallback API test for moving a document to `null`
- Add a fallback search assertion that root-level documents can still be found

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

Expected: FAIL because fallback document APIs reject or cannot represent `null` folder ids.

**Step 3: Write minimal implementation**

- Update validation and move logic to allow `null`
- Update fallback listing and search payload shaping for root documents

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

Expected: PASS

### Task 4: Make Sidebar Root And Action Behavior Test-Driven

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`

**Step 1: Write the failing tests**

- Replace the “root create document disabled” expectation with root create enabled behavior
- Add a test that a root-level document is rendered in the root section
- Add a test that dropping a document on the root container calls `onMoveDocument(documentId, null)`
- Add tests that delete buttons exist for documents and folders
- Add tests that action containers carry hover/focus reveal classes
- Add an app-level test for breadcrumb fallback showing `根目录` when the active document has `folderId: null`

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL on root-document, delete, and hover-reveal expectations.

**Step 3: Write minimal implementation**

- Render root-level documents in the root section
- Always enable root create document
- Support root drag/drop for documents and folders
- Add hover/focus action reveal classes
- Add delete buttons with confirmation
- Make app handlers and breadcrumb fallback work with `folderId: null`

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS

### Task 5: Extend Electron SQLite Persistence For Root Documents

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/schema.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/index.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/documents.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/search.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/preload.cjs`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/scripts/electronRootDocumentSmoke.cjs`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/db/repositories/rootDocument.smoke.test.ts`

**Step 1: Write the failing smoke test**

- Create a document at root with `folderId: null`
- Move a seeded document back to root
- Reopen the DB and assert both operations persist
- Assert search results for the root document do not require a `folderId`

**Step 2: Run test to verify it fails**

Run: `npm test -- electron/db/repositories/rootDocument.smoke.test.ts`

Expected: FAIL because the SQLite schema and document repository still require `folder_id`.

**Step 3: Write minimal implementation**

- Relax the schema contract for `documents.folder_id`
- Add a startup migration in `db/index.cjs` for existing databases
- Update repository list/create/move logic to accept `null`
- Preserve search indexing for root-level documents
- Update IPC/preload document signatures to pass nullable folder ids through unchanged

**Step 4: Run test to verify it passes**

Run: `npm test -- electron/db/repositories/rootDocument.smoke.test.ts`

Expected: PASS

### Task 6: Final Verification

**Files:**
- Verify only

**Step 1: Run focused tests**

Run: `npm test -- src/shared/editor/SharedBlockNoteSurfaceStyles.test.ts`

Run: `npm test -- src/shared/lib/workspaceSelectors.test.ts`

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

Run: `npm test -- src/app/App.test.tsx`

Run: `npm test -- electron/db/repositories/rootDocument.smoke.test.ts`

**Step 2: Run build**

Run: `npm run build`

Expected: all targeted tests pass and build succeeds.
