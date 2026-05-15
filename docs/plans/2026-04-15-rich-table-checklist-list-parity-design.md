# RichTable Checklist And List Parity Design

**Goal**

让 `RichTable` 单元格内容补齐真正可勾选、可保存的 checklist，并让有序列表、无序列表、checklist 的视觉表现与主编辑器保持一致。

## Why Change

当前 `RichTable` 里的单元格编辑器是独立的 TipTap 实现：

- 它支持普通段落和有序/无序列表
- 它没有 checklist 能力
- 它的列表样式来自 `RichTable.css`，没有复用主编辑器已有的 marker、缩进、checkbox 视觉约束

结果是表格内的内容能力和主编辑器不一致，尤其是在用户需要在表格里写任务列表时，会出现功能缺口和样式割裂。

## Scope

本次做：

- 为 `RichTable` 单元格补齐真正的 checklist 数据结构与交互
- 支持通过输入 `[ ] ` 自动创建 checklist
- 支持已有 checklist 的显示、勾选、保存
- 让 `RichTable` 内的 bullet、numbered、checklist 样式与主编辑器一致
- 补充行为和样式回归测试

本次不做：

- 在 `RichTable` 顶部工具栏新增 todo 按钮
- 为 checklist 增加额外快捷键面板
- 把 `RichTable` 改造成 BlockNote 子编辑器
- 追求比当前有序/无序列表更强的导出语义

## Chosen Approach

采用“保留 TipTap 编辑器，补齐 task list 能力并对齐样式”的方案。

原因：

- 改动范围最小，能延续当前 `RichTable` 的序列化和保存方式
- 不需要重写 `RichTable` 的表格选择、overlay、paste 和宽度逻辑
- checklist 可以和现有 ordered/bullet 一样，在单元格 JSON 内自然存储

## Architecture

### Data Model

`RichTable` 继续保存 TipTap JSON。

在单元格节点内容中新增：

- `taskList`
- `taskItem`

已存在的 `paragraph`、`bulletList`、`orderedList`、`listItem` 不变。

### Creation Flow

不新增 toolbar 按钮。

创建入口采用和用户约定的轻量方式：

- 在单元格里输入 `[ ] ` 时，自动转换成 checklist 项

这样不会增加表格工具栏复杂度，同时能给用户一个稳定且低摩擦的创建入口。

### Editing And Persistence

- `taskItem` 需要支持勾选状态切换
- 勾选后仍走现有 `onUpdate -> JSON stringify -> updateBlock` 保存链路
- 已有 checklist 内容重新打开后必须按原勾选状态渲染

### Styling

`RichTable.css` 不再只保留浏览器默认列表表现，而是把以下规则对齐到主编辑器：

- 列表文本字号、字重、行高
- bullet/numbered marker 的颜色、对齐、间距
- checklist checkbox 的尺寸、列宽、居中方式
- 列表嵌套缩进与基线

目标不是机械复用 BlockNote 选择器，而是把 `RichTable` 的 TipTap DOM 映射到同一套视觉规范。

### Export / Static HTML

导出遵循“和现有 ordered/bullet 一样即可”的边界：

- checklist 在静态 HTML 中保留为对应的任务列表结构或等价可读结构
- 不额外为导出层增加超出当前列表支持等级的复杂逻辑

## Options Considered

### Option A: 真正接入 TipTap task list 并对齐 CSS（推荐）

优点：

- 能力完整
- 数据语义正确
- 改动集中在 `RichTable` 内部

缺点：

- 需要补一层输入规则和导出渲染

### Option B: 用普通列表加 checkbox 样式模拟

优点：

- 代码改动少

缺点：

- 勾选状态不稳定
- 序列化不自然
- 后续维护成本更高

### Option C: 让 `RichTable` 复用主编辑器的 BlockNote 实现

优点：

- 理论上一致性最高

缺点：

- 明显超出本轮范围
- 风险高，会影响当前成熟的表格交互层

## Testing

需要覆盖：

1. `RichTable` 源码已接入 checklist 扩展和 `[ ] ` 自动转换
2. checklist 节点能参与当前 JSON 渲染/保存链路
3. `RichTable.css` 中的 bullet、numbered、checklist 规则与主编辑器视觉约束对齐
4. 现有 `RichTable` 列表样式测试继续通过，新增 checklist 回归点

## Acceptance

完成后用户在 `RichTable` 单元格里可以：

- 输入 `[ ] ` 创建 todo
- 勾选和取消勾选 todo
- 重新打开文档后保留 todo 状态
- 看到与主编辑器一致的 bullet、numbered、todo 列表视觉表现
