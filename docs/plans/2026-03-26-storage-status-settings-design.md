# Storage Status Settings Design

**Goal**

把顶部常驻的存储状态条移出主界面，只在设置里查看存储状态与诊断信息。

**Current Problem**

- 顶部 banner 长期占用纵向空间，干扰主工作区聚焦。
- 存储信息属于低频诊断信息，更适合按需查看，而不是常驻曝光。
- 左下角已经有设置按钮，但还没有实际承载内容。

**Decision**

- 删除主界面顶部的存储状态 banner。
- 将左下角“设置”按钮升级为可开关的侧边设置面板。
- 在设置面板中提供“存储与数据”区块，展示：
  - 当前存储类型
  - 自动保存说明
  - 最近写入时间
  - 覆盖范围
  - 存储路径

**Interaction**

- 点击“设置”打开面板，再次点击或点击“关闭设置”收起。
- 存储信息默认不常驻，只有打开设置时才显示。

**Why This Approach**

- 符合用户期望，把低频系统信息收纳到设置。
- 不改底层数据来源，只改展示位置，风险低。
- 复用现有 `runtimeStatus / storageInfo / persistenceFeedback / lastPersistedAt`，实现成本小。
