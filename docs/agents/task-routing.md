# Task Routing

用这个文件为 WorkKnowlage 任务选择合适 workflow。

## Product or Feature Ideas

当目标、workflow 或边界不清楚时，用 `grill-with-docs` 或 brainstorming。

然后进入：

```text
to-prd -> to-issues -> implementation
```

本地 PRD、SPEC 和需求开发 issues 放在 `docs/requirements/`；`.scratch/` 只用于临时草稿。

## Implementation

涉及以下区域时，优先使用 TDD 或 focused test-first work：

- editor behavior
- search behavior
- Electron database behavior
- cross-feature orchestration
- previously regressed areas

小型 UI 或 copy-only change 可以直接实现，然后运行 focused verification。

## Bugs and Regressions

使用 `diagnose` 或 systematic debugging：

```text
reproduce -> narrow scope -> inspect -> fix -> regression test
```

Editor、database、search regressions 不要靠猜修复。

## Architecture Work

理解系统用 `zoom-out`，发现重构机会用 `improve-codebase-architecture`。

如果某个 architectural decision 会影响未来工作，优先写入 `docs/plans/` 或 ADR。

## UI and UX Work

改变 visible interaction、layout、editor surfaces、search presentation 时，使用 design review 或 browser-based QA。
