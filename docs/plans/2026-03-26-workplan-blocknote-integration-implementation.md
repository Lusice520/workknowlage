# WorkPlan BlockNote Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保留 `WorkKnowlage` 现有三栏壳体的前提下，接入 `WorkPlan` 的 `BlockNote` 编辑器，以及 `RichTable`、`Alert / Callout`、上传、图片预览与本地只读分享能力，并明确不接协同。

**Architecture:** 复用 `WorkPlan` 编辑器内核，但不搬整页知识库视图。`WorkKnowlage` 继续掌管壳体与本地数据流，`documents.content_json` 升级为 `BlockNote JSON` 真源，上传与分享通过 Electron IPC 和本地 HTTP 服务承接。

**Tech Stack:** React 18, Electron, TypeScript, better-sqlite3, BlockNote, Mantine, TipTap, ProseMirror Tables

---

### Task 1: Install Editor Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Add the new editor dependencies**

Add these packages:

- `@blocknote/core`
- `@blocknote/react`
- `@blocknote/mantine`
- `@mantine/core`
- `@mantine/hooks`
- `@tiptap/core`
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/extension-table`
- `@tiptap/extension-table-row`
- `@tiptap/extension-table-header`
- `@tiptap/extension-table-cell`
- `@tiptap/extension-underline`
- `prosemirror-tables`

**Step 2: Install and refresh the lockfile**

Run: `npm install`

Expected: installation completes and `package-lock.json` is updated.

**Step 3: Run typecheck to catch dependency/type breakage early**

Run: `npm run typecheck`

Expected: PASS

### Task 2: Copy the Editor Core From WorkPlan

**Files:**
- Create: `src/shared/editor/blockNoteSchema.ts`
- Create: `src/shared/editor/editorSchema.tsx`
- Create: `src/shared/editor/SharedBlockNoteSurface.tsx`
- Create: `src/shared/editor/SharedBlockNoteSurface.css`
- Create: `src/shared/editor/KnowledgeBaseImagePreview.tsx`
- Create: `src/shared/editor/constants.ts`
- Create: `src/shared/editor/Alert.tsx`
- Create: `src/shared/editor/Alert.css`
- Create: `src/shared/editor/RichTable.tsx`
- Create: `src/shared/editor/RichTable.css`
- Create: `src/shared/editor/richTablePasteUtils.ts`
- Create: `src/shared/editor/editorBodyFocusUtils.ts`

**Step 1: Copy only the non-collaborative editor files**

Copy the corresponding `WorkPlan` modules into `src/shared/editor/`.

Exclude:

- any `yjs`
- websocket provider code
- collaboration user/presence helpers

**Step 2: Rewrite imports so they are local to WorkKnowlage**

Update all copied files to import from `src/shared/editor/*` instead of `WorkPlan` paths.

**Step 3: Remove or stub collaboration-only references**

Any remaining collab-specific paths or props must be removed.

Expected result:

- `SharedBlockNoteSurface` compiles without `yjs`
- `editorSchema` still exposes `kbSchema`

**Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS or fail only on known pending integration points.

### Task 3: Add BlockNote Content Source Support

**Files:**
- Modify: `src/shared/types/workspace.ts`
- Modify: `src/shared/types/preload.ts`
- Modify: `electron/db/repositories/documents.cjs`
- Test: `src/shared/lib/workKnowlageApi.test.ts`

**Step 1: Extend document typing to carry BlockNote JSON**

Add a durable content field for the editor source of truth, for example:

- `contentJson: string`

Keep existing derived fields like:

- `outline`
- `tags`
- `backlinks`

**Step 2: Return `contentJson` from the documents repository**

Modify `assembleDocument` in `electron/db/repositories/documents.cjs` so the returned document includes:

- raw `content_json`
- derived outline parsed from the blocks

**Step 3: Update document writes to accept `contentJson`**

`documents.update` should support a payload carrying BlockNote JSON and use it as the stored truth.

**Step 4: Keep outline derivation in the main process**

Parse heading blocks from BlockNote JSON and continue generating `outline` server-side.

**Step 5: Update the preload/document API typing**

Add the new editor field to the document update contract.

**Step 6: Run tests**

Run: `npm test`

Expected: PASS after any necessary test fixture updates.

### Task 4: Build the Block Adapter

**Files:**
- Create: `src/shared/editor/blockAdapter.ts`
- Test: `src/shared/editor/blockAdapter.test.ts`

**Step 1: Write failing tests for adapter behavior**

Cover:

- old `sections` -> BlockNote blocks
- BlockNote heading blocks -> derived outline-friendly save model
- attachment / alert / richTable blocks remain preserved

**Step 2: Implement `fromDocumentToInitialBlocks`**

Behavior:

- prefer `contentJson` if present
- otherwise convert legacy `sections`
- otherwise return a minimal empty paragraph doc

**Step 3: Implement `serializeEditorDocument`**

Behavior:

- stringify the current BlockNote document
- do not collapse rich blocks into legacy `sections`

**Step 4: Run targeted tests**

Run: `npm test -- blockAdapter`

Expected: PASS

### Task 5: Replace the Placeholder EditorHost

**Files:**
- Modify: `src/features/editor-host/EditorHost.tsx`
- Modify: `src/features/shell/CenterPane.tsx`
- Test: `src/features/shell/CenterPaneCompact.test.tsx`

**Step 1: Make `EditorHost` accept the active document**

Props should include:

- active document
- save handler
- share handlers
- upload handlers as needed

**Step 2: Initialize BlockNote using the adapter**

Use:

- `kbSchema`
- `useCreateBlockNote`
- initial blocks from `fromDocumentToInitialBlocks`

**Step 3: Render `SharedBlockNoteSurface`**

Wire in:

- editor instance
- image preview
- upload hooks

**Step 4: Replace the static placeholder in `CenterPane`**

The editor should occupy the main content area while preserving the existing shell chrome.

**Step 5: Update the center-pane tests**

Replace the placeholder expectation with a real editor-mounted expectation.

### Task 6: Add Auto-Save For BlockNote Content

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/features/editor-host/useEditorPersistence.ts`
- Test: `src/app/App.test.tsx`

**Step 1: Write failing tests for document persistence**

Cover:

- editing triggers a debounced save
- saved content updates the active document in local state
- switching documents preserves the saved editor state

**Step 2: Add a debounce save hook**

Behavior:

- listen to editor changes
- debounce
- call `api.documents.update(documentId, { contentJson })`

**Step 3: After successful save, update the in-memory document**

Ensure the returned document replaces the old one in `workspaceState.seed.documents`.

**Step 4: Keep right sidebar derived data fresh**

Use the updated repository response so new outline/tag/backlink values immediately flow back into the shell.

**Step 5: Run tests**

Run: `npm test`

Expected: PASS

### Task 7: Add Local Asset Upload Support

**Files:**
- Modify: `src/shared/types/preload.ts`
- Modify: `electron/preload.cjs`
- Modify: `electron/main.cjs`
- Create: `electron/uploads/storage.cjs`
- Test: `src/features/editor-host/EditorHost.test.tsx`

**Step 1: Add the upload API contract**

Expose something like:

- `documents.uploadAssets(documentId, assets)`

Each asset should carry:

- `name`
- `mimeType`
- `bytes`

**Step 2: Implement local file persistence in the main process**

Store files under an app-owned directory such as:

- `userData/uploads/<documentId>/...`

**Step 3: Return stable URLs**

Returned paths must be usable by:

- editor attachments
- preview overlay
- share page rendering

**Step 4: Wire upload into `SharedBlockNoteSurface`**

Replace direct `fetch('/upload')` assumptions with the new preload API.

**Step 5: Add tests**

Cover:

- editor receives returned URLs
- attachment/image blocks get inserted

### Task 8: Add Image Preview

**Files:**
- Modify: `src/features/editor-host/EditorHost.tsx`
- Modify: `src/shared/editor/editorSchema.tsx`
- Modify: `src/shared/editor/KnowledgeBaseImagePreview.tsx`
- Test: `src/features/editor-host/EditorHost.test.tsx`

**Step 1: Keep the attachment block event model**

When an image attachment is clicked, dispatch the preview event with:

- URL
- display name

**Step 2: Mount the preview dialog in `EditorHost`**

Manage:

- open/close state
- zoom in/out/reset

**Step 3: Add tests**

Cover:

- clicking an image attachment opens preview
- preview dialog receives the correct asset URL

### Task 9: Add Local Read-Only Sharing

**Files:**
- Modify: `electron/db/schema.cjs`
- Create: `electron/share/repository.cjs`
- Create: `electron/share/server.cjs`
- Create: `electron/share/render.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/features/editor-host/EditorHost.tsx`

**Step 1: Add the share table**

Create `document_shares` with:

- `id`
- `document_id`
- `token`
- `enabled`
- timestamps

**Step 2: Implement share repository functions**

Add:

- get share
- create share
- regenerate share
- disable share

**Step 3: Start a local read-only server**

Serve:

- `/share/:token`
- `/api/public/share/:token`
- uploaded assets path

**Step 4: Render shared content as static HTML**

Do not mount the live editor in the share page.

Instead:

- parse stored BlockNote JSON
- render a read-only HTML response
- preserve alert and richTable output as much as possible

**Step 5: Add preload APIs and renderer buttons**

Expose share actions through `window.workKnowlage`.

Connect editor toolbar actions for:

- copy/create share link
- regenerate share link
- disable share

### Task 10: Add Export/Read-Only Rendering For Rich Blocks

**Files:**
- Modify: `src/shared/editor/Alert.tsx`
- Modify: `src/shared/editor/RichTable.tsx`
- Modify: `electron/share/render.cjs`
- Test: `src/shared/editor/editorSchema.test.tsx`

**Step 1: Ensure alert blocks render cleanly to external HTML**

Reuse the `toExternalHTML` behavior from `WorkPlan`.

**Step 2: Ensure rich tables can render to static HTML**

If the `RichTable` block stores internal JSON, provide a renderer that turns it into table HTML for sharing.

**Step 3: Add focused tests**

Cover:

- alert export markup
- rich table export markup

### Task 11: Regression Coverage

**Files:**
- Modify: `src/features/shell/CenterPaneCompact.test.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`
- Create: `src/features/editor-host/EditorHost.test.tsx`
- Create: `src/shared/editor/blockAdapter.test.ts`

**Step 1: Add tests for editor mount**

Verify:

- active document renders into the BlockNote editor
- right sidebar still sees updated outline data

**Step 2: Add tests for empty/new documents**

Verify:

- a brand-new document opens with a valid empty editor state

**Step 3: Add tests for upload/share affordances**

Verify:

- share controls render
- image preview event handling works

### Task 12: Final Verification

**Files:**
- No file changes

**Step 1: Run full test suite**

Run: `npm test`

Expected: PASS

**Step 2: Run full typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run production build**

Run: `npm run build`

Expected: PASS

**Step 4: Manual desktop smoke**

Run: `npm run dev`

Verify manually:

- open existing document
- edit text
- insert alert
- insert rich table
- upload image
- preview image
- create share link
- open local read-only share page

