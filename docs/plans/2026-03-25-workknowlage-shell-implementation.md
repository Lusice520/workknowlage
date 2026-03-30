# WorkKnowlage Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `WorkKnowlage` 在 `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage` 内完成第一阶段可运行桌面骨架，包含 `Electron + React + Vite + TailwindCSS`、接近参考图气质的三栏主界面，以及为后续 SQLite 与 `WorkPlan` 编辑器复用预留稳定接入口。

**Architecture:** 使用 `Vite + React + TypeScript` 承载渲染进程，使用 `Electron main/preload` 提供桌面壳和未来 IPC 桥接。第一阶段只用 mock 数据驱动三栏联动，提前固定 `EditorHost`、领域类型和 preload API 形状，避免第二阶段接入本地数据与编辑器时重写页面结构。

**Tech Stack:** Electron, React 18, TypeScript, Vite, TailwindCSS, Vitest, React Testing Library, Lucide React

---

### Task 1: Bootstrap The Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/ipc/channels.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/styles/globals.css`
- Create: `.gitignore`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the WorkKnowlage shell title', () => {
  render(<App />);
  expect(screen.getByText('个人工作空间')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/App.test.tsx`
Expected: FAIL because the React app and test runner are not wired yet.

**Step 3: Write minimal implementation**

- Scaffold the existing directory with a React + TypeScript Vite app
- Add Electron runtime dependencies and dev scripts
- Add a minimal `App.tsx` that renders `个人工作空间`
- Wire `src/main.tsx` to mount the app
- Add a minimal `globals.css` so the app renders without broken layout

Minimal `App.tsx` target:

```tsx
export default function App() {
  return <div>个人工作空间</div>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html .gitignore electron src
git commit -m "chore: bootstrap workknowlage desktop shell"
```

### Task 2: Define Domain Types, Mock Data, And Selection Logic

**Files:**
- Create: `src/shared/types/workspace.ts`
- Create: `src/shared/mocks/workspace.ts`
- Create: `src/shared/lib/workspaceSelectors.ts`
- Create: `src/shared/lib/workspaceSelectors.test.ts`
- Modify: `src/app/App.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { createInitialWorkspaceState, getActiveDocument } from './workspaceSelectors';

describe('workspaceSelectors', () => {
  test('returns the first document as active by default', () => {
    const state = createInitialWorkspaceState();
    const activeDocument = getActiveDocument(state);

    expect(activeDocument?.title).toBe('创意草案');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workspaceSelectors.test.ts`
Expected: FAIL because selectors and mock data do not exist yet.

**Step 3: Write minimal implementation**

- Add types for `Space`, `FolderNode`, `DocumentRecord`, `OutlineItem`, `TagRecord`, `BacklinkRecord`
- Add a mock workspace dataset that reflects the approved reference layout
- Add selectors that derive:
  - active space
  - active document
  - active document tree
  - right-rail data for the selected document
- Update `App.tsx` to build initial app state from the selectors

Example state shape:

```ts
export interface WorkspaceState {
  spaces: Space[];
  activeSpaceId: string;
  activeDocumentId: string;
  expandedFolderIds: string[];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workspaceSelectors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types/workspace.ts src/shared/mocks/workspace.ts src/shared/lib/workspaceSelectors.ts src/shared/lib/workspaceSelectors.test.ts src/app/App.tsx
git commit -m "feat: add workspace mock state and selectors"
```

### Task 3: Build The Left Sidebar

**Files:**
- Create: `src/features/shell/LeftSidebar.tsx`
- Create: `src/features/shell/LeftSidebar.test.tsx`
- Create: `src/features/shell/TreeItem.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/globals.css`

**Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../app/App';

test('switches the active document when a tree item is clicked', () => {
  render(<App />);

  fireEvent.click(screen.getByText('架构设计'));

  expect(screen.getByRole('heading', { name: '架构设计' })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`
Expected: FAIL because the left sidebar and click handling are not implemented.

**Step 3: Write minimal implementation**

- Render the left sidebar with:
  - workspace switch card
  - primary create button
  - quick links
  - nested tree
  - footer tools and calendar card
- Support expand/collapse for folders
- Support document selection and active styling
- Use mock content similar to the reference screenshot

Minimal prop contract:

```tsx
interface LeftSidebarProps {
  state: WorkspaceState;
  onSelectDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/LeftSidebar.tsx src/features/shell/LeftSidebar.test.tsx src/features/shell/TreeItem.tsx src/app/App.tsx src/styles/globals.css
git commit -m "feat: build workknowlage left sidebar"
```

### Task 4: Build The Center Pane And Editor Host Placeholder

**Files:**
- Create: `src/features/shell/CenterPane.tsx`
- Create: `src/features/shell/CenterPane.test.tsx`
- Create: `src/features/editor-host/EditorHost.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/globals.css`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../../app/App';

test('renders the active document title, metadata, and editor host placeholder', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  expect(screen.getByText('2024年3月15日')).toBeInTheDocument();
  expect(screen.getByText('EditorHost Placeholder')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/CenterPane.test.tsx`
Expected: FAIL because the center pane has not been implemented.

**Step 3: Write minimal implementation**

- Render breadcrumbs, top actions, title, metadata chips, and body content
- Add a static article-like mock document body that matches the visual rhythm of the reference
- Create `EditorHost` as a dedicated placeholder component with a clear boundary for future `WorkPlan` editor reuse
- Keep the body scroll in the center pane only

Minimal `EditorHost` target:

```tsx
export function EditorHost() {
  return <div>EditorHost Placeholder</div>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/CenterPane.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/CenterPane.tsx src/features/shell/CenterPane.test.tsx src/features/editor-host/EditorHost.tsx src/app/App.tsx src/styles/globals.css
git commit -m "feat: build center pane and editor host placeholder"
```

### Task 5: Build The Right Sidebar

**Files:**
- Create: `src/features/shell/RightSidebar.tsx`
- Create: `src/features/shell/RightSidebar.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/globals.css`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../../app/App';

test('renders outline, tags, and backlinks for the active document', () => {
  render(<App />);

  expect(screen.getByText('文档大纲')).toBeInTheDocument();
  expect(screen.getByText('核心目标')).toBeInTheDocument();
  expect(screen.getByText('#产品')).toBeInTheDocument();
  expect(screen.getByText('2024年路线图')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`
Expected: FAIL because the right rail is not implemented.

**Step 3: Write minimal implementation**

- Render the right rail cards for:
  - outline
  - tags
  - backlinks
  - share/export placeholder
- Keep the panel visually lighter than the center pane
- Use the current document’s derived mock data

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/RightSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx src/app/App.tsx src/styles/globals.css
git commit -m "feat: build right sidebar"
```

### Task 6: Wire The Full App Shell Layout And Theme Tokens

**Files:**
- Create: `src/features/shell/AppShell.tsx`
- Create: `src/features/shell/AppShell.test.tsx`
- Create: `src/styles/theme.css`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/globals.css`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import App from '../../app/App';

test('renders left, center, and right shell regions', () => {
  render(<App />);

  expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();
  expect(screen.getByTestId('center-pane')).toBeInTheDocument();
  expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/AppShell.test.tsx`
Expected: FAIL because the composed shell layout does not exist yet.

**Step 3: Write minimal implementation**

- Introduce `AppShell` as the top-level layout component
- Centralize CSS variables for colors, borders, radii, shadows, and spacing in `theme.css`
- Use Tailwind utility classes for structure and local styling
- Use CSS variables for the exact visual system that needs to survive the editor integration phase

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/AppShell.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/shell/AppShell.tsx src/features/shell/AppShell.test.tsx src/styles/theme.css src/styles/globals.css src/app/App.tsx
git commit -m "feat: compose workknowlage shell layout"
```

### Task 7: Expose The Preload API And Verify Desktop Build Paths

**Files:**
- Create: `src/shared/types/preload.ts`
- Create: `src/shared/lib/workKnowlageApi.ts`
- Create: `src/shared/lib/workKnowlageApi.test.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `src/app/App.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { createFallbackDesktopApi } from './workKnowlageApi';

describe('workKnowlageApi', () => {
  test('exposes list spaces and get document methods', () => {
    const api = createFallbackDesktopApi();

    expect(typeof api.spaces.list).toBe('function');
    expect(typeof api.documents.getById).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`
Expected: FAIL because the bridge contract does not exist yet.

**Step 3: Write minimal implementation**

- Define the preload bridge contract for future desktop APIs
- Expose a safe `window.workKnowlage` object through Electron preload
- Provide a renderer fallback adapter that reads from mock data during phase 1
- Ensure Electron opens the Vite renderer in development and built assets in production

Minimal contract target:

```ts
export interface WorkKnowlageDesktopApi {
  spaces: {
    list: () => Promise<Space[]>;
  };
  documents: {
    getById: (documentId: string) => Promise<DocumentRecord | null>;
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lib/workKnowlageApi.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types/preload.ts src/shared/lib/workKnowlageApi.ts src/shared/lib/workKnowlageApi.test.ts electron/preload.ts electron/main.ts src/app/App.tsx
git commit -m "feat: add preload api contract for desktop shell"
```

### Task 8: Run Final Verification For Phase 1

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Write the failing verification check**

Add a missing script expectation to the README and package manifest:

```md
- `npm run dev` starts the Electron desktop shell
- `npm run test` runs the shell tests
- `npm run build` builds the renderer and Electron bundles
```

**Step 2: Run verification to confirm gaps**

Run: `npm run test`
Expected: FAIL if any shell interaction, API contract, or layout component is still incomplete.

**Step 3: Write minimal implementation**

- Add or correct scripts so `dev`, `test`, `build`, and `typecheck` all work
- Add a minimal README with startup instructions
- Fix any remaining test, type, or import issues

**Step 4: Run verification to confirm it passes**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected:

- all tests PASS
- TypeScript exits successfully
- Vite and Electron production bundles build successfully

**Step 5: Commit**

```bash
git add package.json README.md
git commit -m "chore: verify and document shell workflow"
```

## Deferred Work After This Plan

- 接入 SQLite 和 `FTS5`
- 接入 `spaces / folders / documents / tags` 本地真实模型
- 复用 `WorkPlan` 的 `BlockNote` 编辑器模块
- 接入局域网只读分享与分享快照

Plan complete and saved to `docs/plans/2026-03-25-workknowlage-shell-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints
