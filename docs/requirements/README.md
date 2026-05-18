# WorkKnowlage 需求文档入口

本目录是 WorkKnowlage 的产品需求和单功能规格说明书入口。PRD 负责产品方向和范围，SPEC 负责单功能细节，当前里程碑文档负责阶段状态和下一步优先级。

## 核心文档

| 文档 | 用途 |
|---|---|
| `PRD.md` | 项目级产品需求文档，负责定位、范围、功能清单、SPEC 总清单、里程碑和风险 |
| `CURRENT_MILESTONE.md` | 当前里程碑状态，说明已完成能力、P0 缺口、M2 启动方向和下一步建议 |
| `PRD_TEMPLATE.md` | 项目级 PRD 模板 |
| `specs/SPEC_TEMPLATE.md` | 单功能 SPEC 模板 |
| `specs/*.md` | 单功能需求规格说明书 |

## 写作规则

1. PRD 不写每个按钮、字段和提示文案；这些进入对应 SPEC。
2. SPEC 应包含背景与目标、方案取舍、产品形态与范围边界、流程、状态、字段、异常和验收。
3. 单功能产品设计合并进 SPEC，不默认另建长期 design doc。
4. SPEC 不默认写文件级实施拆解；执行计划只在复杂开发、跨会话、交接、并行或用户明确要求时生成。
5. 能由当前产品方向判断的问题，应主动写成决策；只保留真正需要 Lusice 拍板的问题作为待确认。

## 更新节奏

| 场景 | 应更新 |
|---|---|
| 产品方向或功能范围变化 | `PRD.md` |
| 单功能交互、状态、字段、验收变化 | 对应 `specs/<feature_name>_spec.md` |
| 当前阶段、发布基线、P0 缺口、下一步优先级变化 | `CURRENT_MILESTONE.md` |
| 文档结构规则变化 | `PRD_TEMPLATE.md`、`specs/SPEC_TEMPLATE.md`、`docs/agents/rules/requirements-docs.md`，必要时同步全局模板源 |
