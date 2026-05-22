# WorkKnowlage Agent Instructions

WorkKnowlage 使用全局 Lusice collaboration system，并叠加本项目自己的 project execution system：`docs/agents/`。

## Agent skills

### Issue tracker

Issues are tracked as local markdown when needed; PRD and SPEC source-of-truth files live under `docs/requirements/`. Temporary agent drafts may use `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default mattpocock/skills five-state vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain documentation layout. See `docs/agents/domain.md`.

## Project execution system

开始项目工作前采用分层读取，避免默认全量加载。先读最小入口，再按任务触发扩展。

最小入口：

- `docs/agents/task-routing.md`
- 与当前任务直接相关的 PRD / SPEC、代码和测试

按触发条件扩展：

- 需要产品/领域定位时，读 `docs/agents/project-profile.md`
- 需要找代码位置时，读 `docs/agents/source-map.md`
- 需要发布、打包或质量门时，读 `docs/agents/quality-gates.md`
- 出现历史问题、回归或用户纠偏时，读 `docs/agents/memory/project-lessons.md`

涉及专项工作时，再读取：

- `docs/agents/rules/architecture.md`
- `docs/agents/rules/testing.md`
- `docs/agents/rules/ui-ux.md`
- `docs/agents/rules/data-persistence.md`
- `docs/agents/rules/editor-and-blocknote.md`
- `docs/agents/subagents/delegation-policy.md`
