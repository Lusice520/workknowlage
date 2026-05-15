# Subagent Delegation Policy

Subagents 是可选能力。只有当用户明确要求 agent delegation、parallel work 或 subagents 时才使用。

## Good Delegation Cases

- 独立的 codebase exploration questions。
- 大型 review：一个 agent 看 tests，另一个 agent 看 implementation。
- 并行 implementation：仅当 write scopes 清晰且互不重叠。

## Avoid Delegation When

- 下一步被 delegated answer 阻塞。
- 任务足够小，main assistant 可以直接完成。
- 工作需要持续 user alignment 或紧密判断。
- Write scopes 会重叠。

## Suggested Roles

- Explorer：回答具体 codebase question。
- Implementer：负责窄范围、互不重叠的 file/module change。
- Reviewer：检查已完成 diff 的 bugs 和 test gaps。
- QA checker：实现后验证 UI 或 workflow。
