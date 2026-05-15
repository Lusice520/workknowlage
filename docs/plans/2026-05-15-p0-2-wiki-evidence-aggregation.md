# P0.2 Wiki Evidence Aggregation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggregate related-topic similarity evidence and original-text evidence under one Wiki related document card.

**Architecture:** Keep expensive derivation in `src/shared/lib/sidebarAssociations.ts`. Add an `associatedDocuments` display-ready layer while preserving existing arrays for compatibility. `RightSidebar` should consume `associatedDocuments` for the derived Wiki relation group and keep explicit references separate.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Electron local workspace records.

---

### Task 1: Add Aggregated Association Data Shape

**Files:**
- Modify: `src/shared/lib/sidebarAssociations.ts`
- Modify: `src/shared/lib/sidebarAssociations.test.ts`
- Modify: `src/app/useSidebarAssociations.ts`
- Modify: `src/app/useSidebarAssociations.test.tsx`
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`

**Step 1: Write the failing data test**

Add a test to `src/shared/lib/sidebarAssociations.test.ts`:

```ts
test('aggregates semantic and text evidence under one associated document', () => {
  const result = deriveSidebarAssociations({
    activeDocument,
    documents: [activeDocument, targetDocument],
    folders,
  });

  expect(result.associatedDocuments).toContainEqual(
    expect.objectContaining({
      documentId: 'doc-target',
      badges: expect.arrayContaining(['主题相似', '原文命中']),
      similarityEvidence: expect.arrayContaining([
        expect.objectContaining({ blockId: 'semantic-match' }),
      ]),
      textEvidence: expect.arrayContaining([
        expect.objectContaining({ matchedText: '公司坚定不移践行产品化路线' }),
      ]),
    }),
  );
  expect(result.associatedDocuments.filter((item) => item.documentId === 'doc-target')).toHaveLength(1);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: FAIL because `associatedDocuments` does not exist.

**Step 3: Add types and empty state**

In `src/shared/lib/sidebarAssociations.ts`, add:

```ts
export type SidebarAssociatedDocumentBadge = '主题相似' | '局部相似' | '原文命中';

export interface SidebarAssociatedDocumentEvidence {
  blockId: string;
  label: string;
  snippet: string;
  searchText: string;
  reason: string;
  score: number;
}

export interface SidebarAssociatedDocument {
  documentId: string;
  title: string;
  folderPath: string;
  score: number;
  badges: SidebarAssociatedDocumentBadge[];
  similarityEvidence: SidebarAssociatedDocumentEvidence[];
  textEvidence: SidebarTextEvidence[];
}
```

Extend `SidebarAssociationResult` with:

```ts
associatedDocuments: SidebarAssociatedDocument[];
```

Update all empty state constants in tests and app/sidebar files to include `associatedDocuments: []`.

**Step 4: Implement aggregation**

Add a helper near `deriveSidebarAssociations`:

```ts
const deriveAssociatedDocuments = ({
  relatedDocumentScores,
  similarBlocks,
  textEvidence,
  folders,
}: {
  relatedDocumentScores: ScoredRelatedDocument[];
  similarBlocks: SidebarSimilarBlock[];
  textEvidence: SidebarTextEvidence[];
  folders: FolderNode[];
}): SidebarAssociatedDocument[] => {
  // map by document id; add badges and evidence from each source
};
```

Rules:

- Related documents add badge `主题相似`.
- Similar blocks add badge `局部相似`.
- Text evidence adds badge `原文命中`.
- One target document appears once.
- `similarityEvidence` includes related document preview matches and similar blocks.
- `textEvidence` retains the original evidence records.
- Sort by score desc, evidence count desc, title.

**Step 5: Run tests**

Run:

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts src/app/useSidebarAssociations.test.tsx
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/shared/lib/sidebarAssociations.ts src/shared/lib/sidebarAssociations.test.ts src/app/useSidebarAssociations.ts src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx
git commit -m "feat: aggregate wiki association evidence"
```

### Task 2: Render Aggregated Wiki Document Cards

**Files:**
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`

**Step 1: Write failing UI test**

Add a test in `RightSidebar.test.tsx` with one `associatedDocuments` item containing both `similarityEvidence` and `textEvidence`.

Assert:

```ts
openWikiTab();
expect(screen.getByText('关联文档')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '打开关联文档 问题清单宣贯稿内容' })).toBeInTheDocument();
expect(screen.queryByText('原文线索')).not.toBeInTheDocument();
expect(screen.getByText('主题相似')).toBeInTheDocument();
expect(screen.getByText('原文命中')).toBeInTheDocument();
expect(screen.getByText('1 处相似 · 1 条线索')).toBeInTheDocument();
```

Hover the card and assert both evidence details render.

Click original-text evidence and expect:

```ts
expect(onOpenBacklinkDocument).toHaveBeenCalledWith({
  documentId: 'doc-evidence',
  blockId: 'long-context',
  fallbackText: expect.stringContaining('公司坚定不移践行产品化路线'),
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
rtk npm test -- src/features/shell/RightSidebar.test.tsx
```

Expected: FAIL because UI still renders separate `相关主题` and `原文线索` sections.

**Step 3: Implement rendering**

In `RightSidebar.tsx`:

- Add a display fallback helper that builds aggregated docs from old arrays when `associatedDocuments` is empty.
- Replace the separate `相关主题` and `原文线索` groups with `关联文档`.
- Render each document row with evidence badges and count text.
- Update hover preview to include:
  - `similarityEvidence` rows with aria label `打开相似证据 <title> / <label>`
  - `textEvidence` rows with aria label `打开原文证据 <title> / <matchedText>`
- Keep document row click as document-only open.

**Step 4: Run UI tests**

Run:

```bash
rtk npm test -- src/features/shell/RightSidebar.test.tsx src/app/App.test.tsx src/app/App.navigation.test.tsx
```

Expected: PASS after updating old text assertions from `相关主题/原文线索` to `关联文档` where needed.

**Step 5: Commit**

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx src/app/App.test.tsx src/app/App.navigation.test.tsx
git commit -m "feat: show aggregated wiki document evidence"
```

### Task 3: Update PRD and SPEC

**Files:**
- Modify: `docs/requirements/PRD.md`
- Modify: `docs/requirements/specs/right_sidebar_associations_spec.md`
- Modify if needed: `docs/agents/memory/project-lessons.md`

**Step 1: Update SPEC**

Change the feature details from separate `相关主题` and `原文线索` result lists to document-centered `关联文档`.

Keep these decisions:

- Explicit references remain separate.
- Related-topic evidence and original-text evidence are unified under associated document cards.
- Badge counts distinct associated documents.
- No embedding/AI retrieval.
- No manual relation confirmation.

**Step 2: Update PRD**

Make product-level wording say the Wiki tab shows explicit references and associated documents with evidence. Do not add implementation details to PRD.

**Step 3: Run doc diff check**

Run:

```bash
git diff --check docs/requirements/PRD.md docs/requirements/specs/right_sidebar_associations_spec.md docs/agents/memory/project-lessons.md
```

Expected: no whitespace errors.

**Step 4: Commit**

```bash
git add docs/requirements/PRD.md docs/requirements/specs/right_sidebar_associations_spec.md docs/agents/memory/project-lessons.md
git commit -m "docs: update wiki evidence aggregation requirements"
```

### Task 4: Final Verification

**Files:**
- No source changes expected unless verification finds a bug.

**Step 1: Run focused tests**

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebar.test.tsx src/app/App.test.tsx src/app/App.navigation.test.tsx
```

Expected: PASS.

**Step 2: Run full checks**

```bash
rtk npm test
rtk npm run typecheck
rtk npm run build
git diff --check
```

Expected: PASS. Build may retain existing Vite chunk-size warnings.

**Step 3: Commit fixes if needed**

If any verification fix is required:

```bash
git add <changed-files>
git commit -m "fix: stabilize wiki evidence aggregation"
```

## Handoff

Plan complete and saved to `docs/plans/2026-05-15-p0-2-wiki-evidence-aggregation.md`.
