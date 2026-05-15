# Issue Tracker: Local Markdown

这个 repo 的需求文档和需求开发 issues 都写成本地 markdown，放在可见的 `docs/requirements/`。

## Conventions

- 项目级 PRD：`docs/requirements/PRD.md`
- 单功能规格：`docs/requirements/specs/<feature_name>_spec.md`
- 单功能规格模板：`docs/requirements/specs/SPEC_TEMPLATE.md`
- 需求开发 issue：`docs/requirements/issues/<NN>-<slug>.md`
- Triage state 写在每个 issue 文件顶部附近的 `Status:` 行。
- Comments 和 conversation history 追加到文件底部 `## Comments` 区域。

## When a Skill Says "Publish to the Issue Tracker"

在 `docs/requirements/issues/` 下创建新文件，目录不存在时先创建目录。

## When a Skill Says "Fetch the Relevant Ticket"

读取用户给出的 path 或 issue number 对应的本地 markdown 文件。
