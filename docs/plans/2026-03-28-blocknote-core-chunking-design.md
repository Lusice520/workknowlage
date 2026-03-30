# BlockNote Core Chunking Design

**Goal:** Continue reducing the oversized BlockNote core vendor chunk without changing editor behavior.

**Why now:** The previous bundle pass removed circular chunk warnings and kept the main app entry small, but `editor-blocknote-core` still remains over 1 MB after minification. The next safest win is to restore chunk boundaries around optional BlockNote capabilities that are already separate in upstream dependencies.

## Considered Options

### Option 1: Split optional BlockNote capabilities into dedicated vendor chunks

- Move `emoji-mart` and `@emoji-mart/data` into an `editor-blocknote-emoji` chunk
- Move `yjs`, `y-prosemirror`, and `y-protocols` into an `editor-blocknote-collab` chunk
- Keep the existing `editor-react`, `editor-mantine`, `editor-tiptap`, `editor-blocknote-core`, and `editor-blocknote-react` boundaries

**Pros**

- Lowest risk
- Matches upstream usage patterns, especially emoji loading
- Keeps the optimization entirely in Vite config

**Cons**

- Total downloaded bytes do not change
- Some static BlockNote imports may still keep part of the collaboration stack eagerly reachable

### Option 2: Continue splitting BlockNote core by internal utility families

- Separate markdown, highlighting, and low-level utility dependencies into more chunks

**Pros**

- Could reduce the largest remaining chunk further

**Cons**

- Higher risk of creating new circular chunk warnings
- Harder to reason about without a bundle visualizer

## Decision

Adopt **Option 1** for this round.

This pass will:

- update [vite.config.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts)
- add `editor-blocknote-emoji`
- add `editor-blocknote-collab`
- keep runtime behavior unchanged

Expected outcome:

- `editor-blocknote-core` should shrink materially
- emoji assets should move into their own chunk
- no new circular chunk warnings should appear

Verification standard:

- `npm run build` passes
- `npm run typecheck` passes
- `npm test` passes
- no new circular chunk warnings appear in the build output
