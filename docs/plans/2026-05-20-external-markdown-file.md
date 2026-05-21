# External Markdown File Opening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let macOS open external `.md` / `.markdown` files in a separate WorkKnowlage editor window without importing them into the knowledge base unless the user chooses to.

**Architecture:** Electron registers Markdown file associations and handles `open-file`, startup argv, and second-instance file paths. Each external file opens in a dedicated renderer route backed by IPC methods that read/write the original Markdown file, reveal it in Finder, and optionally import the current editor content into the default knowledge space.

**Tech Stack:** Electron main/preload IPC, React, BlockNote, local filesystem, electron-builder macOS file associations, Vitest.

---

## Product Contract

- External Markdown files open in a separate WorkKnowlage window, not inside the main knowledge-base shell.
- The window uses the WorkKnowlage block editor experience, not a raw Markdown text area.
- The right Wiki/relationship sidebar is removed for this mode.
- The document outline remains available, moved to the left side.
- The top bar shows file name, external-file status, full path, autosave state, file modified time, and word count.
- “在 Finder 中显示” and “导入知识库” live in the top-right action area.
- Saving is automatic. There is no primary manual save button.
- Import creates a normal WorkKnowlage document only when the user clicks “导入知识库”.
- Markdown roundtrip may normalize formatting because BlockNote is the editing surface.

## Task 1: Electron External File Module

**Files:**
- Create: `electron/externalFiles.cjs`
- Create: `electron/externalFiles.test.ts`

**Steps:**
1. Write failing tests for allowed Markdown extensions, reading file metadata/content, saving Markdown, and importing the current content into the first available space.
2. Run `npm test -- electron/externalFiles.test.ts` and confirm the tests fail because the module does not exist.
3. Implement small pure helpers plus repository-backed import logic.
4. Run `npm test -- electron/externalFiles.test.ts` and confirm green.

## Task 2: Main Process Window Routing

**Files:**
- Modify: `electron/main.cjs`

**Steps:**
1. Add tests or direct coverage through `electron/externalFiles.test.ts` for argv path filtering where practical.
2. Add external file window tracking keyed by `webContents.id`.
3. Add `app.on('open-file')`, startup argv handling, and `second-instance` handling.
4. Create external windows with `?view=external-file` and keep main windows unchanged.
5. Register IPC handlers for initial load, autosave, reveal in Finder, and import.

## Task 3: Preload And Types

**Files:**
- Modify: `electron/preload.cjs`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`

**Steps:**
1. Extend `WorkKnowlageDesktopApi` with `externalFiles`.
2. Expose IPC wrappers in preload.
3. Add a safe browser-mock fallback so renderer tests can run outside Electron.
4. Run relevant type checks after the renderer is wired.

## Task 4: External Renderer Route

**Files:**
- Modify: `src/main.tsx`
- Create: `src/features/external-file/ExternalFileApp.tsx`
- Create: `src/features/external-file/ExternalFileApp.test.tsx`

**Steps:**
1. Write failing UI tests for top actions, status metadata, outline rendering, and route selection.
2. Render `<ExternalFileApp />` when `window.location.search` has `view=external-file`.
3. Load Markdown through `externalFiles.getInitial()`.
4. Parse Markdown into BlockNote blocks with `tryParseMarkdownToBlocks`.
5. Autosave by converting current blocks back to Markdown with `blocksToMarkdownLossy`.
6. Derive outline and word count from serialized blocks.
7. Import by sending title and content JSON to the main process.

## Task 5: Packaging File Associations

**Files:**
- Modify: `package.json`
- Modify: `src/test/vitePackagingConfig.test.ts`

**Steps:**
1. Add a failing packaging-config test proving `.md` / `.markdown` file associations are configured.
2. Add electron-builder `fileAssociations` for Markdown documents.
3. Run the packaging config test.

## Verification

- `npm test -- electron/externalFiles.test.ts src/features/external-file/ExternalFileApp.test.tsx src/test/vitePackagingConfig.test.ts`
- `npm run typecheck`
- `npm run package:mac:dir`
- Inspect generated `Info.plist` for `CFBundleDocumentTypes`.

## Known Data Safety Notes

- External-file autosave writes back to the original Markdown path. The implementation must avoid writing before the initial Markdown has been parsed and rendered.
- Import should create a new WorkKnowlage document and must not delete or mutate the external source file.
- Markdown formatting may be normalized on save because the WorkKnowlage block editor is the source of truth while the file window is open.
