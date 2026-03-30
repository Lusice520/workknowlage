# Editor Typography And Sidebar Root Docs Design

**Context**

The user wants four UX and behavior fixes to land together:

- Only the editor body should change, not the document header title in the center pane.
- Body copy should use a 14px base size.
- Title-like content inside the editor body should have more comfortable line-height and more space before the following body content.
- Bullet list markers should no longer carry the heavier bold look introduced earlier.
- Sidebar tree actions should stay hidden until row hover or keyboard focus.
- Documents and folders both need visible delete actions.
- Documents must be creatable at the root level and movable back to the root level.

**Decision**

Use the real root-directory model instead of a hidden synthetic folder.

Why:

- The current product language already exposes “root” behavior in the sidebar.
- A fake folder would leak into breadcrumbs, reload logic, and drag-drop edge cases.
- The codebase already models folders with nullable `parentId`; extending documents to nullable `folderId` keeps the data model internally consistent.

**Editor Body Typography**

Keep the page-level document header unchanged in `CenterPane`. Apply typography changes only inside the BlockNote surface CSS:

- Change the editor body token from 15px to 14px.
- Increase heading line-height for all editor heading blocks through the shared heading selector rather than per-screen overrides.
- Increase heading-to-body spacing using the existing heading gap token.
- Remove the bold weight from unordered-list marker styling while keeping the marker alignment and color treatment.

This keeps the change centralized in `SharedBlockNoteSurface.css` and avoids touching non-editor chrome.

**Sidebar Tree Interaction**

Sidebar row actions should be visible only when the row is hovered or focus is within the row:

- Folder rows: rename, new document, new folder, delete.
- Document rows: rename, delete.

The buttons should remain keyboard reachable, so the hidden state must be implemented with opacity/pointer-state tied to `group-hover` and `group-focus-within`, not conditional rendering alone.

Delete should use a lightweight confirmation prompt before dispatching the existing delete callbacks.

**Root-Level Documents**

Documents should be allowed to live directly under a space with `folderId: null`.

Behavior changes:

- Root toolbar “新建文件” is always enabled.
- Root area renders root-level documents above root folders.
- Dragging a document onto the root section moves it to `folderId: null`.
- Breadcrumb fallback for root-level documents becomes “根目录”.
- Workspace load must fetch both root-level documents and folder documents.
- Search results for root-level documents should omit `folderId`, allowing open-by-id without forced folder expansion.

**Persistence And Compatibility**

The browser fallback API and the Electron SQLite repository must both support nullable document folders.

Electron needs a lightweight schema migration because existing databases currently define `documents.folder_id` as `NOT NULL`. The migration should recreate the table with nullable `folder_id`, preserve rows, and then rebuild the search index as part of normal startup.

**Testing Strategy**

Add tests at three layers:

- CSS token test for editor body size, heading spacing, and lighter bullet marker styling.
- Sidebar behavior tests for hover/focus action reveal, delete actions, root document creation, and root drop behavior.
- Workspace/API tests for loading root documents and moving documents to root.
- Electron smoke test coverage for persisted root-level document behavior if needed at the repository boundary.
