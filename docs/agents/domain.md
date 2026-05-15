# Domain Docs

本文件说明 engineering skills 在探索 codebase 时如何读取 WorkKnowlage 的 domain documentation。

## Before Exploring, Read These

- repo root 的 `CONTEXT.md`，如果存在。
- `docs/adr/`，如果存在，读取和当前变更区域相关的 architectural decisions。

如果这些文件不存在，静默继续。不要因为缺失就主动要求创建。Producer skill（`grill-with-docs`）会在术语或决策真正需要沉淀时再创建。

## File Structure

本项目使用 single-context layout：

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the Glossary's Vocabulary

当输出中命名 domain concept，例如 issue title、refactor proposal、hypothesis、test name 时，优先使用 `CONTEXT.md` 中定义的术语，不要随意换同义词。

如果需要的概念还不在 glossary 里，说明可能存在命名缺口，可以为 `grill-with-docs` 记录。

## Flag ADR Conflicts

如果输出和现有 ADR 冲突，要显式指出，不要默默覆盖。
