# WorkKnowlage Light Shell Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前 `WorkKnowlage` 三栏壳子改成更轻、更克制的一屏桌面工作台，彻底去掉滚动条，并通过更合理的排版、密度与层级降低笨重感。

**Architecture:** 保持现有 `AppShell + LeftSidebar + CenterPane + RightSidebar + EditorHost` 结构不变，只重做视觉系统、组件高度预算和 mock 文稿密度。通过减少卡片层级、收紧字阶和控制内容长度来实现一屏内稳定布局，而不是用隐藏滚动条掩盖超高内容。

**Tech Stack:** React 18, TypeScript, TailwindCSS, Vitest, Testing Library

---

### Task 1: Add No-Scroll And One-Screen Layout Tests

**Files:**
- Create: `src/features/shell/AppShellLayout.test.tsx`
- Modify: `src/app/App.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../../app/App';

test('renders a no-scroll shell with fixed layout regions', () => {
  render(<App />);

  expect(screen.getByTestId('app-shell')).toHaveAttribute('data-scroll-mode', 'locked');
  expect(screen.getByTestId('center-pane')).toHaveAttribute('data-pane-density', 'compact');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/AppShellLayout.test.tsx`
Expected: FAIL because these compact layout markers do not exist yet.

**Step 3: Write minimal implementation**

- Add stable `data-testid` / `data-*` markers for the locked shell and compact center pane
- Keep implementation minimal; do not start the full visual refactor in this step

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/AppShellLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/AppShellLayout.test.tsx src/app/App.tsx
git commit -m "test: add one-screen shell layout coverage"
```

### Task 2: Refactor Shell Frame And Global Tokens

**Files:**
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/styles/globals.css`
- Test: `src/features/shell/AppShellLayout.test.tsx`

**Step 1: Write the failing test**

Extend the shell test with expectations for the lighter frame:

```tsx
expect(screen.getByTestId('app-shell')).toHaveAttribute('data-shell-style', 'lightweight');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/AppShellLayout.test.tsx`
Expected: FAIL because the lightweight shell marker does not exist yet.

**Step 3: Write minimal implementation**

- Lock the page to one-screen height
- Remove page scrolling
- Reduce shell gaps and column widths
- Flatten the global surface system:
  - smaller radii
  - lighter borders
  - shallower shadows
  - calmer background

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/AppShellLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/AppShell.tsx src/styles/globals.css src/features/shell/AppShellLayout.test.tsx
git commit -m "feat: slim down app shell frame and tokens"
```

### Task 3: Compress The Left Sidebar And Remove The Heavy Calendar

**Files:**
- Modify: `src/features/shell/LeftSidebar.tsx`
- Modify: `src/features/shell/LeftSidebar.test.tsx`

**Step 1: Write the failing test**

Add a test that confirms the lightweight footer module replaces the large calendar card:

```tsx
expect(screen.getByText('今日聚焦')).toBeInTheDocument();
expect(screen.queryByText('2024年3月')).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`
Expected: FAIL because the old large calendar is still present.

**Step 3: Write minimal implementation**

- Reduce sidebar visual weight
- Tighten tree item padding and active states
- Replace the large calendar block with a compact status module
- Keep tree content within one-screen height budget without scrollbars

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/LeftSidebar.tsx src/features/shell/LeftSidebar.test.tsx
git commit -m "feat: compact left sidebar and footer module"
```

### Task 4: Rebuild The Center Pane For Compact Editorial Density

**Files:**
- Modify: `src/features/shell/CenterPane.tsx`
- Modify: `src/features/editor-host/EditorHost.tsx`
- Create: `src/features/shell/CenterPaneCompact.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../../app/App';

test('renders the compact one-screen article structure', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  expect(screen.getByText('第二阶段接入编辑器')).toBeInTheDocument();
  expect(screen.queryByText('毫秒级的全局模糊搜索')).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/CenterPaneCompact.test.tsx`
Expected: FAIL because the center pane still renders the old long-form content.

**Step 3: Write minimal implementation**

- Reduce title size and metadata prominence
- Shorten the mock content to a one-screen summary
- Keep only:
  - 2 paragraphs
  - 1 quote
  - 1 compact dual-card media row
  - 1 low-profile `EditorHost`
- Remove center pane scrolling

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/CenterPaneCompact.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/CenterPane.tsx src/features/editor-host/EditorHost.tsx src/features/shell/CenterPaneCompact.test.tsx
git commit -m "feat: compress center pane into one-screen editorial view"
```

### Task 5: Slim The Right Sidebar And Inline Share Actions

**Files:**
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`

**Step 1: Write the failing test**

Add expectations for a compact action row instead of a large share card:

```tsx
expect(screen.getByText('快速操作')).toBeInTheDocument();
expect(screen.queryByText('第一阶段先保留入口，第二阶段接局域网只读分享和导出能力。')).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`
Expected: FAIL because the old large share/export card still exists.

**Step 3: Write minimal implementation**

- Tighten module spacing
- Reduce module heading weight
- Turn share/export into a compact utility row
- Keep the right sidebar within the one-screen height budget

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx
git commit -m "feat: compact right sidebar utility blocks"
```

### Task 6: Tighten Typography Scale Across The Shell

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/features/shell/LeftSidebar.tsx`
- Modify: `src/features/shell/CenterPane.tsx`
- Modify: `src/features/shell/RightSidebar.tsx`
- Test: `src/features/shell/AppShellLayout.test.tsx`

**Step 1: Write the failing test**

Add a shell-level marker for the new typography system:

```tsx
expect(screen.getByTestId('app-shell')).toHaveAttribute('data-typography', 'editorial-compact');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/AppShellLayout.test.tsx`
Expected: FAIL because the typography marker is not present yet.

**Step 3: Write minimal implementation**

- Introduce a compact type scale via CSS variables or stable classes
- Lower side-panel hierarchy
- Reduce title and body sizes to match one-screen density
- Keep the middle column as the only strong focal point

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/AppShellLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/styles/globals.css src/features/shell/AppShell.tsx src/features/shell/LeftSidebar.tsx src/features/shell/CenterPane.tsx src/features/shell/RightSidebar.tsx src/features/shell/AppShellLayout.test.tsx
git commit -m "feat: tighten workknowlage typography scale"
```

### Task 7: Final Verification And Runtime Check

**Files:**
- Modify: `README.md`

**Step 1: Write the failing verification expectation**

Document the new compact shell intent:

```md
- The desktop shell is designed to fit in one screen without scrollbars.
- `npm run dev` starts the compact Electron shell on port 5175.
```

**Step 2: Run verification to confirm remaining gaps**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: FAIL if any of the compact-shell changes still break tests, typing, or build output.

**Step 3: Write minimal implementation**

- Update README startup notes
- Fix any remaining regressions from the redesign
- Run the app and confirm the shell comes up on port `5175`

**Step 4: Run verification to confirm it passes**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Expected:

- tests PASS
- typecheck PASS
- build PASS
- dev mode launches Vite on `127.0.0.1:5175` and starts Electron without runtime errors

**Step 5: Commit**

```bash
git add README.md
git commit -m "chore: verify compact shell redesign"
```

Plan complete and saved to `docs/plans/2026-03-25-workknowlage-light-shell-redesign-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints
