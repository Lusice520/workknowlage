# P0.2 Wiki Evidence Aggregation Design

## Goal

P0.2 upgrades the Wiki tab from separate result lists into a document-centered evidence system. A user should see which documents are related to the current document, why each document appears, and which exact evidence can open the source location.

## Problem

In 0.4.0, `相关主题` and `原文线索` are displayed as separate groups. This is technically clear, but it can confuse the user because both groups answer the same product question: "why is this document related?" Related-topic hover previews already show similar passages, while text evidence shows exact phrase or key-sentence matches. They should be unified as evidence under one target document when they point to the same document.

## Product Model

The Wiki tab keeps `显式引用` as its own group because it reflects explicit user-created document links and backlinks.

The remaining derived relation results become `关联文档`. Each related document card can carry one or more evidence types:

- `主题相似`: generated from semantic-ish local similarity matches and current hover preview data.
- `局部相似`: generated from focused outline similar blocks.
- `原文命中`: generated from short exact phrases, title-like phrases, or key sentences.

The Wiki tab badge counts distinct associated documents, not evidence rows. Evidence counts are shown inside each card, such as `2 处相似` or `1 条线索`.

## Interaction

The user opens Wiki and sees:

```text
显式引用
  架构设计

关联文档
  问题清单宣贯稿内容
    主题相似 / 原文命中
    2 处相似 · 1 条线索
```

Clicking the document row opens the document. Hovering or expanding the row shows evidence details. Clicking an evidence detail opens the target block with `fallbackText` so the editor can focus or highlight the matching phrase.

For the first P0.2 implementation, hover can remain the detail surface to avoid introducing a new disclosure state. The hover preview should show both similarity evidence and original-text evidence for that document.

## Data Shape

Add a derived aggregation layer to `sidebarAssociations`:

```ts
interface SidebarAssociatedDocument {
  documentId: string;
  title: string;
  folderPath: string;
  score: number;
  badges: Array<'主题相似' | '局部相似' | '原文命中'>;
  similarityEvidence: SidebarAssociatedDocumentEvidence[];
  textEvidence: SidebarTextEvidence[];
}

interface SidebarAssociatedDocumentEvidence {
  blockId: string;
  label: string;
  snippet: string;
  searchText: string;
  reason: string;
  score: number;
}
```

Keep the existing `relatedDocuments`, `similarBlocks`, and `textEvidence` arrays during P0.2 so existing tests and internal callers remain stable. `associatedDocuments` becomes the preferred UI source for the Wiki derived relation group.

## Component Changes

`RightSidebar` should render:

- `显式引用`: unchanged.
- `关联文档`: use `associationState.associatedDocuments` when present.
- Fallback: if old state has no `associatedDocuments`, derive a display-only aggregation in `RightSidebar` from existing arrays.

This keeps the UI resilient during migration and avoids making `RightSidebar` run expensive derivation.

The old `原文线索` group should disappear once `associatedDocuments` exists. Empty state changes from two separate empty states to one derived-relation empty state: `暂未发现关联文档`.

## Sorting

Document cards sort by:

1. Explicit derived score from semantic related documents.
2. Presence of text evidence.
3. Evidence count.
4. Title locale order.

Do not lower semantic thresholds. Text evidence boosts discoverability inside the card, not the semantic related-topic gate.

## Error Handling

- If a document has evidence but no blockId, open the document only.
- If a block is missing, pass `fallbackText` and let the editor focus recovery handle it.
- If aggregation input is empty, show the existing empty states.

## Tests

Add tests at two layers:

- `sidebarAssociations.test.ts`: a document that is both semantically related and exact-text matched appears once in `associatedDocuments`, with both evidence types.
- `RightSidebar.test.tsx`: Wiki renders one aggregated card instead of duplicate `相关主题` and `原文线索` rows; hover/detail includes both similarity and original text evidence; evidence click opens the matched block.

## Non-Goals

- No embedding or AI retrieval.
- No manual "confirm relation" workflow.
- No persistent user state for expanded cards.
- No cross-workspace associations.
