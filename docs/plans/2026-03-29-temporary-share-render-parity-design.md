# 临时分享页面内容同源渲染设计

## 背景

当前 `WorkKnowlage` 的临时分享页仍然使用独立的分享渲染器：

- [electron/share/render.cjs](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs)
- [electron/share/server.cjs](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/server.cjs)

而正式文档导出已经拥有另一套更完整的内容 HTML/CSS 渲染链：

- [src/features/export/exportUtils.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.ts)
- [src/app/useDocumentExport.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.ts)

这导致两个问题：

- 分享页和导出页的视觉风格、块样式、行内样式会持续漂移
- 每次修一个块，例如 `alert`、`richTable`、`@提及`、`code block`，都需要维护两套实现

用户已经明确本期目标：

- 分享场景优先做 `临时分享`
- 分享页的样式必须和文档一致
- 一致性不仅限于个别样式，而是覆盖 `全部块`
- 分享页要改成 `内容区滚动`，而不是整页滚动

## 目标

把临时分享页重构为：

- `页面壳子` 仍然是分享专用
- `文档内容渲染` 与导出内容区完全同源
- 所有正文块与行内样式共用一套 HTML 结构和 CSS
- 分享页使用 `内容区独立滚动` 的阅读布局

## 非目标

本期不做：

- 稳定外链或公网分享
- 云端分享服务
- 分享权限体系
- 分享评论、协作、在线编辑
- 每日快记分享

本期继续沿用现有本机随机端口临时分享模型，只重构渲染和阅读体验。

## 现状

### 当前分享页

[electron/share/render.cjs](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs) 当前自己维护：

- `renderInlineNode`
- `renderRichTableHtml`
- `renderAlertBlock`
- `renderBlockSequence`
- `buildShareHtml`

它有自己的一套：

- 字体
- 标题层级
- 段落和列表间距
- alert/callout 样式
- 表格样式
- 图片和附件卡片

这套内容视觉与导出内容已经开始偏离。

### 当前导出页

[src/features/export/exportUtils.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.ts) 已经具备：

- 块级 HTML 渲染
- 行内样式渲染
- `@提及`
- `alert`
- `richTable`
- 图片、附件
- 统一 printable CSS

但它当前是“导出优先”的形态，输出更偏向 PDF/打印文档，不包含分享页壳子和阅读布局。

## 方案对比

### 方案 A：共享内容渲染层，分享页保留独立壳子

做法：

- 抽出一个共享的正文 renderer
- 分享页和导出页共用同一套正文 HTML/CSS
- 分享页只保留自己的 header / metadata / toc / layout

优点：

- 最快达成“样式一致”
- 风险最低
- 不需要把分享页改造成完整前端运行时页面
- 后续修一个块就能同时修复分享和导出

缺点：

- 分享页整体外框仍不是应用内页面的 1:1 复制

### 方案 B：共享前端阅读态页面

做法：

- 分享页直接加载一个 React 只读阅读组件
- 应用内阅读、分享页、打印预览三方共用 UI 组件

优点：

- 长期最统一

缺点：

- 对当前临时分享来说过重
- 需要前端运行时、打包入口和服务端加载策略一起变化

### 方案 C：继续维护分享渲染器，只同步样式 token

做法：

- 保留分享渲染器
- 仅同步颜色、字体、间距、部分块样式

优点：

- 改动最小

缺点：

- 只能做到“像”，不能做到真正一致
- 未来仍会反复漂移

## 推荐方案

采用 **方案 A：共享内容渲染层，分享页保留独立壳子**。

核心原则：

- `内容区` 100% 同源
- `页面壳子` 可以分享专用
- 分享页和导出页不再维护两份正文块实现

## 需要达到的内容一致性范围

分享页正文必须与导出内容区共用同一套渲染，覆盖：

- 标题
- 正文段落
- 引用
- 分割线
- 有序列表
- 无序列表
- 待办列表
- `alert/callout`
- `code block`
- 图片
- 附件
- `richTable`
- `@提及`
- 行内加粗、斜体、下划线、删除线、行内代码、链接、颜色
- 块嵌套结构
- 对齐方式

这里的目标不是“样式相似”，而是“同一个 renderer 输出”。

## 最终架构

### 1. 共享内容渲染层

新增一个共享模块，建议放在：

- `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/documentHtmlRenderer.ts`

职责：

- 解析 blocks
- 生成 `bodyHtml`
- 生成 `contentCss`
- 生成 `documentHtml(title, bodyHtml, css, options)`
- 生成目录数据（可选）

输出接口建议至少包含：

- `renderDocumentHtmlBodyFromBlocks(blocks, options)`
- `buildDocumentHtmlShell({ title, bodyHtml, contentCss, bodyClass, extraHeadHtml })`
- `extractDocumentHeadings(blocks)`

这层不关心“是不是分享页”，只关心“如何把文档内容渲染正确”。

### 2. PDF 导出壳子

继续保留导出入口和 Electron `printToPDF`。

变化点：

- [src/app/useDocumentExport.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/app/useDocumentExport.ts) 不再直接依赖 [exportUtils.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/features/export/exportUtils.ts) 的整页模板
- 改成调用共享 renderer 输出正文 HTML + 内容 CSS
- 再由导出壳子决定打印文档外框

### 3. 分享页壳子

[electron/share/render.cjs](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/electron/share/render.cjs) 以后只负责：

- 顶部 header
- 分享状态
- 更新时间
- TOC 布局
- 页面外框
- 独立滚动容器

它不再负责正文块级渲染逻辑。

## 分享页滚动布局

分享页要从“整页滚动”改成“内容区滚动”。

推荐结构：

- `html, body, .share-page-root`
  - `height: 100%`
  - `overflow: hidden`
- `header`
  - 固定在壳子布局内
- `main`
  - 两栏布局
- `.share-content-pane`
  - `min-height: 0`
  - `overflow-y: auto`
- `.share-sidebar`
  - `min-height: 0`
  - 可 `position: sticky` 或独立滚动

效果：

- 页面外框不滚动
- 正文单独滚动
- TOC / metadata 稳定停留在阅读视野里

## 目录策略

分享页 TOC 继续保留，但不再由分享渲染器自己重新解析一套 heading HTML，而是直接基于共享 renderer 提取的 heading 数据生成。

这样：

- heading 文案和分享页目录不会再分叉
- TOC 可以更稳定支持锚点或滚动定位

## 兼容性与边界

### 资源 URL

共享 renderer 仍需支持：

- `http(s)` 绝对地址
- `/uploads/...`
- `data:image/...`

分享页要继续把本地 `/uploads/...` 转成带 `origin` 的可访问地址。

### legacy sections

如果数据库里还有旧格式 `sections` 文档：

- 继续保留旧兼容入口
- 但兼容逻辑也要尽量汇入共享 renderer

### 可打印性

因为 PDF 也要复用这份内容 renderer，所以内容 CSS 不能只为网页阅读而设计，必须同时满足：

- 分享阅读可用
- 打印输出稳定

做法上允许：

- 共享 `内容 CSS`
- 额外在 PDF 壳子里叠加打印专用 CSS

## 测试策略

### 内容 renderer 单测

需要新增测试，锁定：

- 全部块输出正确 HTML
- 行内样式不丢失
- `richTable`、`alert`、`@提及` 渲染保持稳定
- heading 提取结果正确

### 分享页单测

需要新增测试，锁定：

- 分享页使用共享 renderer 输出的正文 HTML
- 分享页不再保留旧的块级渲染分支
- 内容区采用独立滚动容器，而非整页滚动

### 导出回归

需要补回归，确保：

- PDF 仍然生成完整 HTML
- 分享 renderer 重构后不影响现有导出样式

## 实施顺序

1. 抽共享内容 renderer
2. 让导出页先接共享 renderer，保证现有导出不回退
3. 分享页改接共享 renderer
4. 删除分享页旧的重复渲染逻辑
5. 加内容区独立滚动布局和 TOC 壳子整理

## 预期结果

重构完成后：

- 分享页正文和导出正文将真正同源
- “全部块一致”不再依赖人工同步两套实现
- 分享页阅读体验从普通长网页，变成稳定的内容区阅读面板
- 后续修正文块样式时，只需要改一处
