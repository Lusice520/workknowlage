# BlockNote No-Collab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove BlockNote collaboration packages from the application build while preserving the current single-user editor experience.

**Architecture:** Keep the existing editor components and schema intact, but replace collaboration libraries with local no-op modules at the bundler boundary. This removes unused `yjs`-based code without forking BlockNote or changing the app's editor API.

**Tech Stack:** Vite, Vitest, React, BlockNote, TypeScript

---

### Task 1: Add a failing config regression test

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/vitePackagingConfig.test.ts`

**Step 1: Assert the no-collab build constraints**

Add assertions for:

- aliases for `yjs`, `y-prosemirror`, and `y-protocols/awareness`
- no `editor-blocknote-collab` manual chunk mapping

**Step 2: Run the focused test and confirm failure**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/vitePackagingConfig.test.ts`

Expected: FAIL because the aliases do not exist yet and the collab chunk rule still exists.

### Task 2: Add local no-collab stubs and wire aliases

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/noCollab/yjs.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/noCollab/yProsemirror.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/noCollab/yProtocolsAwareness.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts`

**Step 1: Add minimal stub exports**

Export the collaboration symbols BlockNote imports, and make each runtime path throw a clear `"Collaboration is disabled in WorkKnowlage"` error if called.

**Step 2: Alias those packages in Vite/Vitest config**

Redirect:

- `yjs`
- `y-prosemirror`
- `y-protocols/awareness`

**Step 3: Remove the `editor-blocknote-collab` manual chunk rule**

The real collaboration packages should no longer participate in bundle splitting.

### Task 3: Verify green

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/dist/assets`

**Step 1: Re-run the focused config test**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/test/vitePackagingConfig.test.ts`

Expected: PASS

**Step 2: Run full verification**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected:

- all commands pass
- build output does not contain `editor-blocknote-collab`
