# Editor Style Trim Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broad BlockNote Mantine stylesheet with a local trimmed editor stylesheet while keeping the existing editor behavior intact.

**Architecture:** Keep the current editor component tree and emoji functionality unchanged. Only replace the stylesheet entry point so the app imports a curated Mantine CSS subset plus the BlockNote editor styles already in use.

**Tech Stack:** Vite, React, Vitest, BlockNote, Mantine, CSS

---

### Task 1: Add a failing regression test for the stylesheet entry

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseEditorStylesSource.test.ts`

**Step 1: Assert the app entry uses a local editor stylesheet**

Check that:

- [main.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/main.tsx) no longer imports `@blocknote/mantine/style.css`
- it imports the new local editor stylesheet instead

**Step 2: Assert the local stylesheet does not fall back to the upstream broad entry**

Check that the new file does not import `@blocknote/mantine/style.css`.

**Step 3: Run the focused test and confirm failure**

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/shared/editor/KnowledgeBaseEditorStylesSource.test.ts`

Expected: FAIL while `main.tsx` still imports the broad upstream stylesheet.

### Task 2: Create the trimmed local editor stylesheet

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/knowledgeBaseMantineStyles.css`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/knowledgeBaseEditorStyles.css`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/main.tsx`

**Step 1: Create a trimmed Mantine stylesheet**

Because the app already imports `@mantine/core/styles.css` globally, do not duplicate the upstream scoped Mantine baseline or CSS variable block. Import only the component CSS files needed by the editor components currently rendered by:

- toolbar
- menu
- popover
- file panel
- side menu
- suggestion menu
- grid suggestion menu
- text input

**Step 2: Create a local editor stylesheet entry**

Compose:

- the trimmed Mantine stylesheet
- the required BlockNote editor styles

**Step 3: Point the app entry at the local stylesheet**

Replace the upstream `@blocknote/mantine/style.css` import in [main.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/main.tsx).

### Task 3: Verify build health and bundle outcome

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`

Expected:

- all checks pass
- `editor-mantine` CSS output shrinks relative to the current baseline

### Outcome

Implemented in:

- [main.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/main.tsx)
- [knowledgeBaseEditorStyles.css](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/knowledgeBaseEditorStyles.css)
- [knowledgeBaseMantineStyles.css](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/knowledgeBaseMantineStyles.css)
- [KnowledgeBaseEditorStylesSource.test.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/KnowledgeBaseEditorStylesSource.test.ts)

Verified results:

- `npm run typecheck` passes
- `npm test` passes with `26` files and `85` tests green
- `npm run build` passes
- `editor-mantine` CSS drops from about `305.72 kB` to about `203.17 kB`

Result:

- the app no longer imports the broad `@blocknote/mantine/style.css` entry
- the editor keeps emoji support by preserving the upstream BlockNote structural stylesheet
- Mantine CSS is limited to the component set the current editor UI actually renders
