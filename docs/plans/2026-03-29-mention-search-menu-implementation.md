# Mention Search Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the `@mention` menu so users can search by document title and path, while keeping the suggestion list capped and usable in large workspaces.

**Architecture:** Keep mention search entirely in the renderer by enriching the mention candidate payload with folder path and update metadata. Reuse BlockNote's existing `SuggestionMenuController` query flow, then add ranking and result limiting inside `getDocumentMentionItems` so no new editor state or backend API is required.

**Tech Stack:** React, TypeScript, Vitest, BlockNote `SuggestionMenuController`

---

### Task 1: Add the failing editor mention tests first

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/editorSchema.tsx`

**Step 1: Write the failing tests**

Add coverage for:

- filtering mention items by title query
- filtering mention items by folder path query
- limiting mention results to `8`
- keeping the current document excluded

Prefer testing the pure mention-item builder logic in `editorSchema.tsx` directly instead of mounting the full editor UI.

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/SharedBlockNoteSurface.test.ts
```

Expected: FAIL because path-aware filtering and result limiting are not implemented yet.

**Step 3: Write minimal implementation**

Keep the implementation targeted to mention item generation. Do not change unrelated slash-menu or toolbar behavior.

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/SharedBlockNoteSurface.test.ts
```

Expected: PASS

### Task 2: Enrich mention candidates with path metadata

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/documentPaths.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/editor-host/EditorHost.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.tsx`

**Step 1: Write the failing test**

If a dedicated pure helper test is needed, add one for the new path builder:

- root documents return `根目录`
- nested documents return `父目录 / 子目录`

**Step 2: Run test to verify it fails**

Run only the new helper test if added.

**Step 3: Write minimal implementation**

Implement:

- a shared path builder that derives display path from `folders + folderId`
- a richer mention candidate shape carrying `id`, `title`, `folderPath`, `updatedAt`
- propagation of that shape from `CenterPane` down to the editor surface

**Step 4: Run test to verify it passes**

Run the focused helper/editor tests again.

### Task 3: Upgrade mention filtering, ranking, and truncation

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/editorSchema.tsx`

**Step 1: Write the failing test**

Add assertions for:

- title prefix hits rank above generic title contains
- title matches rank above path-only matches
- results are truncated to `8`
- subtitle shows the path label

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/SharedBlockNoteSurface.test.ts
```

Expected: FAIL because current ranking is only a simple title `includes`.

**Step 3: Write minimal implementation**

Implement in `getDocumentMentionItems`:

- query normalization
- match scoring
- descending sort by score, then by `updatedAt`
- `.slice(0, 8)`
- `subtext` set to the candidate path label

Keep self-exclusion behavior intact.

**Step 4: Run test to verify it passes**

Run the same focused test command and confirm green.

### Task 4: Apply a lightweight menu-height guard if needed

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.css`
- Test: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/SharedBlockNoteSurface.test.ts`

**Step 1: Write the failing test**

If the existing source-level CSS tests fit, add a small regression assertion that the suggestion menu receives a max-height / overflow guard.

**Step 2: Run test to verify it fails**

Run the focused CSS/source test.

**Step 3: Write minimal implementation**

Only if needed after local verification:

- add a conservative max-height to `.bn-suggestion-menu`
- enable internal vertical scrolling

Avoid over-styling the menu or replacing the component unless necessary.

**Step 4: Run test to verify it passes**

Run the focused test again.

### Task 5: Run focused and full verification

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/SharedBlockNoteSurface.test.ts
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/editor-host/EditorHost.test.tsx
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build
```

Expected:

- focused mention tests pass
- existing editor-host regression tests stay green
- full suite, typecheck, and build remain green
