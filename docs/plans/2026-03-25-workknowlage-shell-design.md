# WorkKnowlage Shell Design

**Date:** 2026-03-25

## Goal

为 `WorkKnowlage` 启动一个全新的桌面知识库应用第一阶段设计，先完成 `Electron + React + Vite + TailwindCSS` 的可运行骨架，以及接近参考图气质的三栏主界面壳子；编辑器复用 `WorkPlan` 的方案放到第二阶段接入。

## Confirmed Boundaries

- 技术形态：`Electron + React + Vite`
- 前端样式：优先使用 `TailwindCSS`
- 存储方式：本地存储
- 使用模式：单人使用，不做协同
- 空间模型：支持多个自定义空间，且可以跨空间搜索、跨空间引用
- 分享方式：局域网只读分享
- 导出能力：保留分享和导出
- 编辑器要求：样式与现有系统保持一致，但移除协同相关 UI 与逻辑
- 第一阶段顺序：先完成三栏壳子，再复用 `WorkPlan` 编辑器

## Visual Direction

参考图确认的视觉方向如下：

- 整体为明亮、轻盈、桌面化的信息工作台风格
- 背景以浅灰和白色为主，搭配柔和阴影与低对比边框
- 主强调色使用亮蓝色，用于主按钮、激活态与重点导航
- 左侧导航更重，承担空间切换、新建入口、树状结构和底部工具卡
- 中间正文区域更轻，突出标题、元信息与文稿主体
- 右侧辅助栏克制，承载大纲、标签、反向链接、分享与导出入口

## Recommended Architecture

- `Electron`
- `React + Vite`
- `TailwindCSS`
- 第二阶段编辑器基座：复用 `WorkPlan` 的 `BlockNote` 方案
- 第二阶段本地数据：`SQLite`，建议启用 `FTS5`
- 第二阶段附件：本地附件目录
- 第二阶段分享：Electron main 进程内置轻量 HTTP 服务，提供局域网只读分享

## Phase Strategy

### Phase 1

先完成桌面应用骨架与三栏主界面壳子：

- 创建 `WorkKnowlage` 项目目录
- 搭建 `Electron + React + Vite + TailwindCSS`
- 用 mock 数据跑通左栏、中栏、右栏的联动
- 预留 `EditorHost`、本地数据层、分享能力的接口边界

### Phase 2

接入本地数据层与基础模型：

- 建立 `spaces / folders / documents / tags` 基础模型
- 接入 SQLite 与 Electron IPC
- 将左侧树、文档切换与元信息改为真实本地数据

### Phase 3

复用 `WorkPlan` 编辑器：

- 复用 `BlockNote` 编辑器模块、统一样式、目录和导出配套能力
- 去除协同相关 UI、Yjs、WebSocket 与在线保存逻辑
- 改为本地持久化与附件目录保存

### Phase 4

补齐分享与导出：

- 接入局域网只读分享
- 补分享快照与导出能力

## Layout Design

### Left Sidebar

宽度约 `300px`，包含：

- 空间切换卡
- 新建按钮与快捷入口
- 文档树与树节点状态
- 底部日历卡、回收站、设置入口

### Center Pane

作为主要工作区，包含：

- 顶部面包屑与操作按钮
- 文档标题和元信息
- 正文展示壳
- 未来编辑器挂载区域 `EditorHost`

第一阶段中栏使用真实页面结构和静态示例文稿，不直接接入编辑器。

### Right Sidebar

宽度约 `320px`，包含：

- 文档大纲
- 标签
- 反向链接
- 分享/导出卡片

即使部分能力尚未完成，也保留结构与占位态。

## Module Boundaries

建议项目目录如下：

```text
WorkKnowlage/
├─ electron/
│  ├─ main.ts
│  ├─ preload.ts
│  ├─ ipc/
│  └─ services/
├─ src/
│  ├─ app/
│  ├─ features/
│  │  ├─ shell/
│  │  ├─ spaces/
│  │  ├─ folders/
│  │  ├─ documents/
│  │  ├─ editor-host/
│  │  ├─ outline/
│  │  ├─ backlinks/
│  │  └─ sharing/
│  ├─ shared/
│  │  ├─ types/
│  │  ├─ ui/
│  │  ├─ lib/
│  │  └─ mocks/
│  └─ styles/
└─ docs/plans/
```

关键约束：

- `electron/` 只负责桌面能力，不直接承载 React 视图逻辑
- `features/shell/` 只负责三栏布局与壳子组件
- `features/editor-host/` 是第二阶段替换点，第一阶段只做占位壳
- `shared/types/` 统一定义核心实体类型
- `shared/mocks/` 在第一阶段提供演示数据

## Data Flow Strategy

第一阶段采用“结构真实、数据模拟、接口预留”的方式：

- `AppShell` 从 `shared/mocks` 读取默认空间、树和文档数据
- 左栏切换空间、展开树节点、选中文档时更新前端状态
- 中栏根据 `activeDocumentId` 渲染标题、元信息和正文占位
- 右栏根据当前文档渲染大纲、标签、反向链接与分享状态占位

同时预留未来真实接口形状：

- `window.workKnowlage.spaces.list()`
- `window.workKnowlage.documents.getTree(spaceId)`
- `window.workKnowlage.documents.getById(documentId)`
- `window.workKnowlage.documents.create(payload)`
- `window.workKnowlage.documents.updateMeta(payload)`
- `window.workKnowlage.search.query(keyword, options)`
- `window.workKnowlage.share.getSnapshot(documentId)`

## Editor Reuse Strategy

`WorkPlan` 中可复用的不是单一编辑器组件，而是一整套知识库编辑体验：

- `BlockNote` 基础能力
- 自定义 schema
- 统一编辑器样式
- 大纲/导出配套能力

`WorkKnowlage` 第二阶段将复用上述能力，但明确移除：

- 协同状态展示
- `Yjs`
- `WebSocket`
- 在线队列与协同持久化逻辑

替换为：

- 本地 SQLite 文档持久化
- 本地附件目录
- 单人使用语义下的右侧信息栏

## Empty States And Error Handling

- 应用启动提供 `初始化中 / 初始化失败 / 重试`
- 左栏支持 `无空间 / 空文件夹 / 无文档`
- 中栏支持欢迎态和文档缺失降级态
- 右栏各卡片支持独立空态
- 未实现的分享、历史、导出按钮保留结构但给出明确占位反馈

## Phase 1 Acceptance

1. 在当前工作区创建 `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage` 项目目录
2. 完成 `Electron + React + Vite + TailwindCSS` 可运行骨架
3. 完成与参考图气质一致的三栏桌面壳子
4. 左栏、中栏、右栏具备真实状态联动
5. 预留 `EditorHost`、本地数据层、分享模块的清晰接入口

## Notes

- 由于当前目录尚未配置 Git 身份，设计文档可先落盘；如需提交，需先配置 `git user.name` 与 `git user.email`。
