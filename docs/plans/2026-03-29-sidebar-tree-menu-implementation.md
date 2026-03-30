# Sidebar Tree Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将左侧目录树的新建与管理动作调整为菜单化交互，并补上文档节点的新增入口。

**Architecture:** 保持现有 `createDocument(folderId)` / `createFolder(parentId)` 数据流不变，只在 sidebar 组件层重组动作入口。根目录与节点动作抽成可复用菜单组件，测试覆盖根级创建、节点更多菜单、文档节点同级新增。

**Tech Stack:** React 18, TypeScript, Mantine Menu, Vitest, Testing Library

---

### Task 1: 补根目录创建菜单测试

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SidebarRootSection.tsx`

**Step 1: Write the failing test**

- 增加测试，先点根目录 `+`，再点 `新建文件`，验证根级文档创建成功。

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx -t "opens the root create menu"`

**Step 3: Write minimal implementation**

- 根目录创建入口改为菜单触发器。

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx -t "opens the root create menu"`

### Task 2: 补节点“更多”菜单测试

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SidebarTreeItems.tsx`

**Step 1: Write the failing test**

- 文件夹和文档都通过 `更多` 菜单触发重命名、删除。

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx -t "exposes rename and delete actions through node menus"`

**Step 3: Write minimal implementation**

- 把现有直接按钮改成 `更多` 菜单。

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx -t "exposes rename and delete actions through node menus"`

### Task 3: 补文档节点新增菜单测试

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/SidebarTreeItems.tsx`

**Step 1: Write the failing test**

- 文档节点打开 `+` 菜单后，`新建文件` 和 `新建文件夹` 使用当前文档所在 `folderId`。

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx -t "allows creating sibling items from a document node"`

**Step 3: Write minimal implementation**

- 给文档节点补创建菜单，调用现有 `onCreateDocument(sourceFolderId)` 和 `onCreateFolder(sourceFolderId)`。

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx -t "allows creating sibling items from a document node"`

### Task 4: 回归验证

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/LeftSidebar.test.tsx`

**Step 1: Run focused sidebar suite**

Run: `npm test -- src/features/shell/LeftSidebar.test.tsx`

**Step 2: Run typecheck if needed**

Run: `npm run typecheck`

**Step 3: Record actual gaps**

- 如果某个菜单交互和当前数据模型冲突，明确记录为下一阶段 schema 工作，不在本次偷偷扩 scope。
