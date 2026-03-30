# Editor Bundle Chunking Design

**Goal:** 在不改变编辑器功能和交互的前提下，把当前仍然偏大的编辑器依赖块拆成更合理的 vendor chunk，降低单个 chunk 的体积告警风险。

**Why now:** `CenterPane` 已经把编辑器入口做成懒加载，主 renderer 入口明显变小，但编辑器相关代码仍然聚合在一个超大的共享 chunk 里。继续优化最安全的手段是构建期重新分组，而不是继续改运行时组件边界。

## Considered Options

### Option 1: Vite `manualChunks` 按依赖生态拆分

- 把 `@blocknote` 及其直接相关依赖拆到独立 chunk
- 把 `@tiptap` / `prosemirror-*` / `linkifyjs` 拆到独立 chunk
- 把 `@mantine` 拆到独立 chunk
- 把 `react` / `react-dom` / `scheduler` / `use-sync-external-store` 抽成共享 editor runtime chunk
- 保留现有 `CenterPane` 懒加载边界

**Pros**

- 风险最低
- 不改变编辑器运行时行为
- 最符合当前包体问题的根因

**Cons**

- 只能改善 chunk 结构，不会减少总下载字节
- 如果上游库之间强耦合，仍可能保留部分较大 chunk

### Option 2: 把 `SharedBlockNoteSurface` 内部能力继续动态导入

**Pros**

- 潜在收益更高

**Cons**

- 会开始影响编辑器运行时交互
- 需要补更多回归测试

### Option 3: 可选编辑能力按功能启用时再加载

**Pros**

- 包体收益最大

**Cons**

- 风险最高
- 已经超出当前“安全优化”范围

## Decision

采用 **Option 1**。

本轮只修改 [vite.config.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts) 的打包策略，把编辑器依赖按生态拆 chunk。最终目标 chunk 结构是：

- `editor-react`
- `editor-mantine`
- `editor-tiptap`
- `editor-blocknote-core`
- `editor-blocknote-react`

验证标准是：

- `npm test` 通过
- `npm run typecheck` 通过
- `npm run build` 通过
- 构建输出中主入口维持较小体积，编辑器相关大块被进一步拆散
