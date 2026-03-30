# 第四期正式文档导出设计

## 背景

第四期目标从“本地分享优先”切换为“正式文档导出优先”。当前 `WorkKnowlage` 已有正式文档编辑、分享链接、附件、富表格、提醒块和图片能力，但没有稳定的 Markdown / PDF / Word 导出链路。用户明确要求：

- 本期只覆盖正式文档，不处理每日快记
- 支持三种导出格式：Markdown、PDF、Word
- Word 导出必须比“能打开就行”的默认样式更精致
- 优先复用 `WorkPlan` 里已经验证过的一套导出实现

## 现状

`WorkKnowlage` 当前只有本地分享渲染能力：

- [electron/share/render.cjs](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs)
- [electron/share/server.cjs](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/server.cjs)
- [src/app/useDocumentShare.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentShare.ts)
- [src/features/shell/CenterPane.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx)

`WorkPlan` 已有一套可复用导出能力：

- Markdown / printable HTML: [exportUtils.js](/Volumes/WorkSpace/workplan/pr-bug-tracker/src/views/knowledgeBase/exportUtils.js)
- Word: [docxExportUtils.js](/Volumes/WorkSpace/workplan/pr-bug-tracker/src/views/knowledgeBase/docxExportUtils.js)
- PDF orchestrator: [KnowledgeBaseView.jsx](/Volumes/WorkSpace/workplan/pr-bug-tracker/src/views/KnowledgeBaseView.jsx)
- 服务端 PDF 生成参考: [shareRoutes.js](/Volumes/WorkSpace/workplan/pr-bug-tracker/server/routes/shareRoutes.js)

## 复用结论

### 可以高复用

- `WorkPlan` 的 BlockNote blocks -> Markdown 序列化逻辑
- `WorkPlan` 的 BlockNote blocks -> printable HTML 逻辑
- `WorkPlan` 的 Word `.docx` 构建逻辑和默认样式体系
- `WorkPlan` 的 contract test 思路，特别是图片、表格、默认 section 和 Word 紧凑单元格样式

### 不直接复用

- `WorkPlan` 里的 HTTP `/api/export/pdf` 路由
- `WorkPlan` 里以树节点为中心的 UI 接入方式
- `WorkPlan` 依赖服务端 `puppeteer` 路由回传 PDF 的前端调用模型

原因是 `WorkKnowlage` 是 Electron 本地应用，更适合：

- 在 renderer 里复用 BlockNote 导出逻辑
- 在 Electron main 里完成保存弹窗和 PDF 文件落盘
- 避免再为了导出引入一套本地 HTTP API

## 方案对比

### 方案 A：全部从现有分享 HTML 派生

优点：

- 代码量最小
- PDF 实现最快

缺点：

- Markdown 质量差
- Word 样式控制弱
- 很难满足“Word 需要优化样式”

### 方案 B：混合导出管线

优点：

- 最贴近 `WorkPlan` 已验证方案
- Markdown、PDF、Word 各自走最合适的生成方式
- 能保住 Word 的样式质量

缺点：

- 需要新增一层导出编排
- 需要增加 `docx` / `prosemirror-docx`

### 方案 C：三种格式都在 Electron main 里重写

优点：

- 数据流全在 main process

缺点：

- 改动更大
- WorkPlan 的前端导出逻辑无法直接借用
- 重复造轮子

## 推荐方案

采用 **方案 B：混合导出管线**。

### 核心原则

- 导出入口只面向当前激活的正式文档
- 优先使用当前编辑器的最新内容快照，而不是依赖可能滞后的数据库内容
- Markdown / Word 在 renderer 里序列化
- PDF 在 renderer 里生成 printable HTML，再交给 Electron main 用隐藏窗口 `printToPDF`
- 文件保存统一交给 Electron main 处理，使用系统保存弹窗

## 最终架构

### Renderer 侧

新增 `src/features/export/`：

- `exportUtils.ts`
  - 从 `WorkPlan` 迁移并适配 Markdown 和 printable HTML 导出
- `docxExportUtils.ts`
  - 从 `WorkPlan` 迁移并适配 Word 导出
- `useDocumentExport.ts`
  - 导出编排 hook
  - 负责：
    - 先保存当前文档最新快照
    - 读取当前 `contentJson`
    - 根据格式生成 Markdown 文本 / Word Blob / printable HTML
    - 调用 desktop bridge 保存或生成 PDF

### Electron main 侧

新增 `electron/export/`：

- `files.cjs`
  - 保存弹窗
  - 二进制和文本落盘
- `pdf.cjs`
  - 用隐藏 `BrowserWindow` 加载 printable HTML
  - 调用 `webContents.printToPDF`

`main.cjs` / `preload.cjs` / `src/shared/types/preload.ts` 增加：

- `exports:saveText`
- `exports:saveBinary`
- `exports:savePdfFromHtml`

### UI 侧

在 [src/features/shell/CenterPane.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/shell/CenterPane.tsx) 当前右上角操作区新增一个 `导出` 菜单，提供：

- 导出 Markdown
- 导出 PDF
- 导出 Word

不替换现有分享按钮，只并列出现。

## 格式策略

### Markdown

目标：可编辑、可阅读

支持：

- 标题
- 段落
- 引用
- 列表 / checklist
- 附件链接
- 图片链接
- 富表格降级为 Markdown 表格
- `@文档提及` 导出为纯文本引用

这是“有损但稳定”的导出，不追求 100% 恢复富编辑效果。

### PDF

目标：可打印、可分发

策略：

- 基于 printable HTML
- 保留标题、更新时间、标签、正文块、图片、表格、提醒块
- 使用单独的打印样式，确保 A4 输出稳定
- 不暴露交互节点和编辑器工具栏

### Word

目标：打开后就是一份正式文档

策略：

- 复用 `WorkPlan` 的 `docx` + `prosemirror-docx` 样式体系
- 对以下内容重点优化：
  - 标题层级字号
  - 正文行高和段间距
  - 图片和题注
  - 表格边框、表头背景、单元格紧凑度
  - 提醒块（alert）的层次感
  - 中文字体和英文后备字体

## 依赖

需要新增：

- `docx`
- `prosemirror-docx`

PDF 不引入 `puppeteer`，因为 Electron 已可用 `printToPDF`。

## 数据流

1. 用户在当前正式文档点击 `导出`
2. `useDocumentExport` 先调用现有保存能力，保证快照最新
3. `useDocumentExport` 根据格式生成导出内容
4. 通过 preload bridge 调 Electron
5. Electron 弹出保存窗口并写入目标文件
6. 前端展示成功 / 失败反馈

## 错误处理

- 用户取消保存：静默返回或显示“已取消导出”
- Word / Markdown 生成失败：显示具体格式失败
- PDF 窗口打印失败：返回“PDF 导出失败，请重试”
- 空文档：仍允许导出，生成带标题的空文件

## 测试策略

### Renderer 单测

- Markdown 导出 contract
- HTML / 图片 / 富表格导出 contract
- Word 导出 contract
- `useDocumentExport` 行为测试

### Electron 单测 / smoke

- 保存文本导出到指定路径
- 保存 Word 二进制导出到指定路径
- PDF HTML -> 文件落盘

### UI 测试

- CenterPane 导出菜单渲染
- 点击格式后调用正确的导出 hook

## 验收标准

- 当前正式文档可导出 `.md`
- 当前正式文档可导出 `.pdf`
- 当前正式文档可导出 `.docx`
- 图片、附件、富表格、提醒块不会在 PDF / Word 中直接丢失
- Word 版式明显优于默认文档样式
- 全量 `typecheck` / `test` / `build` 通过
