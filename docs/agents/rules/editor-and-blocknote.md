# Editor and BlockNote Rules

- 把 BlockNote integration points 当作 fragile，直到验证通过。
- Editor behavior changes 要有 focused tests 或 smoke checks。
- 除非有清晰 adapter 或 guard，不要直接依赖 editor internals。
- Rich table work 前先检查现有 table behavior、overlay、layout、boundary-delete tests。
- Search-in-editor work 要保护 cursor、selection、scroll、highlight behavior。
- 围绕不稳定 editor APIs 优先建立 adapter functions 和 contract tests。
