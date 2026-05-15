# P2-4b Search UI Grouping Design

**Date:** 2026-05-07
**Status:** Implemented

## Goal

Build on P2-4a so the left-sidebar workspace search feels like "find the right fragment" rather than a flat mixed list of unrelated hits.

## Scope

- Keep the current workspace search input and backend API.
- Rework the result panel into grouped sections:
  - `命中片段`
  - `相关文档`
  - `快记`
- Keep keyboard navigation and click behavior working across all interactive rows.
- Add stronger per-row affordances so users can tell whether they will:
  - jump to a fragment
  - open an entire document
  - open a quick note

## Chosen Approach

Use a presentation-layer grouping inside `WorkspaceSearch.tsx` instead of changing the search API shape again.

Why:

- P2-4a already gives us enough metadata to differentiate fragment/document/note hits.
- Grouping in the UI keeps backend ranking and tests stable.
- It gives immediate UX value without locking us into a final information architecture too early.

## Interaction Design

- Show a compact summary row above the results list with total hit count and per-kind counts.
- Render separate labeled sections for each non-empty kind group.
- Make fragment rows visually more directional:
  - primary title remains the parent document title
  - preview remains the matched snippet
  - add a small action hint like `跳到命中片段`
- Make document rows read as full-document open actions:
  - add hint `打开整篇文档`
- Make quick-note rows read as note-open actions:
  - add hint `打开这条快记`

## Navigation Model

- Preserve the current flat keyboard navigation order based on the underlying ranked result list.
- Only the visual structure changes; the highlighted item still maps to the original result record.
- Section headers and summary rows are non-interactive.

## Testing

- Update component tests to cover:
  - grouped section rendering
  - count summary rendering
  - fragment action hint rendering
  - existing keyboard navigation behavior still selecting the expected row

## Out of Scope

- grouped-by-document nested snippet trees
- result collapsing / expansion
- match highlighting inside the sidebar panel
- ranking changes
- semantic search UI
