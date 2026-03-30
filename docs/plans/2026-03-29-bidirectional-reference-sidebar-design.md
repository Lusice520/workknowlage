# Bidirectional Reference Sidebar Design

**Goal**

让右侧栏的“关联引用”从单向的“被谁提到”升级成双向可读的关系面板，让用户在当前文档中同时看见：

- 当前文档主动提到了谁
- 当前文档被谁提到

并且两侧都支持点击跳转。

## Why Change

当前实现只展示 `incoming backlinks`，也就是“被提及于”。这会带来两个问题：

- 用户在当前文档里已经插入了 `@mention`，但右栏看不到“我提到了谁”
- 同一个“关联引用”区域里缺少方向语义，用户只能通过上下文猜这是入链还是出链

第二期已经完成了 `@mention + backlinks` 的底层链路，现在最合适的补强就是把“关系方向”展示出来。

## Scope

本次做：

- 右栏“关联引用”升级成双向关系面板
- 分组展示：
  - `提及文档`
  - `被提及于`
- 两组都支持点击打开目标文档
- 用 icon 和分组标题区分方向
- 正式文档生效，快记维持当前行为

本次不做：

- 新增数据库表
- 图谱视图
- 跨空间关联
- 在正文里为 mention 增加 hover 卡片

## Data Strategy

### Incoming

继续使用当前持久化好的 `backlinks`：

- 来源：SQLite / fallback 中已经维护的 `backlinks`
- 含义：哪些文档提到了当前文档

### Outgoing

不新增表，直接从当前文档的 `contentJson` 中解析 `docMention`：

- 来源：当前文档正文里的 inline `docMention`
- 含义：当前文档主动提到了哪些文档

这样做的原因：

- `outgoing` 本质就是当前文档正文的直接投影，没有必要单独落库
- 当前文档打开时我们已经有完整 `contentJson`
- 解析逻辑可以复用第二期里已经存在的 `docMention` 规则

## UI Structure

右栏保留一个总区块：`关联引用`

区块内拆成两个 section：

### 1. 提及文档

含义：

- 当前文档主动提到的目标文档列表

展示：

- 分组标题：`提及文档`
- 图标：出链 / 向外引用图标
- 卡片内容：
  - 目标文档标题
  - 简短说明，例如 `在当前文档中已提及`

点击：

- 打开被提及的目标文档

### 2. 被提及于

含义：

- 其他文档对当前文档产生的 incoming backlink

展示：

- 分组标题：`被提及于`
- 图标：回链 / 被引用图标
- 卡片内容：
  - 来源文档标题
  - backlink 摘要 description

点击：

- 打开来源文档

## Interaction Rules

- 两组都显示时，先展示 `提及文档`，再展示 `被提及于`
- 两组都为空时，显示统一空态：`当前文档还没有关联引用`
- 某一组为空时，只显示该组空态，不隐藏另一组
- 同一目标文档在 `提及文档` 中只出现一次
- 不允许文档提及自己

## Icons

推荐图标方向语义如下：

- `提及文档`：`Link` / `ArrowUpRight` 一类，表达“我指向别人”
- `被提及于`：`CornerDownLeft` / `Reply` / `Undo2` 一类，表达“别人回指我”

重点不是图标本身，而是方向必须明显不同，避免两组视觉上像同一种记录。

## Technical Plan

- 在 renderer 层新增一个轻量的 `extractOutgoingMentions` 工具
- 从 `contentJson` 里读取 `docMention.documentId + title`
- 右栏接收：
  - `activeDocument.backlinks`
  - `activeDocument.contentJson` 派生的 outgoing mentions
- 两组的点击都复用现有的文档打开入口

## Testing

需要补这几类测试：

1. 右栏双向展示

- 当前文档既有 outgoing mentions，也有 incoming backlinks 时，两组都显示

2. 空态

- 一组为空时仍显示另一组
- 两组都为空时显示统一空态

3. 点击跳转

- 点击 `提及文档` 会打开目标文档
- 点击 `被提及于` 会打开来源文档

4. 去重

- 同一个目标在正文被多次 mention，只显示一次 outgoing 卡片

## Acceptance

完成后，用户打开一篇正式文档时，右栏能明确看到：

- 这篇文档链接到了哪些文档
- 哪些文档链接到了这篇文档

并且所有卡片都能直接跳转。整体体验要比当前单边 backlink 更符合“知识关系网络”的直觉。
