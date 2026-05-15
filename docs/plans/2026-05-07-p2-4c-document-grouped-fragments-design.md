# P2-4c Document-Grouped Fragment Search Design

**Date:** 2026-05-07
**Status:** Implemented

## Goal

Make block-level workspace search easier to scan when one document has multiple fragment hits.

## Scope

- Keep the current search backend and flat ranked result list.
- Change only the search panel presentation for fragment hits.
- Group `document-block` hits by parent document inside the `命中片段` section.
- Keep document and quick-note sections unchanged.
- Preserve existing click and keyboard-selection behavior.

## Chosen Approach

Use a document-first card presentation inside `WorkspaceSearch.tsx`.

Each fragment group will show:

- parent document title
- a compact hit-count badge
- one button row per matching fragment preview

This keeps the backend simple while making repeated fragment hits feel intentional instead of noisy.

## Interaction Model

- `命中片段` becomes a set of document cards.
- Each card header is non-interactive and summarizes the parent document.
- Fragment preview rows remain interactive and selectable.
- Keyboard navigation still walks the original ranked interactive rows in order.

## Why This First

- It addresses the biggest usability issue left after P2-4b: repeated fragment rows with the same title are hard to parse.
- It keeps the panel lightweight and avoids a larger search redesign.
- It sets up a clean path for later matched-term highlighting or expandable groups.

## Out of Scope

- collapsing / expanding document groups
- hiding or limiting fragment rows per group
- term highlighting inside previews
- backend ranking changes
