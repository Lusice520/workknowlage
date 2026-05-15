# Data Persistence Rules

- 把本地用户数据视为 high risk。
- 修改 database schema、repositories、migrations、import/export 或 document content storage 前，先检查当前 persistence paths。
- 优先 backward-compatible migrations。
- 对 repository behavior 和 migration-sensitive changes 添加测试。
- 不要静默 drop 或 rewrite 用户内容。
- final answer 中说明 remaining data safety risk。
