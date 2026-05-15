# Graphify Sidebar Association Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the first minimal-intrusion Graphify sidebar slice by keeping the outline card, renaming the explicit-relationship area to `上下文`, and adding a new `关联` card backed by local document-derived recommendations.

**Architecture:** Keep the current three-column shell intact. Add a small association-derivation layer that scores related documents, tags, and block snippets from existing `DocumentRecord` data, then surface that data in `RightSidebar` without introducing a full graph page yet. Block-level association state is driven by the user's current outline click inside the sidebar for this first slice.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing Electron/SQLite workspace snapshot data.

---

### Task 1: Add the association-derivation model and tests

**Files:**
- Create: `src/shared/lib/sidebarAssociations.ts`
- Create: `src/shared/lib/sidebarAssociations.test.ts`
- Modify: `src/shared/types/workspace.ts`

**Step 1: Write the failing tests**

Cover these behaviors:

- deriving related documents from existing documents in the same space
- recommending related tags that are not already attached to the active document
- deriving block-level similar snippets when given a focused outline/section target
- returning stable empty states when no associations exist

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/sidebarAssociations.test.ts`

Expected: FAIL because the new module/types do not exist yet.

**Step 3: Write minimal implementation**

Implement a helper that:

- accepts `activeDocument`, `documents`, and `folders`
- uses existing document data only
- scores related documents using a small weighted heuristic:
  - shared tags
  - outgoing/incoming explicit links
  - text overlap from derived sections
- returns:
  - `relatedDocuments`
  - `relatedTags`
  - `similarBlocks`
  - `suggestedLinks`
- supports an optional focused section/block id for block-mode results

Add the smallest supporting types needed in `workspace.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/sidebarAssociations.test.ts`

Expected: PASS

### Task 2: Red-green the sidebar UI and behavior

**Files:**
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`

**Step 1: Write the failing tests**

Add/update sidebar tests for:

- showing the new three-card mental model:
  - `文稿概览`
  - `上下文`
  - `关联`
- keeping the outline card intact
- rendering association results for the active document
- switching the association card into block mode after clicking an outline item
- showing the new empty states when no association data exists
- keeping the existing explicit-reference actions working under `上下文`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`

Expected: FAIL because the current sidebar still uses the old footer section and has no association card.

**Step 3: Write minimal implementation**

Update `RightSidebar` to:

- keep the existing outline card as the main overview card
- rename the explicit references card/section to `上下文`
- add a new `关联` card below it
- consume the new association helper
- keep local `focusedOutlineItemId` state so outline clicks can drive block-mode associations
- add a lightweight top-level label or visual cue for block-mode vs document-mode associations
- preserve current backlink/open behaviors

Do not add a permanent graph canvas yet. The only graph affordance for this slice is a lightweight `查看关系图` button/placeholder entry inside the association card.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`

Expected: PASS

### Task 3: Thread the workspace data into the sidebar and cover the app-level regression

**Files:**
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/app/App.test.tsx`

**Step 1: Write the failing test**

Add or update an app-level regression test asserting that the mounted app still renders:

- the outline card
- the explicit context card
- the new association card

and still supports the existing tag interactions.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `RightSidebar` does not yet receive the extra workspace data it needs.

**Step 3: Write minimal implementation**

Update `AppShell` to pass the current space documents/folders into `RightSidebar`.

Keep the prop surface tight:

- `documents`
- `folders`

Do not widen the sidebar to own workspace fetching logic.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS

### Task 4: Verify the integrated slice

**Files:**
- No new files expected

**Step 1: Run the targeted suite**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts src/features/shell/RightSidebar.test.tsx src/app/App.test.tsx
```

Expected: PASS

**Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS

**Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS

**Step 4: Review against design**

Checklist:

- the right sidebar still feels like the same workspace
- the outline/overview value was preserved
- `上下文` reads as explicit relationship data
- `关联` reads as system-discovered relationship data
- outline clicks can drive association block mode
- no new top-level navigation was introduced

### Task 5: Subagent execution split

**Ownership split:**

- Worker A owns `src/shared/lib/sidebarAssociations.ts`, `src/shared/lib/sidebarAssociations.test.ts`, and any type additions in `src/shared/types/workspace.ts`
- Worker B owns `src/features/shell/RightSidebar.tsx` and `src/features/shell/RightSidebar.test.tsx`
- Main session owns `src/features/shell/AppShell.tsx`, `src/app/App.test.tsx`, integration fixes, and final verification

**Constraints:**

- Workers are not alone in the codebase and must not revert others' edits.
- Worker A must not edit shell components.
- Worker B must not edit shared association helpers or workspace types.

Plan saved for subagent-driven execution in this session.
