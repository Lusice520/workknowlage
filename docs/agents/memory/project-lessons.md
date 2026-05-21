# Project Lessons

这里记录 WorkKnowlage-specific durable lessons。

## Sidebar Associations

`RightSidebar` 应该消费 prepared association state。不要把昂贵的 association derivation 重新放回 render flow。App-level orchestration 负责 invalidation 和 preparation。

2026-05-14: 右侧相似内容不是全文搜索结果，而是 `sidebarAssociations` 对同一 workspace 内的文档块候选做 token overlap、ratio 和 coverage threshold 过滤。短句或标题式内容命中长段落时，可能因为 `MIN_DOCUMENT_COVERAGE_RATIO` 过高被过滤；短于 meaningful body threshold 的独立短句也可能不进入候选。排查“相似内容未显示”时，先检查候选文本、同空间过滤、块类型支持和阈值，不要误判为搜索索引未重建。

2026-05-15: 右侧栏 Wiki 的“相关主题 hover 相似处”和“原文线索”都属于解释同一个目标文档为什么相关的证据。不要再把它们拆成两个主列表；`sidebarAssociations` 应输出 `associatedDocuments`，`RightSidebar` 展示“关联文档”，卡片内用 `主题相似`、`局部相似`、`原文命中` 标签和 hover 证据预览承载具体命中，点击证据再定位块。

2026-05-18: 排查“新文档在右侧 Wiki 没有关联”时，要同时检查内容块类型。`sidebarAssociations` 已补充 `codeBlock`、`alert`、`table`、`richTable` 和 `toggleListItem` 文本作为相似候选；目录树、路径、提醒块、表格和折叠列表现在可以触发推荐。后续继续扩展推荐召回时，要配套测试并控制路径、代码和表格元数据带来的噪声。

## Search Highlighting

Workspace search highlighting 当前只标记 preview 里的 direct query-part matches。除非明确实现并测试过，不要假设 fuzzy-span highlighting 已存在。

## Editor Code Blocks

2026-05-13: BlockNote 默认代码块黑底在 WorkKnowlage 的浅色编辑器里会显得突兀。代码块应保持浅灰底、深色正文、轻边框，和 inline code 的浅色处理一致。相关样式在 `src/shared/editor/SharedBlockNoteSurface.css`，并用 `SharedBlockNoteSurfaceStyles.test.ts` 做源码级守护。

2026-05-13: 分享页使用独立的 `electron/share/render.cjs` CJS 渲染管线，不会自动继承前端导出工具里的 `codeBlock` 处理。新增或调整 BlockNote block 类型时，要同步检查分享渲染器是否有对应 `renderBlock()` 分支和 `electron/share/render.test.ts` 覆盖。

2026-05-13: 修分享页不要只看单个 block。先对真实 `content_json` 做 block type / inline style 形态统计，再用 `buildShareHtml` 对 active documents 做只读 smoke，确认没有“有块但正文渲成暂无内容”的文档。当前分享页至少要覆盖 heading、paragraph、quote、bullet/numbered/check list、toggleListItem、divider、image、kbAttachment、table、richTable、alert、codeBlock，以及 inline bold/italic/underline/strike/code/link/color/background/docMention。列表视觉也要同步编辑器：有序/无序嵌套列表需要缩进竖线 guide，不只是蓝色 marker；guide 要对齐父级 marker 列，不能贴着子列表边界。BlockNote 的缩进线属于父 block 的 children group，不属于 `li > ul/ol` 本身；有序项下面混合 code block、paragraph、bullet list 时也要用同一条 guide。

2026-05-13: 分享页的 BlockNote 细节要按真实视觉验。Alert icon 应与正文第一行中心对齐，不是粗略 top 对齐；quote 中 text node 里的真实 `\n` 要转成 `<br />`，否则浏览器会折叠成一行。编辑器代码块除了浅灰底，也需要 `margin-block` 留出与上下正文的呼吸感。

2026-05-14: 分享页无序列表 marker 不能依赖文本 glyph（`•` / `◦` / `▪`）来和缩进竖线对齐。不同浏览器、字体 fallback、缩放或字重会让 glyph 的视觉中心和 CSS box center 不一致，导致本机截图看似对齐而用户环境偏移。分享页列表应使用 CSS 几何形状绘制无序 marker，并让 marker center 和 children guide 共享同一个 CSS variable；验证时要量测 marker center 与 guide x 坐标，而不只是肉眼截图。

补充：列表 marker 的几何绘制不能把正文缩进一起放大。分享页列表要区分 marker column、marker center 和 content indent：正文起点应接近编辑器的正常列表列宽，marker 到正文的距离保持约 14px；无序列表不同层级可以换形状，但视觉尺寸应统一，避免二级空心圆明显大于一级实心点。

2026-05-14: BlockNote 0.48 的默认 `codeBlock` 是源码编辑，不会自动渲染 Mermaid。WorkKnowlage PRD / SPEC 需要 Mermaid 流程图时，应在 schema 中显式提供 `mermaid` code block language；编辑器内要在源码区外追加 `contentEditable=false` 的 SVG 预览，不能把 SVG 塞进可编辑 `code` 节点；分享页要用本地 `mermaid` bundle 渲染；Markdown 导出要保留 ```mermaid fenced block，避免流程图语义丢失。

补充：编辑器内 Mermaid 预览不能只依赖 code block 语言下拉框的当前值；打包、重开或 BlockNote DOM 重新挂载时，下拉框可能还没 ready，导致预览扫描误判为普通代码块。预览逻辑应优先兼容 BlockNote 的块语言属性（如 `data-language="mermaid"`），并在 Mermaid 动态加载失败时显示明确错误状态，而不是留下空白预览。

再补充：BlockNote 内容可能在 shared editor surface 的 React effect 之后才异步挂进 DOM。Mermaid 预览 hook 不能只在 mount / editor change / input 事件上刷新，还要观察 editor surface 下 codeBlock DOM 的 childList / language 属性 / text mutations；否则重开文档时已有 Mermaid code block 可能保持纯源码显示。

再补充：不要在语言切换后临时把 Mermaid 预览节点插进 BlockNote 管理的 code block DOM，也不要为了预览把 `.bn-block-content[data-content-type="codeBlock"]` 改成 `display: grid`。这会导致选择 Mermaid 后代码块跳动，甚至打断语言下拉框。预览槽应由自定义 code block spec 在 render 时稳定创建，并通过 `ignoreMutation` 让 ProseMirror 忽略 SVG 预览内部变化；预览 hook 只负责填充/隐藏这个槽。

## Local Agent Artifacts

Agent workflows 产生的临时实现草稿可以写入 `.scratch/`。但 PRD、SPEC、需求规则这类用户需要阅读和管理的项目文档，应放在可见的 `docs/requirements/`，不要藏在 `.scratch/`。

## Local Share URLs

本地分享链接不能只把 URL 从 `127.0.0.1` 改成内网 IP；share server 也必须监听非 loopback 地址，例如 `0.0.0.0`，否则同一局域网内的其他设备仍然无法访问。

2026-05-20: Cloudflare quick tunnel 输出 trycloudflare URL 不代表 tunnel 已可访问。`cloudflared` 可能先打印 URL，再注册 connector；如果 WorkKnowlage 立刻复制 URL，浏览器可能看到 Cloudflare 1033。公网分享必须等到 cloudflared 日志出现连接注册信号（例如 `Registered tunnel connection`）后再把链接暴露给用户；如果注册前退出或超时，应把最近 cloudflared 日志带到错误信息里，而不是返回死链接。

补充：如果日志里出现 `Initial protocol quic` 后 `Failed to dial a quic connection ... timeout: no recent network activity`，说明当前网络/VPN/代理环境可能阻断 UDP/QUIC。WorkKnowlage 的临时公网分享应默认用 `cloudflared --protocol http2`，走 TCP/TLS，真实 smoke 需要验证公网 URL 能访问本地 `/healthz`，不能只看 tunnel URL 是否生成。

## Word Export Color Tokens

BlockNote / editor content may store colors as semantic tokens such as `red`, `blue`, `green`, and `yellow`. DOCX export must not pass these values directly to `docx`; it requires 6 digit hex strings without `#`.

When touching Word export, normalize editor color tokens and hex variants at the export boundary. Include regression coverage for inline text colors and rich table cell text/background colors.

## Share Page Layout

分享页布局问题不能只理解为“左右留白太大”。如果用户反馈页面像“歪着身子看”，说明问题是 visual center 和 reading group 不协调。

处理分享页宽屏布局时：

- 不要只放大 `.page` 或 `.content` 外壳，否则可能出现白色卡片变宽但正文仍偏左的假修复。
- 同时检查正文文本宽度、内容卡片宽度、目录栏宽度、grid gap 和整体 `justify-content`。
- 正文和目录应作为一个 centered reading group，而不是让目录像孤岛一样挂在右侧。
- UI 布局改动后，应尽量用截图或浏览器验证真实视觉效果；无法截图时，final answer 要说明验证缺口。

## Product Positioning

WorkKnowlage is not an AI product. It is a local-first macOS knowledge workspace. Future AI features can be planned as optional assistant capabilities, but the product PRD should not use an Agent PRD as the primary structure.

For WorkKnowlage PRDs, prefer a traditional product PRD plus feature-level requirements specification:

- Product-level: positioning, users, scenarios, scope, modules, milestones, risks.
- Feature-level: function name, purpose, interaction flow, special cases, parameters, data records, exceptions, acceptance criteria, and open Q/A.
- AI-related content belongs in roadmap, future capability, or a separate AI module PRD unless Lusice explicitly asks for an AI feature PRD.

## Requirement Document Layering

Do not keep expanding the project PRD with every feature-level detail. WorkKnowlage requirements use a layered structure:

- Project PRD: `docs/requirements/PRD.md`.
- Project PRD template: `docs/requirements/PRD_TEMPLATE.md`.
- Feature specs: `docs/requirements/specs/<feature_name>_spec.md`.
- Feature spec template: `docs/requirements/specs/SPEC_TEMPLATE.md`.
- Feature spec example: `docs/requirements/specs/local_share_spec.md`.

The project PRD owns product direction, target users, scenarios, scope, module map, milestones, and risks. Feature specs own function lists, states, fields, interactions, prompts, exceptions, data records, acceptance criteria, and open Q/A.

Do not put the documentation layering mechanism itself into the PRD body. Keep those rules in `docs/agents/rules/requirements-docs.md` and templates.

Also avoid making the project PRD too abstract with requirement-taxonomy sections. For WorkKnowlage, the function list is a scope index, not a substitute for requirements. The requirements section should use product-facing paragraphs that explain concrete needs and rough capabilities by module. Put fields, buttons, state tables, prompt text, exceptions, and detailed acceptance cases in feature specs.

The project PRD still needs a SPEC management table. Do not move all SPEC visibility out of the PRD. The PRD should show which features have specs, where those specs live, their priority, and current status, while leaving detailed fields, states, prompts, exceptions, and acceptance cases inside each feature spec file.

PRD reading order matters. Put business flow and requirement flow before system overview and function list, so readers understand the user's work process before seeing the system inventory. The system overview should include system architecture, information structure, and function structure diagrams. Core flows should be drawn with Mermaid where possible, not left only as step lists.

Do not let Mermaid diagrams replace the core flow text. For WorkKnowlage PRDs, keep multiple named core flows when they represent different user jobs, and give each flow both a narrative paragraph and a flowchart. A single overview diagram is not enough if it hides the separate workflow meanings.

The requirements documentation system should be explicit: two templates, one rules file, and example artifacts. The canonical set is PRD template, SPEC template, requirements rules, current PRD example, and at least one SPEC example. SPEC flow sections also need narrative text plus Mermaid diagrams; do not leave section 3 as only an arrow list.

Requirements rules are part of the user's PRD/SPEC documentation system, so they should be written in Chinese by default. Reusable PRD/SPEC standards should live both as project-local artifacts and as global templates plus a skill. Current global template source: `/Users/lusice/.codex/lusice/templates/requirements/`; current skill: `/Users/lusice/.codex/skills/requirements-docs`.

Do not include "requirement hierarchy" sections in PRD/SPEC rules or templates. Lusice rejected that abstraction; use function lists, SPEC management tables, narrative requirement descriptions, and feature-level SPECs instead.

Project requirements docs were migrated from hidden `.scratch/` to visible `docs/requirements/`. Future WorkKnowlage PRD/SPEC paths should use `docs/requirements/PRD.md`, `docs/requirements/PRD_TEMPLATE.md`, `docs/requirements/specs/SPEC_TEMPLATE.md`, and `docs/requirements/specs/<feature_name>_spec.md`.

Keep feature SPEC files flat under `docs/requirements/specs/`. Prefer `<feature_name>_spec.md` such as `local_share_spec.md`; do not create deep `<feature>/SPEC.md` folders unless a feature genuinely needs multiple supporting files.

2026-05-19: When adding a new WorkKnowlage product capability, put the durable requirement source of truth in a feature SPEC under `docs/requirements/specs/` first. Update the PRD only as product-scope and SPEC-index synchronization. Use `docs/plans/` for execution plans, not as the primary place for product requirements.

2026-05-15: When a product design discussion changes WorkKnowlage scope, information architecture, or user-facing interaction model, update the project PRD alongside `docs/plans/` design and implementation plans. Do not leave product-level changes only in planning docs. Keep PRD updates product-level and put detailed fields, states, and algorithms in the feature SPEC or implementation plan. If the PRD's SPEC management table names a feature SPEC path and enough detail exists, create or update that SPEC in the same pass and mark the PRD SPEC status accordingly.

2026-05-15: WorkKnowlage feature SPECs should actively resolve implementation-facing product questions before planning. Do not leave obvious defaults as pending. For the right-sidebar Wiki association spec, decisions such as badge count vs dot, `9+` cap, default Properties tab, no current AI/embedding retrieval, and no manual evidence-to-relation promotion belong in the SPEC as current-version decisions.

2026-05-18: Right-sidebar Wiki associations are a recommendation and explanation surface, not a manual relationship-review workflow. Do not make users confirm, pin, or manually solidify every recommended relation as the primary product loop. If WorkKnowlage needs a reliable relationship graph, use deterministic evidence to recall candidates and an LLM-based relation judgement layer to decide relation validity, relation type, confidence, and rationale. User feedback should remain lightweight and optional for ranking/noise reduction.

2026-05-18: For WorkKnowlage requirements, avoid maintaining separate long-lived design docs and feature SPECs for the same single feature. Put product background,方案取舍, flows, states, boundaries, and acceptance criteria into the flat feature SPEC under `docs/requirements/specs/`. Do not include detailed implementation task breakdowns in SPEC by default; keep implementation plans as execution-time artifacts only when actively coding complex work, handing off, or coordinating parallel work.

2026-05-18: When consolidating WorkKnowlage design docs into a feature SPEC, preserve useful product/design content instead of compressing it into a short summary. Merge background, trade-off analysis, product shape, data flow, model boundaries, and non-goals when relevant. The goal is fewer source-of-truth files, not less product information; implementation commands and file-by-file task plans should stay out of long-lived requirements unless explicitly needed.

2026-05-18: SQLite `datetime('now')` returns UTC strings without a timezone suffix. When showing document timestamps, treat `YYYY-MM-DD HH:mm:ss` as UTC storage and format it into the user's local timezone before displaying; otherwise WorkKnowlage appears eight hours behind on China Standard Time systems.

2026-05-19: WorkKnowlage 表格文档不是普通文稿的另一种内容块。表格态应优先给在线 Spreadsheet 画布让出空间，避免复用右侧“文稿概览 / Wiki / 文稿脉络”信息栏。集成 Univer 时必须显式注册当前语言包，并为表格 preset 提供可打包的 module worker；否则会出现空白容器或运行时 `[LocaleService]: Locale not initialized`。

2026-05-19: WorkKnowlage 打包后的应用必须覆盖旧库启动路径。`schema.cjs` 如果新增依赖新列的索引、触发器或查询结构，`electron/db/index.cjs` 必须先执行旧库 migration，再执行 `SCHEMA_SQL`；否则 DMG 首次打开旧数据库时可能因为索引引用缺失列而启动失败。此类修复要用 Electron smoke script 覆盖真实 ABI，不要直接在普通 Node 进程里打开 `better-sqlite3`。

2026-05-20: 外部 Markdown 文件不是知识库内部文档的弱选中态。用户确认的产品形态是：Finder / 默认打开进入 WorkKnowlage 的独立外部文件窗口；继续使用 WorkKnowlage 块编辑器；目录保留并放到最左侧；右侧 Wiki / 属性栏不显示；顶部展示自动保存、修改时间和字数；“在 Finder 中显示”和“导入知识库”放在右上角。外部文件默认自动保存回原 `.md` / `.markdown` 路径，只有用户主动导入时才创建知识库文档。

2026-05-20: 外部 Markdown 文件窗口的视觉样式也必须继承 WorkKnowlage 主应用风格。不要把外部文件做成裸白背景、直角侧栏或普通网页工具条；应复用主 shell 的渐变背景、圆角玻璃侧栏、CenterPane 文稿面板、统一目录行和编辑器排版。外部文件是 WorkKnowlage 的一个专用文档窗口，不是一个低配 Markdown 编辑器。

2026-05-21: Cloudflare quick tunnel 会暴露整个本地 share server，不只是某个生成出来的公网分享 URL。实现临时公网分享时，不能只把 HTML 里的附件链接改成密码保护路径；server 也必须根据 tunnel Host 阻断裸 `/uploads/*` 和局域 `/share/*` 路径，并把公网分享附件放到 `/public/share/:token/uploads/*` 后面复用密码 session。否则只要知道资源路径，就可能绕过公网分享密码门。

2026-05-21: 外部 Markdown 文件自动保存虽然允许 BlockNote 规范化正文，但不能吞掉文件级元数据。保存边界至少要保留 YAML frontmatter，并用同目录临时文件再 rename 替换原文件，避免 lossy round-trip 或半截写入破坏用户原始 `.md` 文件。相关模块：`src/features/external-file/ExternalFileApp.tsx`、`electron/externalFiles.cjs`。

2026-05-21: WorkKnowlage Electron 包体积优化时，先看 `app.asar` 是否重复塞入 renderer-only dependencies。Vite 已把 React、Univer、Mermaid、Lucide、JSZip 等前端库编进 `dist`，这些库应放在 `devDependencies`，production `dependencies` 只保留主进程运行时需要的 `better-sqlite3`。同时用 `electronLanguages` 保留 `en` / `zh_CN` / `zh_TW`，并从 packaged files 排除 `better-sqlite3/deps` 和 `better-sqlite3/src`。这次实测 `app.asar` 从约 310M 降到 24M，DMG 从约 195M 降到 128M。

2026-05-21: WorkKnowlage 导出链路要按目标格式处理字体和图表。DOCX 中文字体不要使用 macOS-only 的 `PingFang SC` 作为 eastAsia 字体，应写入更稳定的 `Microsoft YaHei` 并在正文 TextRun 上显式设置，避免 Word/WPS fallback 成异常字体。PDF 导出 Mermaid 时，应在 renderer 的 export 边界动态加载 Mermaid、预渲染为内联 SVG，再交给 Electron `printToPDF`；不要依赖 data URL 打印窗口再加载相对路径脚本。相关模块：`src/features/export/docxExportUtils.ts`、`src/features/export/exportUtils.ts`、`src/app/useDocumentExport.ts`。

## How to Add Lessons

当 bug、用户纠正或 architectural decision 会影响未来工作时，追加一条简短 dated note，包含：

- what happened
- what to do next time
- affected files or modules
