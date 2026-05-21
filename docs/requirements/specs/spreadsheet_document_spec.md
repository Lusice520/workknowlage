# Spreadsheet 文档类型 单功能需求规格说明书

> 文档元信息
> - 版本：v0.1 草稿
> - Owner：Lusice
> - 作者：Codex
> - 最后更新：2026-05-20
> - 所属 PRD：`../PRD.md`
> - 功能路径：`文档编辑器 / Spreadsheet 文档类型`
> - 状态：ready-for-implementation

---

## 1. 功能概览

| 项目 | 内容 |
|---|---|
| 功能名称 | Spreadsheet 文档类型 |
| 优先级 | P0 |
| 功能使用者 | WorkKnowlage 本地知识库用户 |
| 入口位置 | 左侧目录树根目录、文件夹、文档的“新建”菜单 |
| 前置条件 | 用户已进入某个空间 |
| 相关模块 | 文档树、中心编辑区、SQLite 持久化、搜索、导出 |
| 相关文件 | `documents`、`document_spreadsheets`、中心编辑器路由、Univer Sheets 集成 |

## 2. 功能列表

| 序号 | 功能点 | 功能描述 | 优先级 |
|---:|---|---|---|
| 1 | 新建 Excel | 在目录树中新建独立 Spreadsheet 文档 | P0 |
| 2 | 表格编辑 | 打开 Spreadsheet 文档后展示在线 Excel 风格编辑器 | P0 |
| 3 | 自动保存 | 用户编辑单元格后自动保存到本地 SQLite | P0 |
| 4 | 文档类型区分 | 普通文档和 Spreadsheet 使用不同图标与中心编辑器 | P0 |
| 5 | 基础管理 | Spreadsheet 支持移动、重命名、删除、恢复、收藏等通用文档能力 | P0 |
| 6 | 导出 Excel | 将 Spreadsheet 文档导出为 `.xlsx` 文件 | P0 |
| 7 | 后续导入 | `.xlsx` 导入作为后续增强 | P1 |

### 2.1 背景与目标

WorkKnowlage 当前以 Markdown/BlockNote 类文档为主，富表格只能作为正文块存在。用户有类似在线 Excel 的表格编辑需求，需要在知识库中创建独立表格文档，而不是把表格塞进普通文档正文。该功能目标是让项目清单、数据对比、排期、预算、验收矩阵等结构化内容可以作为一等资料被创建、管理和本地保存。

### 2.2 方案取舍

| 方案 | 内容 | 结论 | 原因 |
|---|---|---|---|
| 扩展富表格块 | 在 BlockNote 文档内增强现有 richTable | 不采用 | 仍是正文块，不适合完整在线 Excel 工作流 |
| Spreadsheet 独立文档类型 | 文档树条目区分 `note` 与 `spreadsheet`，中心区按类型打开不同编辑器 | 采用 | 贴合用户“新建 Excel”的入口需求，也便于保存、导出和后续扩展 |
| Excel 附件模式 | 上传 `.xlsx` 作为附件，应用内预览或外部打开 | 后续 | 解决文件管理，不解决应用内在线编辑 |

### 2.3 产品形态与范围边界

第一版提供独立 Spreadsheet 文档类型。用户从新建菜单创建“新建 Excel”后，目录树出现“无标题表格”，点击后中心区进入 Spreadsheet 编辑界面。第一版聚焦可编辑、可保存、可重开和导出 `.xlsx`，不承诺完整 Excel 文件导入、多人协作、云同步、复杂权限、分享和打印。

技术方向采用 Univer Sheets 作为在线 Excel 风格编辑器。WorkKnowlage 继续保留 Electron、React、TypeScript、Vite 和 SQLite，本功能只新增 Spreadsheet 编辑器层和对应本地数据模型。

## 3. 流程说明与流程图

### 3.1 主流程：新建并编辑 Spreadsheet

用户在目录树中希望新增一个电子表格资料时，点击“新建 Excel”。系统创建带有 `spreadsheet` 类型的文档记录，并初始化一个空 workbook。创建成功后中心区打开 Spreadsheet 编辑器，用户直接编辑单元格，系统按防抖策略自动保存。关闭并重开后，表格内容应恢复。

```mermaid
flowchart LR
    A["用户点击新建 Excel"] --> B["创建 spreadsheet 文档记录"]
    B --> C["初始化 workbook_json"]
    C --> D["打开 Spreadsheet 编辑器"]
    D --> E["用户编辑单元格"]
    E --> F["自动保存 workbook_json"]
    F --> G["重开后恢复表格内容"]
```

### 3.2 分支流程：打开不同文档类型

用户点击目录树条目时，系统根据文档类型决定中心区编辑器。普通文档继续打开 BlockNote；Spreadsheet 文档打开 Univer Sheets；未知类型降级为不可编辑提示，避免错误地覆盖内容。

```mermaid
flowchart LR
    A["用户点击文档"] --> B{"读取 document_kind"}
    B -->|"note"| C["打开 BlockNote 编辑器"]
    B -->|"spreadsheet"| D["打开 Spreadsheet 编辑器"]
    B -->|"未知"| E["展示暂不支持提示"]
```

## 4. 特殊业务

1. Spreadsheet 是文档树中的一等文档，不是附件。
2. Spreadsheet 的树操作复用普通文档的移动、删除、恢复、重命名和收藏能力。
3. Spreadsheet 内容不写入 BlockNote `content_json`，避免影响普通文档解析。
4. 第一版只支持 Spreadsheet 的 `.xlsx` 导出，不复用普通文稿的 Markdown、Word、PDF 导出，也不提供 Spreadsheet 分享入口。
5. Spreadsheet 导出必须读取 `document_spreadsheets.workbook_json`，不得把 workbook JSON 写入普通文稿 `content_json`。

## 5. 页面 / 状态说明

| 页面 / 状态 | 说明 | 可用操作 |
|---|---|---|
| 目录树菜单 | 新建菜单包含新建文件、新建 Excel、新建文件夹 | 创建对应条目 |
| Spreadsheet 编辑态 | 中心区显示在线 Excel 风格表格；标题与更新时间使用紧凑头部，优先把垂直空间让给表格画布 | 编辑单元格、自动保存、收藏、重命名 |
| 保存中 | 用户编辑后等待自动保存 | 继续编辑 |
| 保存失败 | 本地写入失败 | 保留当前编辑状态，提示保存失败 |
| 导出 Excel | Spreadsheet 文档导出菜单只显示导出 Excel | 生成 `.xlsx` 文件 |

## 6. 查询条件

本功能无独立查询条件。

## 7. 列表字段 / 状态字段

| 字段 | 内容 | 对齐 | 固定 | 排序 | 显示规则 |
|---|---|---|---|---|---|
| document_kind | 文档类型 | 左 | 否 | 否 | 用于选择图标和编辑器，不作为用户主字段展示 |
| title | 表格标题 | 左 | 否 | 复用现有排序 | 默认 `无标题表格` |

## 8. 表单字段

| 字段 | 类型 | 内容 | 默认值 | 格式规则 |
|---|---|---|---|---|
| title | 文本 | Spreadsheet 文档标题 | `无标题表格` | 复用现有文档重命名规则 |
| workbook_json | JSON 文本 | Univer workbook snapshot | 空 workbook | 必须是可解析 JSON，保存失败不得覆盖旧值 |

## 9. 交互说明

| 交互 | 说明 |
|---|---|
| 页面加载 | 读取文档类型，Spreadsheet 类型加载 workbook 后挂载 Univer |
| 顶部信息区 | Spreadsheet 文档不复用普通文稿的大段标题区；仅保留紧凑标题、更新时间、类型标签和保存/收藏状态 |
| 提交 | 无手动提交，采用自动保存 |
| 取消 / 关闭 | 离开文档前保留最后一次成功保存；保存失败时给出状态反馈 |
| 导出 Excel | 导出前先保存当前 workbook snapshot，再生成 `.xlsx` 文件；Spreadsheet 不显示 Markdown、PDF、Word 导出项 |
| 分享 | Spreadsheet 文档不显示分享入口，不创建分享链接 |
| 重命名 | 复用目录树 inline rename |
| 删除 | 复用废纸篓流程，删除文档时 workbook 随文档清理 |

## 10. 提示说明

| 场景 | 提示类型 | 提示文本 |
|---|---|---|
| 新建成功 | 轻提示 | 新建 Excel |
| 自动保存成功 | 状态 | 已自动保存 |
| 自动保存中 | 状态 | 正在保存 |
| 自动保存失败 | 错误 | 保存失败 |
| 导出 Excel 成功 | 状态 | Excel 已导出 |
| 导出 Excel 失败 | 错误 | Excel 导出失败：原因 |

## 11. 异常处理

| 异常场景 | 系统处理 | 用户反馈 | 是否阻塞 |
|---|---|---|---|
| workbook_json 解析失败 | 不覆盖原始数据，展示空态或错误态 | 表格内容加载失败 | 是 |
| 保存失败 | 保留当前编辑器状态，不更新 last saved snapshot | 保存失败 | 否 |
| 未知 document_kind | 不进入 BlockNote 保存链路 | 当前文档类型暂不支持 | 是 |
| migration 失败 | 停止启动或报错，不静默改写数据 | 数据初始化失败 | 是 |

## 12. 数据记录

| 数据项 | 来源 | 存储位置 | 用途 |
|---|---|---|---|
| document_kind | 新建菜单 / migration 默认 | `documents.document_kind` | 区分普通文档和 Spreadsheet |
| workbook_json | Spreadsheet 编辑器 snapshot | `document_spreadsheets.workbook_json` | 保存表格内容 |
| updated_at | 保存动作 | `document_spreadsheets.updated_at`、`documents.updated_at` | 排序、状态展示、同步搜索索引 |

## 13. 权限与边界

1. 本阶段只支持本地单用户编辑。
2. 不提供云协作、多人同时编辑、权限分享或 Spreadsheet 分享。
3. `.xlsx` 导出优先保证单元格值和多 sheet 基础结构，不承诺完整样式、公式、图表、筛选、冻结窗格等 Excel 高级特性。
4. 不把 Spreadsheet 内容混入普通文档正文。

## 14. 验收标准

1. 用户可以从根目录、文件夹或文档的新建菜单创建 Spreadsheet 文档。
2. Spreadsheet 文档在目录树中使用与普通文档不同的图标或可识别状态。
3. 点击普通文档仍打开原 BlockNote 编辑器。
4. 点击 Spreadsheet 文档打开在线 Excel 风格编辑器。
5. 编辑单元格后自动保存，重开应用或切换文档后内容不丢失。
6. 现有普通文档 migration 后仍可打开、编辑、搜索和导出。
7. Spreadsheet 文档不展示当前不支持的 Markdown、Word、PDF 导出项，只提供 Excel 导出。
8. 数据库 migration 有回归测试覆盖。
9. Spreadsheet 文档顶部信息区不得占用大块空白；表格画布应在首屏中尽早出现，右侧文稿概览栏不展示。
10. Spreadsheet 文档不显示分享入口，也不会创建分享链接。
11. Spreadsheet 文档导出 `.xlsx` 前会保存当前 workbook snapshot，导出的文件可被 Excel / Numbers / WPS 识别为工作簿。

## 15. 待确认问题

本功能当前无阻塞待确认问题。第一版默认使用“新建 Excel”作为菜单文案，默认标题为“无标题表格”，`.xlsx` 导入作为后续增强。

## 16. 变更记录

| 版本 | 作者 | 修订内容 | 日期 |
|---|---|---|---|
| v0.1 | Codex | 初稿 | 2026-05-19 |
