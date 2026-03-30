# BlockNote React Entry Alias Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the single-user BlockNote optimization by removing the comment-enabled React package root from the runtime dependency graph.

**Architecture:** Route all app and Mantine-source `@blocknote/react` imports through a curated local wrapper that re-exports only the editor primitives the product actually uses. Keep CSS on the upstream path, and stop rendering UI for disabled `tableHandles`.

**Tech Stack:** Vite, Vitest, React, TypeScript, BlockNote

---

### Task 1: Add a failing regression test for package-root imports

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/BlockNoteImportSource.test.ts`

**Step 1: Assert editor source files no longer import `@blocknote/react` directly**

Check the app editor entry points and custom editor components.

**Step 2: Run the focused test and confirm failure**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/BlockNoteImportSource.test.ts`

Expected: FAIL while package-root imports still exist.

### Task 2: Add a curated local BlockNote wrapper and migrate imports

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/blocknoteReactNoComments.ts`
- Modify:
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/editor-host/EditorHost.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/QuickNoteCenterPane.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/Alert.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTable.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/editorSchema.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseEditorView.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseFormattingToolbar.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SelectionFormattingToolbarController.tsx`
  - `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.tsx`

**Step 1: Re-export only the leaf modules we actually use**

Keep the wrapper limited to hooks, controllers, toolbar primitives, schema helpers, and a few Mantine-source support utilities.

**Step 2: Remove UI for disabled `tableHandles`**

Drop the `TableHandlesController` render and the `TableCellMergeButton` toolbar item because the editor already disables that extension.

### Task 3: Alias BlockNote React root imports in Vite

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/vitePackagingConfig.test.ts`

**Step 1: Alias `@blocknote/react` to the curated wrapper**

This catches both app code and `@blocknote/mantine` source imports.

**Step 2: Preserve the CSS import path**

Alias `@blocknote/react/style.css` to the real upstream stylesheet so PostCSS keeps resolving correctly.

**Step 3: Add regression coverage for the new aliases**

Verify the config contains both BlockNote aliases and the collaboration aliases.

### Task 4: Verify the bundle is comment-free and green

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/dist/assets`

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && rg "FloatingThread|FloatingComposer|ThreadsSidebar|useThreads|useUsers|bn-thread|comments" dist/assets/editor-blocknote-react-*.js`

Expected:

- all verification commands pass
- the `rg` command returns no matches
- `editor-blocknote-react` becomes materially smaller than the pre-alias version
