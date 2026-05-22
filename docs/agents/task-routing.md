# 任务路由

本文件只做 WorkKnowlage 项目级入口索引。全局协作原则、skill 分层和沟通方式不在这里重复。

## 上下文读取

默认少读，按需扩展。先明确目标、成功标准和验证方式，再决定读取范围。

最小入口：

- 本文件
- 与当前任务直接相关的 PRD / SPEC
- 相关代码和测试

按触发条件扩展：

| 触发 | 读取 |
|---|---|
| 需要产品/领域定位 | `docs/agents/project-profile.md` |
| 需要找模块边界 | `docs/agents/source-map.md` |
| 需要发布、打包或全量验证 | `docs/agents/quality-gates.md` |
| 复现历史问题或用户指出项目偏差 | `docs/agents/memory/project-lessons.md` |

## 任务路由表

| 场景 | 默认路由 |
|---|---|
| 产品或功能目标不清 | Superpowers `brainstorming`；必要时 Matt Pocock `grill-with-docs` |
| 需要 PRD / SPEC | `requirements-docs`；长期事实来源放 `docs/requirements/` |
| 需要 issue / triage | Matt Pocock `to-issues` / `triage`；`.scratch/` 只放临时草稿 |
| 明确实现 | Karpathy guardrails + focused implementation + tests |
| 复杂或跨模块实现 | Superpowers `writing-plans` / `test-driven-development` / `verification-before-completion` |
| Bug 或回归 | Superpowers `systematic-debugging` 或本地 `diagnose` |
| UI / UX 可见变化 | 先收敛交互；必要时 gstack browse / QA / design-review |
| 发布、打包、合并 | 读取 `quality-gates.md`，走高可靠验证和 ship 流程 |

## 项目约束

- 本地 PRD、SPEC 和需求文档放在 `docs/requirements/`。
- `.scratch/` 只用于临时 agent 草稿或本地 issue 草稿。
- Editor、database、search regressions 不要靠猜修复。
- 小型 UI 或 copy-only change 可以直接实现，但完成前仍要 focused verification。

## 架构记录

发现重构机会可用 `zoom-out` 或 `improve-codebase-architecture`。如果 architectural decision 会影响未来工作，优先写入 `docs/plans/` 或 ADR。
