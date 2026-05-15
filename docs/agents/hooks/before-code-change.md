# Hook: Before Code Change

修改 WorkKnowlage 代码前：

1. 识别 touched feature area。
2. 读取 `docs/agents/rules/` 下相关 rule file。
3. 检查 `docs/agents/memory/project-lessons.md` 中是否有相关 lessons。
4. 非 trivial change 先说明 intended edit scope。
5. 避免触碰 unrelated dirty worktree changes。
