# WorkKnowlage Agent Instructions

WorkKnowlage 使用全局 Lusice collaboration system，并叠加本项目自己的 project execution system：`docs/agents/`。

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown files under `.scratch/`, not GitHub or GitLab. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default mattpocock/skills five-state vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain documentation layout. See `docs/agents/domain.md`.

## Project execution system

开始重要项目工作前，先读取相关项目文件：

- `docs/agents/project-profile.md`
- `docs/agents/source-map.md`
- `docs/agents/task-routing.md`
- `docs/agents/quality-gates.md`
- `docs/agents/memory/project-lessons.md`

涉及专项工作时，再读取：

- `docs/agents/rules/architecture.md`
- `docs/agents/rules/testing.md`
- `docs/agents/rules/ui-ux.md`
- `docs/agents/rules/data-persistence.md`
- `docs/agents/rules/editor-and-blocknote.md`
- `docs/agents/subagents/delegation-policy.md`
