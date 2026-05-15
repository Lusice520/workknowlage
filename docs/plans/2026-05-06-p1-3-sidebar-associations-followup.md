# P1-3 Sidebar Associations Follow-Up

**Date:** 2026-05-06
**Status:** Planned follow-up

## Goal

Move sidebar association derivation out of right-sidebar rendering and behind a data-layer adapter/cache so the UI can consume prepared associations instead of recomputing workspace relationships in the component tree.

## Why This Is Not P1-1

P1-1 is about app/session/api boundaries. The current association work is useful, but it belongs to a later product/data phase because it changes how related content is computed, cached, invalidated, and eventually surfaced across the workspace.

## Proposed Shape

- Keep `RightSidebar` focused on rendering prepared outline, backlinks, tags, and association view models.
- Move `deriveSidebarAssociations` orchestration behind a shared data adapter, app hook, or cached selector.
- Define invalidation around active document, document content changes, tag changes, and workspace tree changes.
- Add tests for cache correctness and stale-association prevention before wiring the UI to the new layer.

## Acceptance Criteria

- `RightSidebar` no longer calls association derivation directly during render.
- Association derivation has focused unit tests independent of sidebar rendering tests.
- Sidebar tests assert rendering behavior from prepared data, not full workspace recomputation.
- The app remains responsive when a space has many documents and tags.
