# Sidebar Calendar Localization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Localize the sidebar quick-note calendar to Chinese and keep its height stable across month switches.

**Architecture:** Keep the layout fix in the shared `quickNotes` calendar helper so the UI always receives six weeks of data. Update the sidebar panel copy to Chinese and prove the behavior with focused helper tests plus the existing sidebar integration test.

**Tech Stack:** React 18, TypeScript, Vitest

---

### Task 1: Add failing calendar helper tests

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/quickNotes.test.ts`

**Step 1: Write the failing test**

Add tests that expect:
- `getMonthLabel(new Date(2026, 2, 1))` to return `2026年3月`
- `buildCalendarWeeks(new Date(2026, 3, 1))` to always return 6 weeks

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/quickNotes.test.ts`

Expected: FAIL because month formatting is English and April 2026 returns only 5 weeks.

**Step 3: Write minimal implementation**

Update the helper to return Chinese month labels and a fixed 42-cell calendar grid.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/quickNotes.test.ts`

Expected: PASS

### Task 2: Add failing sidebar localization assertions

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`

**Step 1: Write the failing test**

Update the month-switching sidebar test to expect Chinese month labels and Chinese weekday headers inside the quick-note panel.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

Expected: FAIL because the current sidebar still renders English labels.

**Step 3: Write minimal implementation**

Update `SidebarQuickNotePanel.tsx` to use Chinese labels and the fixed six-week helper output.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

Expected: PASS

### Task 3: Final verification

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/lib/quickNotes.ts`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SidebarQuickNotePanel.tsx`

**Step 1: Run targeted tests**

Run: `npm test -- src/shared/lib/quickNotes.test.ts src/features/shell/LeftSidebar.test.tsx`

**Step 2: Run type checks**

Run: `npm run typecheck`

**Step 3: Run production build**

Run: `npm run build`
