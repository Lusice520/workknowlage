# Remove BlockNote Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove BlockNote collaboration and comments from the app-level editor surface so the editor build no longer ships collaboration code.

**Architecture:** Replace the default BlockNote view wrapper with a local lightweight wrapper that mounts the editor, provides the required BlockNote and Mantine component contexts, and renders only the controllers used by the product. Replace the formatting toolbar helper path with a comment-free local toolbar/controller pair.

**Tech Stack:** React, Vite, BlockNote, Mantine, Vitest

---

### Task 1: Write failing guard tests

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseFormattingToolbarSource.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.test.ts`

**Step 1: Add a toolbar source assertion**

Assert that the toolbar source no longer uses the default `getFormattingToolbarItems` helper.

**Step 2: Add an editor surface source assertion**

Assert that the editor surface no longer renders the default `BlockNoteView` wrapper from `@blocknote/mantine`.

### Task 2: Replace the comment-bearing editor view path

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseEditorView.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.tsx`

**Step 1: Add the local lightweight editor view**

Provide:

- BlockNote context
- Mantine components context
- editor mount and unmount
- portal plumbing

Do not render BlockNote default UI.

**Step 2: Update the surface to render explicit controllers**

Keep:

- formatting toolbar
- slash menu
- link toolbar
- side menu
- file panel
- table handles

Do not include comments controllers.

### Task 3: Replace the formatting toolbar helper path

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseFormattingToolbar.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SelectionFormattingToolbarController.tsx`

**Step 1: Build a local toolbar item list**

Keep the existing visible actions but omit comment buttons.

**Step 2: Remove the dependency on BlockNote's default formatting toolbar component**

Use a local controller path so the editor no longer imports the comment-aware toolbar module.

### Task 4: Verify behavior and packaging

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/dist/assets`

**Step 1: Run focused tests**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/KnowledgeBaseFormattingToolbarSource.test.ts src/shared/editor/SharedBlockNoteSurface.test.ts`

**Step 2: Run full tests**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`

**Step 3: Run typecheck**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`

**Step 4: Run build**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected:

- no `editor-blocknote-collab` chunk in `dist/assets`
- no collaboration-related build regressions
