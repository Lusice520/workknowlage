# Editor Find Search Design

**Goal:** Replace the current block-level `Cmd/Ctrl+F` prototype with a real in-editor find experience that highlights exact text matches inside BlockNote content and navigates to the active match precisely.

**Current Problem:** The current implementation in `src/shared/editor/SharedBlockNoteSurface.tsx` only searches per block, highlights the whole block, and moves the cursor to the block start. This misses the user expectation for "find in document" behavior in a desktop editor.

## User Experience

- `Cmd/Ctrl+F` opens a compact search bar inside the editor surface.
- Typing a query highlights every match inside the visible editor content, not just the containing block.
- One match is designated as the active match.
- Typing in the search box must not move the document selection or steal focus away from the search box.
- `Enter` and the navigation buttons move between matches.
- `Shift+Enter` moves backward.
- Each navigation step scrolls the active match into the editor viewport center when possible.
- The active match is visually stronger than the other matches.
- `Escape` closes the search UI and removes all temporary search decorations.

## Recommended Architecture

Use a ProseMirror decoration plugin driven from `editor._tiptapEditor.state.doc`.

Why this approach:
- It gives exact character positions for each match.
- It keeps highlight rendering out of persisted document content.
- It remains stable across edits because decorations are mapped through transactions.
- It lets navigation use a real text selection instead of a coarse block jump.

## Search Model

Build a search index from the ProseMirror document, not from serialized BlockNote blocks.

The search model should:
- Walk the ProseMirror document and collect text nodes with document positions.
- Produce a flat ordered list of matches with `from`, `to`, and enough metadata to identify the containing block if needed.
- Support case-insensitive matching.
- Skip empty queries.
- Recompute on search query changes and on editor document changes.

## Highlighting

Use `Decoration.inline` for every match:
- Non-active matches get a subtle highlight class.
- The active match gets a stronger highlight class.

This keeps all highlighting ephemeral and reversible when search closes.

## Navigation

When the active match changes:
- Set the ProseMirror text selection to the match range.
- Scroll the active match DOM range into the visible editor center.

Important UX constraint:
- Search navigation must not leave the caret in the document while the search box is open.
- The search input keeps focus during typing and after explicit next/previous navigation.
- Typing updates the active-candidate highlight only; it does not trigger navigation on its own.

This replaces the current `setTextCursorPosition(blockId, "start")` behavior for search navigation.

## Integration Boundaries

Files expected to change:
- `src/shared/editor/SharedBlockNoteSurface.tsx`
- `src/shared/editor/SharedBlockNoteSurface.css`
- `src/shared/editor/SharedBlockNoteSurfaceSearch.test.tsx`
- Replace `src/shared/editor/documentSearch.ts` with a ProseMirror-position-aware search utility, or supersede it with a more precise module.

## Risks And Guards

- BlockNote uses custom node views, so DOM lookup should anchor from ProseMirror positions, not only `data-id` wrappers.
- Search highlights must not interfere with IME composition.
- Search state must clean up fully on close and on editor instance changes.
- Search typing must not accidentally mutate document content because focus drifted back into the editor.
- Rich tables, attachments, and non-text nodes should remain non-searchable unless they expose text nodes in the ProseMirror document.

## Validation

Minimum acceptance:
- Multiple inline matches inside one block are highlighted separately.
- Navigation lands on the exact match text, not block start.
- Typing in the search box does not move the document selection.
- Explicit next/previous navigation keeps search-box focus.
- All highlights disappear on close.
- Existing editor host and quick note tests still pass.
