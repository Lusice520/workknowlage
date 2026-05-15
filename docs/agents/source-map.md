# Source Map

开始工作前，用这张地图找到正确上下文。

## Product and Planning

- `README.md`：产品定位、roadmap、高层 feature status。
- `docs/plans/`：历史 design、implementation、verification plans。
- `docs/releases/`：release notes 和已交付能力总结。
- `docs/requirements/PRD_TEMPLATE.md`：项目级 PRD 模板。
- `docs/requirements/PRD.md`：WorkKnowlage 当前 PRD 成品案例，负责产品定位、流程、系统概述、范围、模块、里程碑和风险。
- `docs/requirements/specs/SPEC_TEMPLATE.md`：单功能 SPEC 模板。
- `docs/requirements/specs/local_share_spec.md`：本地分享单功能 SPEC 成品案例。
- `docs/requirements/specs/`：单功能需求规格说明书目录，负责流程、字段、状态、交互、异常、数据记录和验收标准。
- `docs/requirements/issues/`：需求开发 issue 的本地 markdown 目录；目录不存在时按需创建。
- `.scratch/`：仅用于临时草稿或不需要用户直接管理的 agent 工作文件。
- `docs/agents/rules/requirements-docs.md`：PRD / SPEC / issue 的需求文档分层规则。

## Application Code

- `src/app/`：app-level state orchestration、session behavior、跨 feature 协调。
- `src/features/`：用户可见 feature area，例如 shell、editor host。
- `src/shared/`：共享 editor、library、types、utilities。
- `electron/`：Electron main process、preload API、本地数据库、share rendering、maintenance tools。
- `scripts/`：automation 和 smoke-test helpers。

## Agent Configuration

- `AGENTS.md`：Codex-style agents 的项目入口。
- `CLAUDE.md`：Claude Code 的薄入口，指回 `AGENTS.md`。
- `docs/agents/`：项目执行规则、routing、quality gates 和 memory。
- `docs/agents/memory/`：WorkKnowlage-specific durable lessons。
