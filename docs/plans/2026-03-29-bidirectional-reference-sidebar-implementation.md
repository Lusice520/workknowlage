# Bidirectional Reference Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the right sidebar from one-way backlinks into a bidirectional reference panel that shows both outgoing mentions and incoming backlinks.

**Architecture:** Keep incoming references backed by persisted `backlinks`, derive outgoing references directly from the active document's `contentJson`, and render the two directions as separate clickable groups in the right sidebar. Reuse the existing document-open callback for both directions so no new navigation primitive is introduced.

**Tech Stack:** React, TypeScript, Vitest, BlockNote mention schema already shipped

---

### Task 1: Add the right-sidebar tests first

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/RightSidebar.test.tsx`

Add failing coverage for:

- rendering both `提及文档` and `被提及于`
- showing outgoing mention cards derived from current document content
- keeping incoming backlink cards under their own section
- clicking outgoing cards opens the mentioned target document
- showing a unified empty state when both groups are empty

### Task 2: Add outgoing mention parsing helper

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/outgoingMentions.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/types/workspace.ts`

Implement:

- a lightweight `OutgoingMentionRecord`
- `extractOutgoingMentions(contentJson, sourceDocumentId)`
- dedupe by target document id
- ignore self-mentions

### Task 3: Render bidirectional groups in the right sidebar

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/RightSidebar.tsx`

Implement:

- `提及文档` group with outgoing icon
- `被提及于` group with incoming icon
- separate empty-state handling
- unified “no references yet” empty state when both sides are empty
- click handling for outgoing and incoming records

### Task 4: Wire opening behavior through existing app flow

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.tsx`

Implement:

- keep a single document-open callback
- pass it into the sidebar for both outgoing and incoming cards
- avoid new navigation state

### Task 5: Run focused and full verification

Run:

- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/features/shell/RightSidebar.test.tsx`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test -- src/app/App.test.tsx`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm test`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run typecheck`
- `cd /Volumes/WorkSpace/WorkKnowlage/WorkKnowlage && npm run build`
