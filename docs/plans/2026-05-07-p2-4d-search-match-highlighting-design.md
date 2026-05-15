# P2-4d Search Match Highlighting Design

**Date:** 2026-05-07
**Status:** Implemented

## Goal

Make workspace search results easier to scan by visually emphasizing the actual matched query terms inside result previews.

## Scope

- Keep the current backend search API and preview strings unchanged.
- Add UI-side highlighting inside the left-sidebar search panel only.
- Apply highlighting to:
  - fragment previews
  - document previews
  - quick-note previews
- Preserve current grouping, click behavior, and keyboard navigation.

## Chosen Approach

Use presentation-layer text splitting in `WorkspaceSearch.tsx`.

Why:

- No schema or backend changes are needed.
- We can highlight both grouped fragment rows and normal result rows with the same helper.
- It keeps this slice small and focused on readability.

## Matching Rules

- Split the active query on whitespace into visible query parts.
- Highlight case-insensitive matches for each non-empty part.
- If parts overlap, prefer the earlier and longer match span to avoid noisy nested markup.

## Visual Treatment

- Use a compact inline highlight treatment that still fits the existing lightweight sidebar style.
- The emphasized text should stand out without looking like editor-level search mode.

## Out of Scope

- backend-generated highlight spans
- snippet regeneration
- fuzzy highlight ranges
- highlight counts or per-token chips
