# Share Links Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visible share loading feedback, repeatable public URL/password copy within the app session, and a workspace-level share link manager.

**Architecture:** Keep share state in `useDocumentShare`, expose workspace share listing through the Electron share API, and render the new manager as a collection-style center pane. Public passwords remain hash-only in persistence; only the current renderer session remembers newly generated passwords.

**Tech Stack:** Electron IPC, SQLite share repository, React hooks, Vitest, Testing Library, lucide-react.

---

### Task 1: Share State And Copy Helpers

**Files:**
- Modify: `src/app/useDocumentShare.ts`
- Test: `src/app/useDocumentShare.test.ts`

**Steps:**
1. Add operation-specific status text before async share actions.
2. Store public passwords in memory by `documentId:publicToken`.
3. Add copy helpers for local URL, public URL, and public URL with remembered password.
4. Test that public share creation enters a loading status and that repeated copy can include the remembered password.

### Task 2: Workspace Share API

**Files:**
- Modify: `electron/share/repository.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Test: `electron/share/repository.smoke.test.ts`

**Steps:**
1. Add `listSharesForSpace(spaceId)` to return active local/public shares joined to document titles.
2. Add `disableSharesForSpace(spaceId)` and close running public tunnels for affected documents.
3. Expose `shares:listForSpace` and `shares:disableAllForSpace`.
4. Add fallback mock support for the same API.

### Task 3: Shared Links View

**Files:**
- Create: `src/features/shell/SharedLinksCenterPane.tsx`
- Modify: `src/features/shell/CenterPane.tsx`
- Modify: `src/features/shell/LeftSidebar.tsx`
- Modify: `src/shared/types/workspace.ts`
- Modify: `src/app/useWorkspaceSessionActions.ts`
- Test: `src/features/shell/CenterPane.test.tsx`
- Test: `src/features/shell/LeftSidebar.test.tsx`

**Steps:**
1. Add `shared-links` as a collection view.
2. Add the left sidebar entry under `所有笔记`.
3. Render the shared links view with copy, close, reset, and close-all actions.
4. Test that the entry appears and the view actions call the expected share handlers.

### Task 4: Requirements Update And Verification

**Files:**
- Modify: `docs/requirements/PRD.md`
- Modify: `docs/requirements/specs/local_share_spec.md`

**Steps:**
1. Add requirements for share loading state, shared links manager, one-session password copy, reset public link/password, and close all.
2. Run focused tests.
3. Run `npm run typecheck`.
