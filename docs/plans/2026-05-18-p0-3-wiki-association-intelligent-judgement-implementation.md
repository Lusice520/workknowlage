# P0.3 Wiki Association Recommendation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the right-sidebar Wiki recommendation experience without requiring users to manually confirm relationships, and prepare a clean extension point for future LLM-based relationship judgement.

**Architecture:** Keep deterministic association derivation in `src/shared/lib/sidebarAssociations.ts`, use `src/app/useSidebarAssociations.ts` as the app-level orchestration boundary, and keep `RightSidebar` presentational. P0.3 adds recommendation reasons, full evidence detail, and optional lightweight feedback; LLM judgement remains a separate service boundary and is not implemented until model configuration and data permissions are defined.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind utilities, lucide-react.

---

## Task 1: Add Recommendation Reason View Model

**Files:**
- Modify: `src/shared/lib/sidebarAssociations.ts`
- Modify: `src/shared/lib/sidebarAssociations.test.ts`

**Steps:**

1. Add fields to `SidebarAssociatedDocument`:
   - `recommendationReason: string`
   - `evidenceStrength: 'high' | 'medium' | 'low'`
2. Derive reason from evidence:
   - Has text evidence: prefer `命中关键句` or `${count} 条原文线索`
   - Has local similarity: `局部内容相似`
   - Has topic similarity only: `主题相似`
3. Keep evidence badges unchanged; reason is explanatory copy, not a new evidence type.
4. Add tests for:
   - original text evidence reason
   - mixed similarity + text evidence reason
   - topic-only reason
5. Run:

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts
```

6. Commit:

```bash
git add src/shared/lib/sidebarAssociations.ts src/shared/lib/sidebarAssociations.test.ts
git commit -m "feat: explain wiki association recommendations"
```

## Task 2: Add Full Evidence Detail View

**Files:**
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`

**Steps:**

1. Add `detailAssociatedDocumentId` local state to `RightSidebar`.
2. Add a compact `查看全部线索 <title>` icon button to associated document cards.
3. Render a right-sidebar detail view when `detailAssociatedDocumentId` is set:
   - Back button
   - Target document title
   - Recommendation reason
   - `原文命中` section
   - `局部相似 / 主题相似` section
4. Reuse existing evidence click behavior:
   - `blockId`
   - `fallbackText`
   - `highlightQuery`
5. Do not use modal overlays for this detail; keep it inside the right sidebar.
6. Add tests for:
   - opening detail from a card
   - rendering text evidence and similarity evidence
   - clicking original evidence with `highlightQuery`
   - returning to list
7. Run:

```bash
rtk npm test -- src/features/shell/RightSidebar.test.tsx
```

8. Commit:

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx
git commit -m "feat: show full wiki association evidence"
```

## Task 3: Add Optional Lightweight Feedback

**Files:**
- Create: `src/app/useWikiRecommendationFeedback.ts`
- Create: `src/app/useWikiRecommendationFeedback.test.tsx`
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`

**Steps:**

1. Add a hook that stores feedback in component state first:
   - key: `sourceDocumentId + targetDocumentId`
   - value: `useful | less_like_this`
2. Expose callbacks:
   - `markUseful(targetDocumentId)`
   - `showLessLikeThis(targetDocumentId)`
3. Pass feedback state to `RightSidebar`.
4. Add small icon actions:
   - `这个推荐有用 <title>`
   - `少展示类似推荐 <title>`
5. Do not require feedback before opening a document.
6. Apply feedback only to display order in the current session:
   - `useful` can float upward
   - `less_like_this` can move downward
   - explicit references are unaffected
7. Add tests for:
   - feedback callback fires
   - less-like-this item moves down or receives lower priority
   - feedback actions are optional
8. Run:

```bash
rtk npm test -- src/app/useWikiRecommendationFeedback.test.tsx src/features/shell/RightSidebar.test.tsx
```

9. Commit:

```bash
git add src/app/useWikiRecommendationFeedback.ts src/app/useWikiRecommendationFeedback.test.tsx src/features/shell/AppShell.tsx src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx
git commit -m "feat: add lightweight wiki recommendation feedback"
```

## Task 4: Add LLM Judgement Boundary Types Only

**Files:**
- Create: `src/shared/lib/wikiRelationJudgement.ts`
- Create: `src/shared/lib/wikiRelationJudgement.test.ts`

**Steps:**

1. Add pure TypeScript types for future model judgement:
   - `WikiRelationCandidate`
   - `WikiRelationEvidence`
   - `WikiRelationJudgementResult`
   - `WikiRelationType`
2. Add a pure helper `buildWikiRelationCandidate` that takes source document, target document, and evidence snippets.
3. Do not call any model yet.
4. Do not add API keys, provider config, or network calls.
5. Add tests proving the candidate payload:
   - includes source / target IDs
   - includes only bounded evidence snippets
   - preserves evidence type
6. Run:

```bash
rtk npm test -- src/shared/lib/wikiRelationJudgement.test.ts
```

7. Commit:

```bash
git add src/shared/lib/wikiRelationJudgement.ts src/shared/lib/wikiRelationJudgement.test.ts
git commit -m "feat: prepare wiki relation judgement boundary"
```

## Task 5: Verification

**Files:**
- Create: `docs/plans/2026-05-18-p0-3-wiki-association-intelligent-judgement-verification.md`

**Steps:**

1. Run focused tests:

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts src/features/shell/RightSidebar.test.tsx src/app/useWikiRecommendationFeedback.test.tsx src/shared/lib/wikiRelationJudgement.test.ts
```

2. Run full tests:

```bash
rtk npm test
```

3. Run typecheck:

```bash
rtk npm run typecheck
```

4. Manual smoke:
   - Open `测试文档`
   - Verify Wiki recommendation still shows related documents
   - Verify cards explain why they are recommended
   - Open all evidence detail
   - Click original evidence and confirm highlight
   - Use feedback without blocking navigation

5. Write verification note and commit:

```bash
git add docs/plans/2026-05-18-p0-3-wiki-association-intelligent-judgement-verification.md
git commit -m "docs: verify wiki association recommendation"
```

## Non-Goals

1. Do not require users to manually confirm every recommended relationship.
2. Do not implement fixed / ignored / manual association persistence in this slice.
3. Do not call a remote model before model configuration and data permissions are designed.
4. Do not build graph view yet.
5. Do not change semantic similarity thresholds as a substitute for relationship judgement.
