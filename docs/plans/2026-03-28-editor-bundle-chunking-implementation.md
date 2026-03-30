# Editor Bundle Chunking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the editor dependency graph into safer Vite vendor chunks without changing editor runtime behavior.

**Architecture:** Keep the existing lazy-loaded `CenterPane` boundary and teach Vite to emit separate chunks for the shared React runtime, BlockNote React layer, BlockNote core layer, Tiptap/ProseMirror layer, and Mantine layer. This keeps the optimization purely at build time.

**Tech Stack:** Vite, React, BlockNote, Tiptap, ProseMirror, Mantine, Vitest

---

### Task 1: Record the build baseline

**Files:**
- Review: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts`

**Step 1: Run the current build**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

**Step 2: Note the current large editor chunk**

Expected: one editor-related chunk remains much larger than the rest.

### Task 2: Add build-time chunk grouping

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts`

**Step 1: Add `build.rollupOptions.output.manualChunks`**

Split:
- `react`, `react-dom`, `scheduler`, `use-sync-external-store` into `editor-react`
- `@blocknote/react` and its UI-only helpers into `editor-blocknote-react`
- `@blocknote/core` and its markdown / Yjs helpers into `editor-blocknote-core`
- `@tiptap/*`, `prosemirror-*`, `linkifyjs`, `@floating-ui/*` into `editor-tiptap`
- `@blocknote/mantine`, `@mantine/*`, `@emotion/*` into `editor-mantine`
- keep the rest on default chunking unless a clear bundle hotspot appears

**Step 2: Keep test config untouched**

Preserve the existing Vitest setup while extending the shared config object.

### Task 3: Verify the new chunk layout

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/dist/*`

**Step 1: Run typecheck**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`

**Step 2: Run tests**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`

**Step 3: Run build**

Run: `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

**Step 4: Compare emitted chunks**

Expected: the editor dependency graph is distributed across multiple named chunks instead of one oversized shared chunk.

### Outcome

Implemented in [vite.config.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts).

Final verified build output:

- `index` about `83.53 kB`
- `editor-react` about `144.22 kB`
- `editor-mantine` about `142.88 kB`
- `editor-blocknote-react` about `103.25 kB`
- `editor-tiptap` about `488.47 kB`
- `editor-blocknote-core` about `1,207.60 kB`

Result:

- the previous circular chunk warnings are gone
- build, typecheck, and tests all pass
- one large `editor-blocknote-core` chunk still remains, so the next optimization target should be deeper BlockNote core dependency splitting rather than more app-level lazy-loading
