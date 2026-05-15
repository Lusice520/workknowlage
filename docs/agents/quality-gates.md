# Quality Gates

根据改动风险选择最小但足够的 verification set。

## Default Commands

- Type checking：`npm run typecheck`
- Full tests：`npm test`
- Production build：`npm run build`
- Whitespace check：`git diff --check`

## Focused Verification

窄范围改动先跑直接相关 test files。若改动影响 shared behavior，再扩大验证范围。

## Broaden Verification When Touching

- `src/shared/editor/`：运行相关 editor tests，必要时 full tests。
- `src/features/shell/WorkspaceSearch*` 或 search utilities：运行 search tests 和 navigation tests。
- `electron/db/` 或 persistence code：运行 database tests、migration-related tests 和 typecheck。
- `electron/` preload/main API shape：运行 API 和 app integration tests。
- `src/app/` app-level orchestration：运行 app tests 和相关 feature tests。

## Before Final Answer

说明跑了哪些 verification。如果没跑，说明原因和 remaining risk。
