# Storage Status Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move runtime storage status out of the top app banner and into a settings panel opened from the left sidebar.

**Architecture:** Remove the top-level storage banner from `AppShell` and pass the existing storage/runtime props down into `LeftSidebar`. Add a lightweight sidebar settings panel that toggles from the existing settings button and renders the storage diagnostics on demand.

**Tech Stack:** React 18, TypeScript, Vitest

---

### Task 1: Write failing app-level behavior tests

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/App.test.tsx`

**Step 1: Write the failing test**

Update the storage tests to expect:
- the top storage banner is not rendered
- storage details appear only after clicking the settings button

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the banner still exists and settings does not reveal storage info.

**Step 3: Write minimal implementation**

Remove the top banner and add a settings panel in the left sidebar.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS

### Task 2: Wire settings data into the sidebar

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`

**Step 1: Keep tests red until wiring is complete**

Run: `npm test -- src/app/App.test.tsx`

**Step 2: Write minimal implementation**

- Pass `runtimeStatus`, `storageInfo`, `persistenceFeedback`, and `lastPersistedAt` into `LeftSidebar`
- Add a toggled settings panel with storage diagnostics
- Remove unused banner-only state from `AppShell`

**Step 3: Run test to verify it passes**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS

### Task 3: Final verification

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/AppShell.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.tsx`

**Step 1: Run targeted tests**

Run: `npm test -- src/app/App.test.tsx`

**Step 2: Run production build**

Run: `npm run build`
