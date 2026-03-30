# Mention Search Menu Design

**Goal**

优化文档编辑器里的 `@mention` 体验，让用户在输入 `@` 后可以立即检索文档，并且在文档量变大时，候选列表仍然短、小、可控。

## Why Change

当前实现已经支持 `@` 唤醒文档 mention，但仍有两个明显问题：

- 只按标题做简单包含匹配，命中能力偏弱
- 候选结果没有明确的结果策略，文档一多时体验会变差

用户已经明确希望：

- `@` 后可以立即检索
- 候选不要因为文档很多而“拉得很长”

## Scope

本次做：

- `@` 唤醒后支持即时检索
- 检索维度升级为 `标题 + 所在路径`
- 候选列表限制为前 `8` 条
- 候选展示路径副标题，帮助区分同名文档
- 保持当前空间内 mention，不引入跨空间搜索

本次不做：

- 服务端搜索
- 全局搜索弹窗
- 模糊搜索库接入
- 最近使用文档单独排序区
- 直接从快记里 mention 正式文档的额外交互改造

## Official Reference

这次方案和官方能力是对齐的：

- BlockNote `SuggestionMenuController` 本身就是“触发字符 + query 过滤”的模型  
  参考：[BlockNote Suggestion Menus](https://www.blocknotejs.org/docs/react/components/suggestion-menus/)
- BlockNote 官方也把 mention 作为“自定义 inline content + suggestion menu”的组合能力  
  参考：[BlockNote Custom Inline Content](https://www.blocknotejs.org/docs/features/custom-schemas/custom-inline-content)
- Tiptap Mention 官方同样建议在 suggestion `items` 阶段做检索和结果截断  
  参考：[Tiptap Mention](https://tiptap.dev/docs/editor/extensions/nodes/mention)

## Data Strategy

不新增后端接口，不改 SQLite 结构。

现有 editor mention 候选来自前端传入的 `mentionDocuments`。本次只把它从：

- `id`
- `title`

扩展成：

- `id`
- `title`
- `folderPath`
- `updatedAt`

其中：

- `folderPath` 在 renderer 里基于当前空间的 `folders + folderId` 计算
- `updatedAt` 直接复用当前文档数据

这样可以在不动后端的前提下，完成路径匹配和排序。

## Search Rules

### Match Dimensions

检索时合并以下文本：

- 文档标题
- 文档所在路径

例如：

- 输入 `@产品`，标题命中
- 输入 `@产品库`，路径命中
- 输入某级目录名，也可以命中

### Ranking

排序规则按优先级如下：

1. 标题前缀命中
2. 标题包含命中
3. 路径命中
4. 同分时按最近更新时间倒序

### Result Limit

- 最多返回 `8` 条
- 如果没有命中，展示现有 suggestion 空态

这样能解决“菜单无限变长”的主要问题，即使不额外定制组件，也能保持可控高度。

## UI Structure

每条候选保留 BlockNote 默认 suggestion item 结构：

- 主标题：`@文档标题`
- 副标题：文档路径，例如 `产品库 / 船舶自动化 / HMI`

如果是根目录文档，则副标题显示：

- `根目录`

## Technical Plan

### 1. 扩展 mention candidate 数据

从 `CenterPane -> EditorHost -> SharedBlockNoteSurface` 这一条链路，把 mention 候选扩展为包含路径和更新时间的结构。

### 2. 提取路径工具

在 shared 层新增轻量 helper：

- 根据 `folders + folderId` 生成可显示路径
- 避免把路径拼接逻辑散落在 editor 组件里

### 3. 升级 mention item 生成逻辑

在 `getDocumentMentionItems` 里完成：

- query 标准化
- 标题 / 路径匹配
- 排序
- 截断到前 `8` 条
- subtitle 改为路径

### 4. 适度收口菜单样式

如果默认 suggestion 菜单在 `8` 条时仍然过高，再通过 editor CSS 轻量限制 `.bn-suggestion-menu` 的最大高度和内部滚动。

这一步只作为 UI 收尾，不作为功能主路径。

## Testing

需要覆盖：

1. `@` 候选支持按标题命中
2. `@` 候选支持按路径命中
3. 结果最多返回 `8` 条
4. 同名文档可通过路径副标题区分
5. 当前文档自己不会出现在候选里

## Acceptance

完成后，用户在正文输入 `@` 时会得到一个可检索、可区分、不会无限变长的文档候选列表：

- 输入越具体，结果越快收敛
- 同名文档能靠路径区分
- 文档很多时，候选仍然保持短列表
