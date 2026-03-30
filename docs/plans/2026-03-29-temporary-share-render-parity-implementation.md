# Temporary Share Render Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor temporary share pages so the share content area uses the exact same block renderer and core styles as document export, while moving share reading to a content-pane scroll layout instead of whole-page scrolling.

**Architecture:** Extract a shared document HTML renderer from the export pipeline, then make both PDF export and temporary share pages consume it. Keep a thin share-only shell for header, metadata, TOC, and layout, but remove all duplicate share-side block rendering logic.

**Tech Stack:** Electron local HTTP server, shared HTML renderer utilities, BlockNote JSON, React export orchestration, Vitest

---

### Task 1: Extract Shared Document HTML Renderer Contract

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/documentHtmlRenderer.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/documentHtmlRenderer.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.ts`

**Step 1: Write the failing test**

Create `documentHtmlRenderer.test.ts` that expects a shared renderer to:

- render headings, paragraphs, quotes, lists, checklist blocks, `alert`, `codeBlock`, images, attachments, `richTable`, and `@提及`
- preserve inline bold, italic, underline, strike, code, link, color
- return heading metadata for TOC generation
- return body HTML without share-specific wrapper markup

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/documentHtmlRenderer.test.ts`

Expected: FAIL because the shared renderer module does not exist.

**Step 3: Write minimal implementation**

- Move reusable HTML body rendering helpers out of `exportUtils.ts`
- Export shared functions:
  - `renderDocumentHtmlBodyFromBlocks`
  - `extractDocumentHeadingsFromBlocks`
  - `buildDocumentHtmlShell`
  - any required asset URL helpers
- Keep `exportUtils.ts` as a thin consumer of the shared renderer instead of its own parallel implementation

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/export/documentHtmlRenderer.test.ts src/features/export/exportUtils.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/export/documentHtmlRenderer.ts src/features/export/documentHtmlRenderer.test.ts src/features/export/exportUtils.ts src/features/export/exportUtils.test.ts
git commit -m "refactor: extract shared document html renderer"
```

### Task 2: Route Export HTML Through the Shared Renderer

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.test.ts`

**Step 1: Write the failing test**

Add tests that expect PDF export HTML to come from the shared renderer path and still include:

- full `<!doctype html>`
- shared content classes for `alert`, `richTable`, `@提及`, code blocks, and lists
- title shell markup produced by the shared document shell

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/useDocumentExport.test.ts`

Expected: FAIL because export still uses the older export-only renderer path.

**Step 3: Write minimal implementation**

- Replace direct printable HTML composition with shared renderer calls
- Ensure export still produces a print-ready full HTML document
- Keep save / IPC behavior unchanged

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/useDocumentExport.test.ts src/features/export/exportUtils.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/useDocumentExport.ts src/app/useDocumentExport.test.ts src/features/export/exportUtils.ts src/features/export/documentHtmlRenderer.ts
git commit -m "refactor: route export html through shared renderer"
```

### Task 3: Replace Share-Side Duplicate Block Rendering

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.test.cjs` or `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/shareRender.test.ts`

**Step 1: Write the failing test**

Add a share render test that expects:

- share HTML body to include shared content classes such as `kb-export-alert`, `kb-export-table`, `kb-doc-mention`
- share rendering to cover checklist, ordered list, bullet list, `codeBlock`, attachments, and nested blocks through the shared renderer
- no legacy share-specific alert/table/content wrappers in the body output

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts`

Expected: FAIL because `electron/share/render.cjs` still owns its own block rendering logic.

**Step 3: Write minimal implementation**

- Remove duplicate block rendering helpers from `render.cjs`
- Import or consume the shared document renderer output
- Keep only share-specific shell responsibilities:
  - header
  - share state
  - updated timestamp
  - TOC frame
  - origin-aware asset URL rebasing only if needed

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add electron/share/render.cjs src/test/shareRender.test.ts
git commit -m "refactor: make share pages use shared content renderer"
```

### Task 4: Move Share Layout to Content-Pane Scrolling

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/shareRender.test.ts`

**Step 1: Write the failing test**

Add tests that expect share page layout to include:

- root shell with `overflow: hidden`
- dedicated `.share-content-pane` with `overflow-y: auto`
- sidebar shell separated from content pane
- no full-page body scrolling styles

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts`

Expected: FAIL because share page still behaves like a long scrolling webpage.

**Step 3: Write minimal implementation**

- Update share page shell CSS to lock page height
- Add content pane and sidebar pane layout
- Move scroll responsibility into content pane
- Keep sidebar sticky or independently scrollable without reintroducing page scroll

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add electron/share/render.cjs src/test/shareRender.test.ts
git commit -m "feat: make temporary share content pane scroll independently"
```

### Task 5: Align TOC and Heading Extraction with Shared Renderer

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/documentHtmlRenderer.ts`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/shareRender.test.ts`

**Step 1: Write the failing test**

Add tests that expect share TOC to be generated from the shared heading extractor and to stay in sync with body heading text.

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts`

Expected: FAIL because share TOC currently depends on its own heading extraction path.

**Step 3: Write minimal implementation**

- Move heading extraction into the shared renderer
- Make share shell consume the extracted heading list
- Preserve current TOC display shape while removing duplicate extraction logic

**Step 4: Run test to verify it passes**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add electron/share/render.cjs src/features/export/documentHtmlRenderer.ts src/test/shareRender.test.ts
git commit -m "refactor: share toc now uses shared heading extraction"
```

### Task 6: Remove Dead Share Renderer Paths and Run Full Verification

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.ts`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/shareRender.test.ts`

**Step 1: Write the failing test**

Add or extend tests that assert the old duplicate share rendering helpers are no longer required and that share and export still render the same core block classes.

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts src/features/export/exportUtils.test.ts src/app/useDocumentExport.test.ts`

Expected: FAIL until old paths are fully removed or updated.

**Step 3: Write minimal implementation**

- Delete or stop using obsolete share-only block rendering helpers
- Keep only shell composition in `render.cjs`
- Verify no share-only content classes remain in body rendering for blocks already owned by the shared renderer

**Step 4: Run test to verify it passes**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/shareRender.test.ts src/features/export/documentHtmlRenderer.test.ts src/features/export/exportUtils.test.ts src/app/useDocumentExport.test.ts`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected: all PASS

**Step 5: Commit**

```bash
git add electron/share/render.cjs src/features/export/documentHtmlRenderer.ts src/features/export/exportUtils.ts src/app/useDocumentExport.ts src/test/shareRender.test.ts
git commit -m "refactor: unify temporary share and export content rendering"
```

### Task 7: Manual Verification and Packaging Check

**Files:**
- No source changes required unless issues are found

**Step 1: Run targeted manual verification**

Run:

- start the app
- open a document containing `alert`, `richTable`, lists, checklist, code block, image, attachment, and `@提及`
- generate a temporary share link
- open the share page

Verify:

- share content matches export content styles for all blocks
- only the content pane scrolls
- header and TOC remain stable
- no block appears with the old share-only style set

**Step 2: Run packaging**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npx electron-builder --mac dmg`

Expected: `.dmg` builds successfully.

**Step 3: Commit if any manual-fix follow-up was needed**

```bash
git add -A
git commit -m "test: verify temporary share render parity end to end"
```
