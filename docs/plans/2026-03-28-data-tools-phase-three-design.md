# Data Tools Phase Three Design

**Goal**

把当前“只展示存储状态”的设置面板升级成真正可执行的数据工具中心，让本地知识库具备可备份、可恢复、可诊断、可清理的基础可信度。

**Scope**

本期只做 `数据工具闭环`：

- 打开数据目录
- 创建备份
- 从备份恢复
- 重建搜索索引
- 清理孤儿附件

本期明确不做：

- 回收站
- 软删除
- 合并导入
- 云同步
- zip/云端发布格式

**Current Problem**

- 设置面板现在只显示存储路径和最近写入信息，不能执行数据维护动作。
- 搜索索引虽然已有后端 `rebuild` 能力，但前端没有显式入口。
- 附件只有上传链路，没有清理链路；文档硬删除后，`uploads/<documentId>/...` 目录会残留。
- 目前没有备份/恢复能力，用户只能手动找 SQLite 文件和上传目录，风险很高。

**Decision**

本期采用 `物理快照备份目录`，不做 zip，不做逻辑 JSON 导出。

- 备份产物是一个备份目录：
  - `manifest.json`
  - `workknowlage.db`
  - `workknowlage.db-wal`（如存在）
  - `workknowlage.db-shm`（如存在）
  - `uploads/`
- 恢复策略是 `整包替换当前本地数据`，不是 merge。
- 恢复完成后重新初始化数据库并重建搜索索引。

**Why This Approach**

- 当前持久化本来就是 `SQLite + uploads/`，按真实数据结构备份最稳。
- 不需要引入压缩依赖，也不需要解决逻辑导入的关系修复问题。
- 与现在 Electron 主进程的能力边界一致，风险和实现成本都更可控。

**Product Design**

设置面板新增 `数据工具` 区块，展示两类内容：

1. 状态信息
- 当前存储类型
- 最近写入时间
- 数据目录路径
- 最近一次数据工具执行反馈

2. 可执行动作
- `打开数据目录`
- `创建备份`
- `从备份恢复`
- `重建搜索索引`
- `清理孤儿附件`

动作反馈统一显示在设置面板内，不额外引入全局 toast 系统。

**Interaction Design**

`打开数据目录`
- 直接调用系统打开当前 `userData` 目录。

`创建备份`
- 用户选择一个目标目录。
- 应用在目标目录下创建带时间戳的备份文件夹。
- 写入 manifest，并复制数据库文件与 `uploads/`。
- 成功后反馈备份位置。

`从备份恢复`
- 用户选择一个备份目录。
- 应用校验 manifest 与必要文件。
- 提示这是“整包覆盖当前本地数据”的恢复动作。
- 关闭当前数据库，替换数据库与 `uploads/`，重新初始化数据库，重建索引。
- 完成后刷新应用状态并反馈结果。

`重建搜索索引`
- 调用现有 `searchRepo.rebuildWorkspaceSearchIndex()`。
- 返回成功提示。

`清理孤儿附件`
- 扫描 `uploads/` 下所有文档目录。
- 删除两类文件：
  - 所属文档已不存在
  - 文档仍存在，但文件不再被文档 `contentJson` 引用
- 返回删除文件数、删除目录数、释放空间。

**Technical Design**

新增一个 Electron 主进程维护层模块，负责：

- 选择目录
- 打开目录
- 备份创建
- 备份恢复
- 附件清理

保留 `searchRepo.rebuildWorkspaceSearchIndex()` 作为索引重建核心逻辑。

建议新增：

- `electron/maintenance/dataTools.cjs`

由它组合：

- `electron/db/index.cjs`
- `electron/uploads/storage.cjs`
- `electron/db/repositories/search.cjs`

**Data Model**

新增前端可见类型：

- `DataToolFeedbackRecord`
- `BackupManifestRecord`
- `BackupResultRecord`
- `RestoreResultRecord`
- `AttachmentCleanupResultRecord`

manifest 至少记录：

- app version
- createdAt
- backup format version
- db file names
- upload directory included
- source storage path

**Restore Safety**

恢复流程必须考虑 SQLite `WAL` 模式：

- 不能只替换 `workknowlage.db`
- 必须在恢复前关闭当前 DB
- 恢复后重新打开 DB

恢复只支持 `全量替换`，不支持合并导入。

**Error Handling**

- 目标目录未选择：静默返回，不报错
- 备份目录无效：设置面板反馈“备份结构不完整”
- 文件复制失败：保留原数据，反馈失败原因
- 附件清理过程中单个文件失败：继续处理其他文件，并汇总错误数

**Testing Strategy**

1. Node/Electron smoke
- 备份目录生成成功
- 恢复后数据库与上传文件重新可读

2. Maintenance unit / integration
- 搜索重建动作可调用
- 孤儿附件能被识别和删除
- 被文档引用的附件不会误删

3. React UI
- 设置面板出现新的数据工具动作
- 点击动作后能显示执行反馈
- 恢复动作有明确确认文案

**Out of Scope Follow-up**

下一期再做：

- 回收站
- 软删除
- 删除恢复
- 版本化快照
- 历史备份列表
