# Phase Four Document Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add formal document export for Markdown, PDF, and Word with a polished DOCX layout, reusing the proven WorkPlan export pipeline where it fits WorkKnowlage.

**Architecture:** Reuse WorkPlan’s renderer-side BlockNote export serializers for Markdown, printable HTML, and DOCX conversion, then connect them to Electron-native save and PDF generation IPC. Keep export scoped to the active formal document in the center pane and always export the latest saved editor snapshot.

**Tech Stack:** React, Electron IPC, hidden BrowserWindow `printToPDF`, BlockNote JSON, `docx`, `prosemirror-docx`, Vitest

---

### Task 1: Add Export API Surface

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/preload.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.ts`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/workKnowlageApi.test.ts`

**Step 1: Write the failing test**

Add tests in `src/shared/lib/workKnowlageApi.test.ts` that expect:

- `window.workKnowlage.exports.saveText(...)`
- `window.workKnowlage.exports.saveBinary(...)`
- `window.workKnowlage.exports.savePdfFromHtml(...)`

and fallback implementations to exist.

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts`

Expected: FAIL because export bridge methods do not exist yet.

**Step 3: Write minimal implementation**

- Add export result and bridge method types to `src/shared/types/preload.ts`
- Expose no-op / browser-mock fallback implementations in `src/shared/lib/workKnowlageApi.ts`

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types/preload.ts src/shared/lib/workKnowlageApi.ts src/shared/lib/workKnowlageApi.test.ts
git commit -m "feat: add export bridge api surface"
```

### Task 2: Add Electron Export Save + PDF IPC

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/export/files.cjs`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/export/pdf.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/preload.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/main.cjs`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/electronExportSmoke.test.ts`

**Step 1: Write the failing test**

Create `src/test/electronExportSmoke.test.ts` that expects:

- saving text export returns a file path
- saving binary export returns a file path
- PDF export writes a non-empty `.pdf`

Use temp files under `/tmp` or test temp dir.

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/electronExportSmoke.test.ts`

Expected: FAIL because Electron export handlers do not exist.

**Step 3: Write minimal implementation**

- `files.cjs`
  - save dialog helper
  - write text and binary files
- `pdf.cjs`
  - create hidden `BrowserWindow`
  - load export HTML
  - call `printToPDF`
- wire IPC in `electron/main.cjs`
- expose bridge methods in `electron/preload.cjs`

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/electronExportSmoke.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add electron/export/files.cjs electron/export/pdf.cjs electron/preload.cjs electron/main.cjs src/test/electronExportSmoke.test.ts
git commit -m "feat: add electron export save and pdf handlers"
```

### Task 3: Port Markdown + Printable HTML Export Utilities

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.test.ts`

**Step 1: Write the failing test**

Create tests that verify:

- headings become Markdown headings
- rich tables become Markdown tables
- image / attachment blocks render printable HTML image figures or links
- alert blocks render printable HTML alert sections

Reuse WorkPlan contract coverage patterns.

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/exportUtils.test.ts`

Expected: FAIL because export utilities do not exist.

**Step 3: Write minimal implementation**

- Port and adapt WorkPlan `exportUtils.js`
- Keep only document export behavior needed for WorkKnowlage block schema
- Export:
  - `sanitizeFileName`
  - `parseBlocks`
  - `toMarkdownFromBlocks`
  - `toPrintHtmlFromBlocks`
  - any needed helpers

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/exportUtils.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/export/exportUtils.ts src/features/export/exportUtils.test.ts
git commit -m "feat: add markdown and printable html export utils"
```

### Task 4: Port Styled Word Export

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/docxExportUtils.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/docxExportUtils.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/package.json`

**Step 1: Write the failing test**

Create DOCX export tests that verify:

- one default section is configured
- table cell spacing remains compact
- image attachments are represented in the PM / serializer pipeline

Mirror the WorkPlan contract tests in TypeScript / Vitest form.

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/docxExportUtils.test.ts`

Expected: FAIL because DOCX export utility and dependencies are missing.

**Step 3: Write minimal implementation**

- Add `docx` and `prosemirror-docx`
- Port and adapt WorkPlan `docxExportUtils.js`
- Keep:
  - heading styles
  - Chinese/Latin font setup
  - compact table cell spacing
  - alert block styling
  - attachment and image handling

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/docxExportUtils.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add package.json src/features/export/docxExportUtils.ts src/features/export/docxExportUtils.test.ts
git commit -m "feat: add styled word export pipeline"
```

### Task 5: Add Renderer Export Orchestration Hook

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.test.ts`

**Step 1: Write the failing test**

Create hook tests that expect:

- export saves latest document content before generating output
- markdown export sends text to `exports.saveText`
- word export sends bytes to `exports.saveBinary`
- pdf export sends printable HTML to `exports.savePdfFromHtml`

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/useDocumentExport.test.ts`

Expected: FAIL because hook does not exist.

**Step 3: Write minimal implementation**

- Lazily import heavy export utilities
- Reuse current document content snapshot
- Save the current doc first
- Route output to the export bridge
- Return busy/status state for UI feedback

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/useDocumentExport.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/useDocumentExport.ts src/app/useDocumentExport.test.ts
git commit -m "feat: orchestrate document export in app hook"
```

### Task 6: Add Export UI to Center Pane

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPaneCompact.test.tsx`

**Step 1: Write the failing test**

Extend `CenterPaneCompact.test.tsx` to expect:

- a visible `导出` action
- Markdown / PDF / Word export menu items
- clicking an item triggers the correct hook action

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/CenterPaneCompact.test.tsx`

Expected: FAIL because export UI does not exist.

**Step 3: Write minimal implementation**

- wire `useDocumentExport` into `App.tsx`
- pass export state through `AppShell`
- add export dropdown in `CenterPane.tsx`
- show success / failure status text without displacing existing share UI

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/CenterPaneCompact.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/App.tsx src/features/shell/AppShell.tsx src/features/shell/CenterPane.tsx src/features/shell/CenterPaneCompact.test.tsx
git commit -m "feat: add center pane export actions"
```

### Task 7: Run Full Verification

**Files:**
- No code changes required unless verification fails

**Step 1: Run focused tests**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/lib/workKnowlageApi.test.ts`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/electronExportSmoke.test.ts`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/exportUtils.test.ts`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/docxExportUtils.test.ts`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/useDocumentExport.test.ts`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/CenterPaneCompact.test.tsx`

Expected: PASS

**Step 2: Run full verification**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected: PASS

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add phase four formal document export"
```
