# Right Sidebar Wiki Association Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the right sidebar into Properties and Wiki tabs, then separate semantic related topics from original-text evidence.

**Architecture:** Keep association derivation in `src/shared/lib/sidebarAssociations.ts` and app orchestration in `src/app/useSidebarAssociations.ts`. `RightSidebar` should remain a presentation component that consumes prepared association state. Add text evidence as a separate association layer instead of lowering semantic similarity thresholds.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Electron-backed local document records.

---

### Task 1: Add Text Evidence Association Tests

**Files:**
- Modify: `src/shared/lib/sidebarAssociations.test.ts`
- Modify later: `src/shared/lib/sidebarAssociations.ts`

**Step 1: Write the failing test**

Add a test proving a short active phrase can be evidence without becoming a related topic.

```ts
test('derives text evidence for short phrases inside long target paragraphs without promoting them to related topics', () => {
  const activeDocument = buildDocument({
    id: 'doc-active',
    title: '测试文档',
    sections: [],
    contentJson: JSON.stringify([
      {
        id: 'phrase-product-route',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '公司坚定不移践行产品化路线', styles: {} }],
        children: [],
      },
      {
        id: 'phrase-series',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '六大产品系列', styles: {} }],
        children: [],
      },
    ]),
  });

  const targetDocument = buildDocument({
    id: 'doc-target',
    title: '问题清单宣贯稿内容',
    sections: [],
    contentJson: JSON.stringify([
      {
        id: 'long-context',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'text',
            text:
              '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。当前现场问题、优化建议及新需求主要通过线下沟通或零散文档记录。',
            styles: {},
          },
        ],
        children: [],
      },
    ]),
  });

  const result = deriveSidebarAssociations({
    activeDocument,
    documents: [activeDocument, targetDocument],
    folders,
  });

  expect(result.relatedDocuments.map((document) => document.documentId)).not.toContain('doc-target');
  expect(result.textEvidence).toContainEqual(
    expect.objectContaining({
      documentId: 'doc-target',
      blockId: 'long-context',
      matchedText: '公司坚定不移践行产品化路线',
      reason: expect.stringContaining('关键句'),
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: FAIL because `textEvidence` does not exist on `SidebarAssociationResult`.

**Step 3: Add minimal types and derivation**

In `src/shared/lib/sidebarAssociations.ts`, add:

```ts
export interface SidebarTextEvidence {
  documentId: string;
  documentTitle: string;
  blockId: string;
  label: string;
  matchedText: string;
  snippet: string;
  reason: string;
  score: number;
}
```

Extend `SidebarAssociationResult` with:

```ts
textEvidence: SidebarTextEvidence[];
summary: {
  wikiAssociationCount: number;
};
```

Update empty states in:

- `src/app/useSidebarAssociations.ts`
- `src/features/shell/RightSidebar.tsx`
- related tests that construct association objects.

Add a small evidence extractor that:

- Gets active document block candidates, including short paragraph and heading-like lines.
- Keeps candidates with visible length between 4 and 40.
- Searches same-space document candidates for exact substring matches.
- Emits evidence with matched block id, target title, snippet, and reason.
- Does not feed evidence into `relatedDocuments`.
- Computes `summary.wikiAssociationCount` from explicit references, related topics, and text evidence. Display `1` through `9` exactly and display `9+` when the count exceeds 9. If explicit references remain derived in `RightSidebar` for the first pass, compute the summary from prepared semantic/evidence state first and add explicit references in a later task.

**Step 4: Run focused tests**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/lib/sidebarAssociations.ts src/shared/lib/sidebarAssociations.test.ts src/app/useSidebarAssociations.ts src/features/shell/RightSidebar.tsx
git commit -m "feat: derive sidebar text evidence separately"
```

### Task 2: Add Document-Level Deduping Between Related Topics and Evidence

**Files:**
- Modify: `src/shared/lib/sidebarAssociations.test.ts`
- Modify: `src/shared/lib/sidebarAssociations.ts`

**Step 1: Write the failing test**

Add a test where one document has semantic similarity and exact text evidence.

Expected behavior:

- The document remains in `relatedDocuments`.
- The evidence is retained in `textEvidence`.
- The UI can later attach evidence to the topic card instead of rendering duplicate document cards.

Use this assertion:

```ts
expect(result.relatedDocuments).toContainEqual(
  expect.objectContaining({ documentId: 'doc-target' }),
);
expect(result.textEvidence).toContainEqual(
  expect.objectContaining({ documentId: 'doc-target' }),
);
```

**Step 2: Run test to verify it fails or exposes current behavior**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: FAIL if evidence extraction is too narrow or related topic logic is polluted.

**Step 3: Refine scoring without changing semantic thresholds**

Keep `relatedDocuments` driven only by semantic similarity matches. Keep `textEvidence` separate.

If needed, add `relatedTopicDocumentIds` only as metadata for UI rendering, not for filtering evidence out of the state.

**Step 4: Run focused tests**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/lib/sidebarAssociations.ts src/shared/lib/sidebarAssociations.test.ts
git commit -m "test: cover sidebar topic and evidence overlap"
```

### Task 3: Split Right Sidebar Into Properties and Wiki Tabs

**Files:**
- Modify: `src/features/shell/RightSidebar.test.tsx`
- Modify: `src/features/shell/RightSidebar.tsx`

**Step 1: Write the failing UI test**

Add a test that renders the sidebar and expects two tab buttons:

```ts
expect(screen.getByRole('button', { name: '属性' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Wiki' })).toBeInTheDocument();
```

Add a badge assertion when associations exist:

```ts
expect(screen.getByRole('button', { name: /Wiki 2/ })).toBeInTheDocument();
```

Then click Wiki and assert:

```ts
await user.click(screen.getByRole('button', { name: 'Wiki' }));
expect(screen.getByText('显式引用')).toBeInTheDocument();
expect(screen.getByText('相关主题')).toBeInTheDocument();
expect(screen.getByText('原文线索')).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/features/shell/RightSidebar.test.tsx
```

Expected: FAIL because tabs do not exist.

**Step 3: Implement the tab state**

In `RightSidebar.tsx`:

- Add `const [activeTab, setActiveTab] = useState<'properties' | 'wiki'>('properties');`
- Add a compact segmented control near the top of the sidebar.
- Add a compact badge to the Wiki tab when the association count is greater than zero.
- Keep the first implementation defaulting to the Properties tab; do not persist the last selected tab yet.
- Move existing tags and outline into the Properties tab body.
- Move current knowledge association card into the Wiki tab body.

Keep the visual style compact and work-focused. Do not create nested cards.

**Step 4: Run UI tests**

Run:

```bash
npm test -- src/features/shell/RightSidebar.test.tsx
```

Expected: PASS after updating existing assertions for the new default tab.

**Step 5: Commit**

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx
git commit -m "feat: split right sidebar into property and wiki tabs"
```

### Task 4: Render Text Evidence in the Wiki Tab

**Files:**
- Modify: `src/features/shell/RightSidebar.test.tsx`
- Modify: `src/features/shell/RightSidebar.tsx`

**Step 1: Write the failing UI test**

Create an `associationState` with `textEvidence`:

```ts
textEvidence: [
  {
    documentId: 'doc-target',
    documentTitle: '问题清单宣贯稿内容',
    blockId: 'long-context',
    label: '问题清单宣贯稿内容',
    matchedText: '公司坚定不移践行产品化路线',
    snippet: '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。',
    reason: '命中关键句',
    score: 12,
  },
],
```

Click Wiki and assert:

```ts
expect(screen.getByText('原文线索')).toBeInTheDocument();
expect(screen.getByText('问题清单宣贯稿内容')).toBeInTheDocument();
expect(screen.getByText(/公司坚定不移践行产品化路线/)).toBeInTheDocument();
```

Click the evidence row and expect:

```ts
expect(onOpenBacklinkDocument).toHaveBeenCalledWith({
  documentId: 'doc-target',
  blockId: 'long-context',
  fallbackText: expect.stringContaining('公司坚定不移践行产品化路线'),
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/features/shell/RightSidebar.test.tsx
```

Expected: FAIL because evidence is not rendered.

**Step 3: Implement evidence rendering**

In the Wiki tab:

- Rename current "相似内容" section to "相关主题".
- Render `associationState.relatedDocuments` there.
- Add "原文线索" below it.
- Render each evidence item as a compact row with:
  - target document title
  - reason + matched text
  - optional snippet in the hover preview or secondary text
- Click opens `{ documentId, blockId, fallbackText: snippet || matchedText }`.

**Step 4: Run UI tests**

Run:

```bash
npm test -- src/features/shell/RightSidebar.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx
git commit -m "feat: show text evidence in wiki sidebar"
```

### Task 5: Update App-Level Empty Association State and Cache Tests

**Files:**
- Modify: `src/app/useSidebarAssociations.test.tsx`
- Modify: `src/app/useSidebarAssociations.ts`
- Modify as needed: `src/features/shell/AppShell.tsx`

**Step 1: Write or update tests**

Update all expected empty association states to include:

```ts
textEvidence: [],
summary: {
  wikiAssociationCount: 0,
},
```

Add a cache-key regression if evidence depends on `contentJson`:

```ts
expect(buildSidebarAssociationsCacheKey(...)).toContain('公司坚定不移践行产品化路线');
```

The existing cache already summarizes `contentJson`, so this may only require fixture updates.

**Step 2: Run focused app tests**

Run:

```bash
npm test -- src/app/useSidebarAssociations.test.tsx
```

Expected: PASS.

**Step 3: Fix fixtures**

Update test fixtures and default empty association constants only. Do not add new derivation logic here.

**Step 4: Run related tests together**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebar.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/useSidebarAssociations.ts src/app/useSidebarAssociations.test.tsx src/features/shell/AppShell.tsx
git commit -m "chore: update sidebar association state shape"
```

### Task 6: Run Verification and Capture Follow-Up

**Files:**
- Modify if needed: `docs/agents/memory/project-lessons.md`

**Step 1: Run focused tests**

Run:

```bash
npm test -- src/shared/lib/sidebarAssociations.test.ts src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebar.test.tsx
```

Expected: PASS.

**Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

**Step 3: Run diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

**Step 4: Optional browser verification**

If a dev server or Electron app is already running, open the app and verify:

- Properties tab shows tags and outline.
- Wiki tab shows explicit references, related topics, and text evidence.
- Text evidence for the test documents opens the matched block.

If no app is running, start the normal dev workflow:

```bash
npm run dev
```

Then verify visually.

**Step 5: Commit verification notes if needed**

If implementation reveals a durable product lesson, update:

```bash
docs/agents/memory/project-lessons.md
```

Commit only the lesson if it is directly related:

```bash
git add docs/agents/memory/project-lessons.md
git commit -m "docs: capture sidebar association lesson"
```

## Execution Notes

- Do not lower semantic thresholds as the main fix.
- Do not move expensive derivation into `RightSidebar` render.
- Keep same-space filtering.
- Keep the first implementation local and deterministic; embeddings or AI retrieval are future work.
- Avoid changing left-sidebar search behavior.

## Handoff

Plan complete and saved to `docs/plans/2026-05-15-right-sidebar-wiki-association-tabs.md`.

Two execution options:

1. Subagent-Driven (this session) - dispatch fresh subagent per task, review between tasks, fast iteration.
2. Parallel Session (separate) - open a new session with executing-plans, batch execution with checkpoints.
