# Hook: Before Final Answer

在声称 WorkKnowlage 工作完成前：

1. 总结 changed files。
2. 说明 verification commands 和结果。
3. 说明未运行的 verification。
4. 标出 residual risk，特别是 editor、search、database、Electron behavior。
5. 如果产生了可复用 lesson，写入 `docs/agents/memory/project-lessons.md`。
6. 如果本轮发生用户纠正、反复返工或 UI/UX 判断偏差，必须自主检查是否需要更新 `docs/agents/memory/project-lessons.md`；需要时直接写入，并在 final answer 说明。
