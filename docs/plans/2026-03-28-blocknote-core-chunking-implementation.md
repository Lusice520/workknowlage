# BlockNote Core Chunking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split optional BlockNote editor capabilities into dedicated vendor chunks so the remaining oversized core chunk shrinks without changing behavior.

**Architecture:** Keep the current lazy editor boundaries and adjust only Vite manual chunking. The new chunk map should preserve the stable top-level grouping while moving emoji and collaboration dependencies into their own BlockNote-specific chunks.

**Tech Stack:** Vite, React, BlockNote, Tiptap, Yjs, emoji-mart, Vitest

---

### Task 1: Confirm the target dependencies

**Files:**
- Review: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/node_modules/@blocknote/core/src`
- Review: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/node_modules/@blocknote/react/src`

**Step 1: Inspect upstream imports**

Run: `rg -n "emoji-mart|@emoji-mart/data|y-prosemirror|y-protocols|yjs" /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/node_modules/@blocknote/core/src /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/node_modules/@blocknote/react/src`

Expected: emoji and collaboration dependencies are confirmed as separable groups.

### Task 2: Add the new vendor chunk boundaries

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts`

**Step 1: Extend `manualChunks`**

Add:

- `editor-blocknote-emoji` for `emoji-mart` and `@emoji-mart/data`
- `editor-blocknote-collab` for `yjs`, `y-prosemirror`, and `y-protocols`

Keep:

- `editor-react`
- `editor-mantine`
- `editor-tiptap`
- `editor-blocknote-core`
- `editor-blocknote-react`

### Task 3: Verify the new bundle layout

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/dist/assets`

**Step 1: Run build**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected: build passes and the oversized BlockNote core chunk shrinks or is redistributed without circular chunk warnings.

**Step 2: Run typecheck**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`

Expected: pass

**Step 3: Run tests**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`

Expected: pass

### Outcome

Implemented in [vite.config.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts).

Final verified build output:

- `index` about `83.62 kB`
- `editor-react` about `144.22 kB`
- `editor-mantine` about `142.88 kB`
- `editor-blocknote-react` about `103.04 kB`
- `editor-blocknote-collab` about `107.14 kB`
- `editor-tiptap` about `488.47 kB`
- `editor-blocknote-emoji` about `510.21 kB`
- `editor-blocknote-core` about `589.83 kB`

Result:

- `editor-blocknote-core` dropped from about `1,207.60 kB` to about `589.83 kB`
- build, typecheck, and tests all pass
- no circular chunk warnings were introduced
- `editor-blocknote-collab` is still statically imported by the editor entry, so the next meaningful optimization would need code-level lazy loading rather than more config-only splitting
