# RichTable Checklist And List Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real checklist support inside RichTable cells and align RichTable bullet, numbered, and checklist styles with the main editor.

**Architecture:** Keep RichTable as its current TipTap-based embedded editor. Add `taskList/taskItem` support, a `[ ] ` input rule for checklist creation, and export rendering for checklist nodes. Align RichTable CSS to the main editor's list rhythm and checkbox presentation without rewriting the BlockNote editor layer.

**Tech Stack:** React, TypeScript, TipTap, CSS, Vitest

---

### Task 1: Add failing RichTable behavior tests for checklist support

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTableBehavior.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTable.tsx`

**Step 1: Write the failing test**

Add source-level regression coverage that asserts:

- `RichTable.tsx` imports and registers checklist extensions
- the editor supports a `[ ] ` creation rule
- static HTML rendering covers checklist nodes

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/RichTableBehavior.test.tsx
```

Expected: FAIL because checklist support is not wired yet.

**Step 3: Write minimal implementation**

Implement only the missing RichTable behavior:

- register task list extensions
- add the `[ ] ` input rule
- render checklist nodes in static HTML output

**Step 4: Run test to verify it passes**

Run the same command and confirm green.

### Task 2: Add failing RichTable style tests for checklist and list parity

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTableStyles.test.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTable.css`

**Step 1: Write the failing test**

Extend the source-style assertions to cover:

- shared list typography variables
- bullet and numbered marker alignment rules
- checklist container alignment
- checklist checkbox sizing and spacing

Mirror the main editor's existing list/checklist visual constraints, but expressed for RichTable selectors.

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/RichTableStyles.test.ts
```

Expected: FAIL because RichTable CSS still uses its older standalone list styles.

**Step 3: Write minimal implementation**

Update `RichTable.css` to:

- align list font size, line height, and color with the main editor
- align bullet and numbered marker spacing and baseline
- style checklist rows and inputs consistently with the main editor

**Step 4: Run test to verify it passes**

Run the same command and confirm green.

### Task 3: Run focused integration verification

**Files:**
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTableBehavior.test.tsx`
- Verify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/RichTableStyles.test.ts`

**Step 1: Run combined targeted tests**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/RichTableBehavior.test.tsx src/shared/editor/RichTableStyles.test.ts
```

Expected: PASS.

**Step 2: Run typecheck**

Run:

```bash
cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck
```

Expected: PASS.

**Step 3: If checklist implementation required CSS or render follow-up fixes, make the minimal integration adjustment**

Only adjust the smallest necessary lines to make both behavior and style expectations align.
