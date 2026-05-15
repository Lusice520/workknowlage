# Testing Rules

- Bug fixes 要添加或更新 regression tests。
- 保护 module boundaries 或 integration assumptions 时，添加 contract tests。
- Editor behavior 优先测试 user-visible behavior 或稳定 adapter boundary。
- Search behavior 尽量分别测试 grouping、selection、preview text、highlighting。
- Database changes 尽量覆盖 migration 和 repository behavior。
- 先跑 focused tests；当 touched code 是 shared 时，再扩大验证范围。
