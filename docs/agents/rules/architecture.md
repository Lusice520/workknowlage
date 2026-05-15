# Architecture Rules

- App-level orchestration 放在 `src/app/` 或 feature shell 边界，不要埋进 presentational components。
- 需要直接 unit coverage 的 pure derivation logic 放在 shared libraries。
- 避免在 React render paths 里做昂贵派生；在合适边界 prepare / memoize view models。
- Electron database 和 preload API boundaries 要保持明确。
- 架构改进要尽量绑定具体 behavior 或 risk，避免无目标重构。
- 会影响未来工作的 architectural decisions，写入 `docs/plans/` 或 `docs/adr/`。
