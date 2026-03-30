# Sidebar Quick Notes Design

**Goal**

在左侧栏底部把当前静态月历升级成“真实日期入口 + 当日快记”模块。快记按 `space + date` 独立存储，不进入文件树，编辑体验复用现有 BlockNote。

**Product Shape**

- 月历支持真实切月和选日。
- 当前日期可通过日历图标快速回到今天。
- 选中日期后，在月历下方显示“当日快记”编辑区。
- 快记是当前工作空间内该日期唯一的一条记录。
- 当月存在快记的日期显示提示点。

**Why Separate From Documents**

- 快记是轻量、日期驱动的捕捉，不应该污染文档树、分享、标签和正式知识库语义。
- 未来如果需要“沉淀为文档”，可以从独立模型向文档导出，而不是一开始就耦合。

**Data Model**

新增 `quick_notes` 表：

- `id`
- `space_id`
- `note_date`
- `title`
- `content_json`
- `created_at`
- `updated_at`

约束：

- `space_id + note_date` 唯一
- `space_id` 外键指向 `spaces`

**API Shape**

新增 `quickNotes` API：

- `get(spaceId, noteDate)` 读取单日快记
- `upsert({ spaceId, noteDate, title, contentJson })` 自动创建或更新
- `listMonth(spaceId, monthKey)` 返回当月已有快记的日期摘要，用于月历打点

**UI Composition**

- `LeftSidebar` 负责月历状态、当前选中日期、快记读取与保存。
- 快记编辑区使用紧凑版 `SharedBlockNoteSurface`，不显示文档页级工具条。
- 本期不实现快记分享，不进入右侧目录，不接文件上传专用链路。

**Out of Scope**

- 快记进入文件树
- 快记分享
- 快记搜索
- 快记附件独立上传通道
- 快记与正式文档互转
