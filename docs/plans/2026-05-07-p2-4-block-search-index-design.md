# P2-4 Block Search Index Design

**Date:** 2026-05-07
**Status:** Implemented as P2-4a

## Goal

Add the first practical slice of block-level search so workspace search can return direct block hits and jump users into the matching block inside a document.

## Scope for P2-4a

- Keep the existing document/quick-note search behavior working.
- Add a new block-level search index for persisted document blocks.
- Return block hits through the same search API as a new result kind.
- Let the existing left-sidebar search panel render and open block hits.
- Do not introduce embeddings, workers, or a fully redesigned search UI yet.

## Chosen Approach

Use a dedicated SQLite table plus FTS5 virtual table for block entries, instead of trying to overload the current document-level `workspace_search_entries` table.

Why this shape:
- It keeps the existing document/quick-note search path stable.
- It gives us a clean place to store `document_id`, `block_id`, block title/preview, and a future outline-path field.
- It avoids risky one-shot rewrites of current search ranking behavior.
- It is a direct foundation for P2-5 semantic search later.

## Data Model

Introduce:

- `workspace_block_search_entries`
  - `id`
  - `space_id`
  - `document_id`
  - `block_id`
  - `block_type`
  - `title`
  - `preview`
  - `title_search`
  - `body_search`
  - `updated_at`

- `workspace_block_search` FTS5 virtual table
  - `title_search`
  - `body_search`

Block entries are derived from persisted BlockNote JSON and only include blocks with meaningful searchable text.

## Query Behavior

`searchWorkspace(...)` should return a merged result list containing:

- document hits
- quick-note hits
- block hits

Block hits should carry:

- `kind: 'document-block'`
- `documentId`
- `blockId`
- `title`
- `preview`
- `spaceId`
- `folderId` when available
- `fallbackText` for block-focus recovery

Ranking can stay simple for this slice:
- keep current document/quick-note FTS ranking
- use `bm25(...)` for block hits
- merge and sort by rank with lightweight tie-breaking

## UI / Navigation

The current left sidebar search panel can be reused.

For block hits:
- label them as `片段`
- show the document title as the primary title
- show block snippet in preview
- selecting a block hit opens the document and sets a document focus target to the block

## Mock / Browser Fallback

The browser mock search path must also return block hits so app-level tests stay representative outside Electron.

Implementation note:
- the shipped P2-4a slice also supports legacy seeded section-shaped content and inline `@docMention` text, so current mock data and mixed-format documents can participate in block hits without waiting for a full content migration.

## Out of Scope

- embedding-based ranking
- worker/IPC offloading for search ranking
- redesigned grouped search results
- quick-note block indexing
- highlight-term markup in sidebar results
