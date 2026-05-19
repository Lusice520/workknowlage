# Spreadsheet Document Type Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an independent Spreadsheet document type that users can create from the tree and edit with an online-Excel style center pane.

**Architecture:** Keep existing note documents on BlockNote and introduce a `document_kind` routing field. Store shared tree metadata in `documents`, store workbook snapshots in `document_spreadsheets`, and mount Univer Sheets only for Spreadsheet documents.

**Tech Stack:** Electron, React 18, TypeScript, SQLite/better-sqlite3, Univer Sheets, Vitest.

---

## Source of Truth

Product requirements live in `docs/requirements/specs/spreadsheet_document_spec.md`. This plan is execution-only and should not become the durable product requirement source.

## Task 1: Document Kind Data Model

**Files:**
- Modify: `electron/db/schema.cjs`
- Modify: `electron/db/index.cjs`
- Modify: `electron/db/repositories/documents.cjs`
- Modify: `src/shared/types/workspace.ts`
- Modify: `src/shared/types/preload.ts`
- Test: `electron/db/repositories/rootDocument.smoke.test.ts`

**Step 1: Write failing persistence coverage**

Add tests for:

- existing document rows default to `kind: 'note'`
- `documents.create({ kind: 'spreadsheet' })` creates a `spreadsheet` document
- spreadsheet creation also creates a `document_spreadsheets` row

Run:

```bash
npm test -- electron/db/repositories/rootDocument.smoke.test.ts
```

Expected: FAIL because `document_kind` and spreadsheet creation do not exist.

**Step 2: Add schema and migration**

Add `documents.document_kind TEXT NOT NULL DEFAULT 'note' CHECK(document_kind IN ('note','spreadsheet'))`.

Add `document_spreadsheets`:

```sql
CREATE TABLE IF NOT EXISTS document_spreadsheets (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  workbook_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Add an `index.cjs` migration that adds missing `document_kind` to existing databases as `note`.

**Step 3: Extend document repository**

Allow `createDocument({ spaceId, folderId, title, kind })`, defaulting `kind` to `note`. For `spreadsheet`, insert a default workbook snapshot.

Expose `kind` from `assembleDocument`.

**Step 4: Verify**

Run:

```bash
npm test -- electron/db/repositories/rootDocument.smoke.test.ts
npm run typecheck
```

Expected: PASS.

## Task 2: Spreadsheet Repository and IPC API

**Files:**
- Create: `electron/db/repositories/spreadsheets.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Test: `src/shared/lib/workKnowlageApi.test.ts`

**Step 1: Write failing API coverage**

Cover:

- `workKnowlage.spreadsheets.get(documentId)`
- `workKnowlage.spreadsheets.update(documentId, workbookJson)`

Run:

```bash
npm test -- src/shared/lib/workKnowlageApi.test.ts
```

Expected: FAIL because the API does not exist.

**Step 2: Implement repository and IPC**

Create repository functions:

- `getSpreadsheetWorkbook(documentId)`
- `updateSpreadsheetWorkbook(documentId, workbookJson)`

Register IPC handlers in `electron/main.cjs` and expose them through `electron/preload.cjs`.

**Step 3: Update renderer types and mock API**

Add `spreadsheets` to `WorkKnowlageDesktopApi`. Add in-memory workbook storage to the browser mock.

**Step 4: Verify**

Run:

```bash
npm test -- src/shared/lib/workKnowlageApi.test.ts
npm run typecheck
```

Expected: PASS.

## Task 3: Tree Creation and Kind-Aware UI

**Files:**
- Modify: `src/app/workspaceSessionActionTypes.ts`
- Modify: `src/app/useWorkspaceContentActions.ts`
- Modify: `src/features/shell/SidebarRootSection.tsx`
- Modify: `src/features/shell/SidebarTree.tsx`
- Modify: `src/features/shell/SidebarTreeItems.tsx`
- Modify: `src/features/shell/LeftSidebar.tsx`
- Test: `src/features/shell/LeftSidebar.test.tsx`

**Step 1: Write failing UI tests**

Assert root and nested new menus include `新建 Excel`, and clicking it creates a spreadsheet document.

Run:

```bash
npm test -- src/features/shell/LeftSidebar.test.tsx
```

Expected: FAIL because only `新建文件` and `新建文件夹` exist.

**Step 2: Generalize createDocument**

Change `createDocument(folderId)` to accept `{ kind?: 'note' | 'spreadsheet' }`.

Use:

- note title: `无标题文档`
- spreadsheet title: `无标题表格`

**Step 3: Add menu item and icon**

Add `新建 Excel` between `新建文件` and `新建文件夹`. Use a spreadsheet/table icon for spreadsheet documents in the tree.

**Step 4: Verify**

Run:

```bash
npm test -- src/features/shell/LeftSidebar.test.tsx
npm run typecheck
```

Expected: PASS.

## Task 4: Spreadsheet Center Pane

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/spreadsheet/SpreadsheetEditorHost.tsx`
- Create: `src/features/spreadsheet/useSpreadsheetPersistence.ts`
- Create: `src/features/spreadsheet/SpreadsheetEditor.css`
- Modify: `src/features/shell/CenterPane.tsx`
- Test: `src/features/shell/CenterPane.test.tsx`

**Step 1: Install Univer dependencies**

Run:

```bash
npm install @univerjs/presets @univerjs/preset-sheets-core
```

Expected: dependencies install and lockfile updates.

**Step 2: Write failing routing test**

Assert `kind: 'spreadsheet'` renders Spreadsheet host and does not render BlockNote.

Run:

```bash
npm test -- src/features/shell/CenterPane.test.tsx
```

Expected: FAIL because center pane always routes active documents to `EditorHost`.

**Step 3: Implement Spreadsheet editor host**

Create a host that:

- loads workbook JSON through `workKnowlage.spreadsheets.get`
- initializes Univer with the workbook snapshot
- debounces saves through `workKnowlage.spreadsheets.update`
- reports `saved`, `saving`, and `error` states to `CenterPane`
- avoids overwriting stored workbook data when initialization fails

**Step 4: Route center pane by kind**

If `activeDocument.kind === 'spreadsheet'`, render Spreadsheet host. Otherwise render existing `EditorHost`.

Hide or disable note-only Markdown, Word, PDF, and share controls for Spreadsheet documents.

**Step 5: Verify**

Run:

```bash
npm test -- src/features/shell/CenterPane.test.tsx
npm run typecheck
npm run build
```

Expected: PASS.

## Task 5: Search and Collection Guardrails

**Files:**
- Modify: `electron/db/repositories/search.cjs`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Modify: `src/features/shell/CollectionCenterPane.tsx`
- Test: `electron/db/repositories/search.smoke.test.ts`
- Test: `src/features/shell/CollectionCenterPane.test.tsx`

**Step 1: Write failing coverage**

Assert Spreadsheet documents appear in collection lists and title search without trying to parse workbook JSON as BlockNote body content.

Run:

```bash
npm test -- electron/db/repositories/search.smoke.test.ts src/features/shell/CollectionCenterPane.test.tsx
```

Expected: FAIL where kind is not surfaced or note-only assumptions leak.

**Step 2: Add title-first Spreadsheet search**

Index Spreadsheet document titles. Add workbook cell extraction only after Univer snapshot shape is stable.

**Step 3: Verify**

Run:

```bash
npm test -- electron/db/repositories/search.smoke.test.ts src/features/shell/CollectionCenterPane.test.tsx
npm run typecheck
```

Expected: PASS.

## Task 6: End-to-End Verification

**Files:**
- Test: `src/test/electronPersistenceSmoke.test.ts`
- Test: `src/test/vitePackagingConfig.test.ts`

**Step 1: Add smoke coverage**

Cover:

- create Spreadsheet document
- save workbook JSON
- reopen and restore workbook
- ordinary note still opens and saves through BlockNote path

**Step 2: Full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all pass.

**Step 3: Manual app check**

Run:

```bash
npm run dev
```

Verify:

- New menu shows `新建 Excel`
- Created Spreadsheet opens the spreadsheet editor
- Cell edits persist after switching away and back
- Ordinary notes still open BlockNote
