# 右侧栏上下文面板与 Wiki 关联 单功能需求规格说明书

> 文档元信息
> - 版本：v0.3 草稿
> - Owner：Lusice
> - 作者：Codex based on Lusice context
> - 最后更新：2026-05-15
> - 所属 PRD：`../PRD.md`
> - 功能路径：关系导航 / 右侧栏上下文面板与 Wiki 关联
> - 状态：draft

---

## 1. 功能概览

| 项目 | 内容 |
|---|---|
| 功能名称 | 右侧栏上下文面板与 Wiki 关联 |
| 优先级 | P0 |
| 功能使用者 | WorkKnowlage 桌面端用户 |
| 入口位置 | 编辑器右侧栏 |
| 前置条件 | 用户已打开一个文档；应用已加载当前 workspace 的文档、文件夹、标签、引用和内容快照 |
| 相关模块 | App-level association orchestration、RightSidebar、document mentions、workspace documents、block navigation |
| 相关文件 | `src/app/useSidebarAssociations.ts`、`src/shared/lib/sidebarAssociations.ts`、`src/features/shell/RightSidebar.tsx`、`src/shared/lib/outgoingMentions.ts` |

## 2. 功能列表

| 序号 | 功能点 | 功能描述 | 优先级 |
|---:|---|---|---|
| 1 | 属性 / Wiki tab | 右侧栏提供属性与 Wiki 两种查看模式，区分文档自身状态和知识库关系 | P0 |
| 2 | 属性模式 | 展示当前文档标签、文稿脉络和基础状态 | P0 |
| 3 | Wiki 命中角标 | 当 Wiki 模式存在可查看命中时，在 Wiki tab 上显示角标 | P0 |
| 4 | 显式引用 | 展示当前文档的出链、反向链接和文档提及 | P0 |
| 5 | 关联文档 | 按目标文档聚合主题相似、局部相似、原文命中三类证据 | P0 |
| 6 | 证据标签与数量 | 关联文档卡片显示 `主题相似`、`局部相似`、`原文命中` 标签和证据数量摘要 | P0 |
| 7 | 证据预览与定位 | hover 关联文档时展示相似证据和原文证据；点击证据定位到目标块 | P0 |
| 8 | 空状态 | 属性、显式引用、关联文档分别有独立空状态 | P0 |
| 9 | 派生数据缓存 | 关联结果由 app-level hook 准备和缓存，RightSidebar 不在 render flow 中做昂贵派生 | P0 |

## 3. 流程说明与流程图

右侧栏上下文面板服务两个不同用户目标：一是查看当前文档本身的属性和结构；二是查看当前文档与知识库中其他文档的关系。属性模式不能被关联结果挤占，Wiki 模式也不能退化成普通搜索结果。系统应通过 tab 区分这两类任务，并通过 Wiki tab 角标提醒用户当前文档存在可查看的关系线索。

### 3.1 主流程：查看 Wiki 关联

用户打开一个文档后，右侧栏默认展示属性模式。系统在后台根据当前文档、同 workspace 文档、文件夹、显式引用和内容块派生 Wiki 关联状态。如果存在显式引用或关联文档，Wiki tab 显示角标。用户点击 Wiki tab 后，系统展示两层关系：显式引用优先，其次是关联文档。关联文档卡片按目标文档聚合主题相似、局部相似和原文命中证据；用户点击卡片打开目标文档，hover 卡片查看证据，点击证据时定位到命中块。

```mermaid
flowchart LR
    OpenDoc["用户打开文档"] --> Properties["右侧栏默认显示属性模式"]
    OpenDoc --> Derive["系统派生 Wiki 关联状态"]
    Derive --> HasHits{"是否存在关联命中?"}
    HasHits -->|是| Badge["Wiki tab 显示角标"]
    HasHits -->|否| NoBadge["Wiki tab 不显示角标"]
    Badge --> ClickWiki["用户点击 Wiki tab"]
    NoBadge --> ClickWiki
    ClickWiki --> Groups["展示显式引用 / 关联文档"]
    Groups --> OpenDoc["点击关联文档打开目标文档"]
    Groups --> HoverEvidence["hover 关联文档查看证据"]
    HoverEvidence --> OpenTarget["点击证据打开命中位置"]
```

### 3.2 分支流程：属性模式查看与返回

用户需要查看当前文档本身时，停留在属性 tab。属性模式展示标签、目录和基础状态，不展示大量关联结果。即使用户在属性模式下，Wiki tab 角标仍应保留，让用户知道当前文档存在知识关联。用户可以随时切回 Wiki，也可以从 Wiki 切回属性，切换不应丢失当前文档选择和编辑状态。

```mermaid
flowchart LR
    Sidebar["右侧栏"] --> SelectProperties["用户选择属性 tab"]
    SelectProperties --> ShowProps["展示标签 / 文稿脉络 / 基础状态"]
    ShowProps --> HasWiki{"Wiki 是否有命中?"}
    HasWiki -->|是| KeepBadge["Wiki tab 保留角标"]
    HasWiki -->|否| PlainTab["Wiki tab 无角标"]
    KeepBadge --> SwitchWiki["用户可切换到 Wiki"]
    PlainTab --> SwitchWiki
```

### 3.3 分支流程：关联文档证据聚合

当当前文档和目标文档同时存在语义相似、局部相似或短句原文命中时，系统不应把它们拆成多个彼此竞争的列表。系统应先按目标文档聚合，再把证据分成 `主题相似`、`局部相似`、`原文命中`。短句、标题式短语或关键句命中仍然是证据层，不直接冒充语义相似；但它们应和同一目标文档的相似证据放在一起，帮助用户理解“为什么这个文档相关”。

```mermaid
flowchart LR
    Semantic["主题相似 / 局部相似"] --> Group["按目标文档聚合"]
    Exact["短句 / 标题式短语 / 关键句原文命中"] --> Group
    Group --> Card["展示关联文档卡片"]
    Card --> Badges["显示证据标签和数量"]
    Card --> Hover["hover 展开证据"]
    Hover --> Locate["点击证据定位命中块"]
```

### 3.4 分支流程：无关联或数据异常

当当前文档没有可用关联时，Wiki tab 不显示角标，Wiki 模式内展示显式引用和关联文档的空状态。关联派生失败或内容无法解析时，不应影响文档编辑；系统应降级为空结果或局部结果，并避免在右侧栏显示误导性推荐。

```mermaid
flowchart LR
    Derive["系统派生关联"] --> Result{"派生是否成功?"}
    Result -->|成功但无命中| Empty["Wiki tab 无角标，展示空状态"]
    Result -->|部分成功| Partial["展示可用分组，失败分组为空状态"]
    Result -->|失败| Fallback["降级为空结果，不阻塞编辑"]
```

## 4. 特殊业务

1. 右侧栏不是单纯文档属性面板，应同时支持文档属性和 Wiki 关联两种任务。
2. Wiki 关联不等同于搜索结果列表。短句原文命中、标题式短语命中和关键句命中应归入关联文档的原文证据，不应直接冒充语义相似。
3. 相关主题、局部相似和原文命中是同一目标文档下的证据类型，不应在右侧栏拆成互相割裂的主列表。
4. 显式引用来自用户内容和真实文档提及，优先级高于派生关联。
5. Wiki tab 角标用于提示“有可查看的关联命中”，不是搜索命中总量的完整统计。
6. 关联结果只在当前 workspace 内派生，不跨 workspace 混合展示。
7. RightSidebar 只消费 prepared association state，不在 React render flow 中做昂贵派生。
8. 原文证据需要可点击回到目标文档和命中位置，否则证据价值不足。

## 5. 页面 / 状态说明

| 页面 / 状态 | 说明 | 可用操作 |
|---|---|---|
| 右侧栏 - 属性 tab | 默认查看当前文档自身状态 | 查看标签、添加标签、删除标签、查看目录、点击目录定位 |
| 右侧栏 - Wiki tab | 查看当前文档与知识库关系 | 查看显式引用、关联文档和证据，点击打开目标 |
| Wiki tab 有角标 | 存在显式引用或关联文档 | 点击 Wiki tab 查看详情 |
| Wiki tab 无角标 | 当前无可查看关联命中 | 点击 Wiki tab 查看空状态 |
| 显式引用有结果 | 当前文档存在出链或反链 | 点击打开来源或目标文档 |
| 关联文档有结果 | 当前文档存在语义相关、局部相似或原文命中的目标文档 | 点击打开目标文档；hover 查看证据 |
| 证据预览有结果 | 关联文档存在相似证据或原文证据 | 点击证据打开目标文档并定位命中块 |
| 关联派生失败 | 关联数据无法完整生成 | 编辑不受阻塞，展示空结果或局部结果 |

## 6. 查询条件

本功能无用户输入查询条件。关联数据由当前文档和当前 workspace 内容自动派生。

| 字段 | 类型 | 内容 | 默认值 | 查询精度 | 查询规则 |
|---|---|---|---|---|---|
| 当前文档 | 系统上下文 | activeDocument | 当前选中文档 | 精确 | 只基于当前打开文档派生 |
| 当前 workspace | 系统上下文 | activeDocument.spaceId | 当前空间 | 精确 | 只匹配同 workspace 文档 |
| 当前大纲焦点 | 系统上下文 | focusedOutlineItemId | null | 精确 | 用于局部相似块或后续聚焦关联 |

## 7. 列表字段 / 状态字段

| 字段 | 内容 | 对齐 | 固定 | 排序 | 显示规则 |
|---|---|---|---|---|---|
| Tab 名称 | 属性 / Wiki | 居中 | 是 | 否 | 始终展示 |
| Wiki 角标 | 关联命中聚合数量 | 居中 | 否 | 否 | 数量大于 0 时展示；为 0 时隐藏；超过 9 时显示 `9+` |
| 显式引用标题 | 来源或目标文档标题 | 靠左 | 否 | 可按更新时间或关系顺序 | 长标题截断或换行，不能挤压图标 |
| 关联文档标题 | 目标文档标题 | 靠左 | 否 | 按最高分、是否有原文证据、证据数量排序 | 标题点击打开目标文档 |
| 证据标签 | 主题相似 / 局部相似 / 原文命中 | 靠左 | 否 | 否 | 展示在关联文档卡片内，可多标签并存 |
| 证据数量摘要 | `N 处相似` / `N 条线索` | 靠左 | 否 | 否 | 同一目标文档下聚合展示 |
| 相似证据 | 相似块标题、片段、searchText | 靠左 | 否 | 按证据强度排序 | hover 关联文档时展示，点击定位块 |
| 原文证据 | 命中原因、matchedText、snippet | 靠左 | 否 | 按证据强度排序 | hover 关联文档时展示，点击定位块 |

## 8. 表单字段

属性 tab 中保留当前标签添加输入。

| 字段 | 类型 | 内容 | 默认值 | 格式规则 |
|---|---|---|---|---|
| 标签输入 | 文本输入 | 用户要添加到当前文档的标签 | 空 | 为空时不提交；未输入 `#` 时系统可自动补齐 |

## 9. 交互说明

| 交互 | 说明 |
|---|---|
| 页面加载 | 右侧栏默认展示属性 tab，并触发或读取 prepared association state |
| 点击属性 tab | 展示标签、文稿脉络和基础状态 |
| 点击 Wiki tab | 展示显式引用和关联文档 |
| Wiki 角标展示 | 当聚合命中数量大于 0 时展示；超过 9 时显示 `9+`；不需要用户展开 Wiki 才能看到 |
| 点击显式引用 | 打开来源或目标文档；有 blockId 时定位到块 |
| 点击关联文档 | 打开目标文档，不强制跳转到某条证据 |
| hover 关联文档 | 展示相似证据和原文证据，不能遮挡主编辑区关键内容 |
| 点击相似证据 | 打开目标文档并定位到相似块；必要时使用 searchText 辅助定位 |
| 点击原文证据 | 打开目标文档并定位到命中块；必要时使用 fallbackText 辅助定位 |
| 切换文档 | 清理当前 tab 内 hover 状态，重新读取新文档关联状态 |
| 添加标签 | 仍在属性 tab 内完成，不进入 Wiki tab |

## 10. 提示说明

| 场景 | 提示类型 | 提示文本 |
|---|---|---|
| 属性无标签 | 空状态 | 暂无标签 |
| 属性无大纲 | 空状态 | 暂无大纲内容 |
| Wiki 无显式引用 | 空状态 | 当前文稿还没有引用或提及 |
| Wiki 无关联文档 | 空状态 | 暂未发现关联文档 |
| Wiki 聚焦区块无关联文档 | 空状态 | 当前区块暂无关联文档 |
| 未选择文档 | 空状态 | 请选择文稿以查看知识关联 |
| 原文证据原因 | 行内说明 | 命中关键句 / 命中短语 / 命中标题式表达 |

## 11. 异常处理

| 异常场景 | 系统处理 | 用户反馈 | 是否阻塞 |
|---|---|---|---|
| 当前文档为空 | 返回空 association state | 显示未选择或空状态 | 否 |
| contentJson 解析失败 | 跳过异常文档或降级为空候选 | 不显示错误推荐 | 否 |
| 目标文档已删除 | 不展示或禁用该关联结果 | 结果不可点击或不出现 | 否 |
| 目标块不存在 | 打开目标文档，使用 fallbackText 尝试定位 | 不弹错误，保持文档可读 | 否 |
| 关联派生耗时 | 使用缓存或异步更新 | 保持当前 UI，更新后刷新角标 | 否 |
| 命中数量过多 | 证据限制数量并排序 | 角标显示聚合数量或上限 | 否 |

## 12. 数据记录

| 数据项 | 来源 | 存储位置 | 用途 |
|---|---|---|---|
| activeDocument | workspace session | React state | 派生当前文档属性和 Wiki 关联 |
| documents | workspace snapshot | React state / SQLite repository | 同 workspace 关联候选 |
| folders | workspace snapshot | React state / SQLite repository | 显示路径和上下文 |
| outgoing mentions | contentJson 解析 | derived association state | 显式出链 |
| incoming backlinks | SQLite backlinks / document record | DocumentRecord.backlinks | 显式反链 |
| relatedDocuments / similarBlocks | association derivation | prepared association state | 作为关联文档的相似证据来源 |
| textEvidence | association derivation | prepared association state | 作为关联文档的原文证据来源 |
| associatedDocuments | association derivation | prepared association state | RightSidebar 的关联文档展示模型 |
| wikiAssociationCount | association summary | prepared association state | Wiki tab 角标 |
| focusedOutlineItemId | right sidebar interaction | React state | 局部块关联或目录定位 |

## 13. 权限与边界

1. 当前版本只在本地 workspace 内派生关联，不跨空间展示。
2. 当前版本不引入远程 AI、云端索引或联网语义服务。
3. 当前版本的相似证据可先使用本地确定性规则，未来可替换或增强为 embedding / AI 检索。
4. 原文命中只作为关联文档证据层，不作为相关主题主排序的直接替代。
5. Wiki 角标只表示有可查看关联，不承诺代表完整搜索命中数量。
6. 本功能不改变左侧栏搜索能力，也不替代全文搜索。

## 14. 验收标准

1. 右侧栏展示属性 / Wiki 两个 tab。
2. 属性 tab 保留标签和文稿脉络能力。
3. Wiki tab 存在显式引用或关联文档时，tab 角标可见。
4. Wiki tab 无任何命中时，角标隐藏。
5. Wiki tab 内按显式引用、关联文档分层展示。
6. 同一目标文档同时存在相似证据和原文证据时，只展示一张关联文档卡片。
7. 短句原文命中长段落时，结果进入关联文档的原文证据，不直接污染相似证据。
8. 点击显式引用或关联文档可以打开目标文档。
9. 证据带 blockId 时，点击后尽量定位到命中块。
10. 关联派生只匹配同 workspace 文档。
11. RightSidebar 不在 render flow 中执行昂贵关联派生。
12. 相关单元测试覆盖 text evidence、semantic related topics、associatedDocuments 聚合、badge count、tab rendering 和点击定位。

## 15. 决策与待确认问题

### 15.1 已决策

1. Wiki 角标显示聚合数量，而不是只显示圆点。聚合数量来自显式引用和关联文档的去重后可查看命中。
2. Wiki 角标数量需要上限显示。`1` 到 `9` 显示具体数字，超过 9 显示 `9+`，避免角标挤压 tab。
3. 当前版本默认 tab 保持属性 tab。这样不打断用户对标签和文稿脉络的既有使用习惯；Wiki tab 通过角标提示用户有可查看关联。
4. 当前版本不引入 embedding / AI 检索。相似证据先使用本地确定性规则；未来如引入 embedding / AI，应单独进入智能辅助或语义检索专项需求。
5. 当前版本不支持把原文证据手动确认为正式 wiki 关系。原文证据只作为证据层；后续如果需要“确认关系”能力，应作为关系管理功能单独设计。
6. 当前版本右侧栏不再把相关主题和原文线索拆成两个主列表；二者统一进入关联文档卡片的证据预览。

### 15.2 待确认

当前版本无阻塞实现的待确认问题。

## 16. 变更记录

| 版本 | 作者 | 修订内容 | 日期 |
|---|---|---|---|
| v0.1 | Codex | 初稿，按单功能规格模板整理右侧栏上下文面板与 Wiki 关联需求 | 2026-05-15 |
| v0.2 | Codex | 明确 Wiki 角标、默认 tab、AI 检索和原文线索确认关系的当前版本决策 | 2026-05-15 |
| v0.3 | Codex | 将相关主题和原文线索收敛为关联文档下的相似证据与原文证据 | 2026-05-15 |
