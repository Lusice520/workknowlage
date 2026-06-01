# WorkKnowlage

<img width="1560" height="979" alt="WorkKnowlage screenshot" src="https://github.com/user-attachments/assets/6e7e80c4-d65f-47dd-801c-bcf2ead424da" />

WorkKnowlage is a lightweight local-first knowledge base application for macOS Apple Silicon devices. It is designed as an Obsidian-like knowledge workflow tool with additional extensible capabilities, focused on structured knowledge organization, local control, practical document workflows, and future AI-assisted knowledge work.

WorkKnowlage is not intended to be just another generic note-taking app. It is built for users who want local ownership of their knowledge, a simpler workflow than heavier knowledge tools, and stronger support for structured editing, search, document relationships, export, and sharing.

## Current Status

WorkKnowlage is currently in active development.

Current version: `v0.4.2`

At this stage:

- It primarily targets **macOS Apple Silicon (M-series)**.
- It does **not** provide a public prebuilt release yet.
- Users need to build the application locally and generate the `.dmg` package themselves.
- The core local-first knowledge workflow is already usable.
- The project is currently focused on reliability, packaging, structured knowledge features, and long-term local knowledge workflows.

This repository is currently best suited for early adopters, developers, and contributors.

## What Works Today

WorkKnowlage already includes the core foundation of a local-first knowledge workbench:

- [x] Local workspace and document management
- [x] Folder and document tree navigation
- [x] Manual document tree ordering
- [x] Block-based editing powered by BlockNote
- [x] SQLite-backed local persistence
- [x] Full-text search
- [x] Block-level search results
- [x] Search result grouping and highlighting
- [x] 标签
- [x] Favorites
- [x] Bidirectional document references
- [x] Right sidebar associations
- [x] Wiki-style related context and evidence aggregation
- [x] Custom callout blocks
- [x] Rich table support
- [x] Mermaid preview support
- [x] Image and attachment support
- [x] Export to Markdown
- [x] Export to Word
- [x] Export to PDF
- [x] LAN read-only sharing
- [x] Temporary public sharing through Cloudflare Tunnel
- [x] Share password gate and expiry handling
- [x] External Markdown file opening in a separate window
- [x] External Markdown autosave back to the original file
- [x] Manual import from external Markdown files into the knowledge base
- [x] macOS DMG packaging for local builds

## Not Done Yet

WorkKnowlage is still early and has several important limitations:

- No public prebuilt release package is available yet.
- macOS distribution is not yet signed and notarized for broad public release.
- Installation experience still requires local development setup.
- Graph view is not implemented yet.
- Document templates are not implemented yet.
- Rich metadata workflows are still incomplete.
- Local indexing and retrieval need further scaling work.
- AI summarization, retrieval, and Q&A are not implemented as product features yet.
- The current target platform is macOS Apple Silicon; broader platform support is not a priority yet.
- Some advanced workflows still need more real-world regression testing before broader adoption.

## Product Direction

WorkKnowlage is being developed in stages.

### M1: Local Long-Term Use

The current milestone focuses on making WorkKnowlage reliable enough for long-term local use.

Key focus areas:

- Stable document creation, editing, saving, and reopening
- Reliable local SQLite persistence
- Safer local data migration
- Better editor reliability
- Stronger search and navigation
- Export and sharing stability
- macOS DMG packaging
- Regression tests for high-risk workflows

### M2: Structured Knowledge Enhancement

The next stage focuses on making the knowledge base more structured and easier to navigate.

Planned work includes:

- Graph view for document relationships
- Document templates for PRDs, meeting notes, issue records, and retrospectives
- Richer metadata such as type, status, owner, date, and tags
- Better document classification and organization
- Improved sidebar associations
- Better Wiki-style evidence aggregation
- More scalable local indexing and retrieval

### M3: Optional AI-Assisted Workflows

AI features are planned as optional enhancements, not as the core identity of the product.

Possible future features include:

- Local-document summarization
- Retrieval over the local knowledge base
- Q&A over selected documents or workspaces
- Smarter document organization suggestions
- Writing and review assistance for structured documents

AI workflows should remain explicit, optional, 和 designed around user control over what data is sent to external APIs.

## Tech Stack

- **Framework:** Electron
- **Frontend:** React + TypeScript
- **Editor:** BlockNote
- **Local data:** SQLite
- **Build tooling:** Vite
- **Testing:** Vitest
- **Packaging:** electron-builder
- **Platform:** macOS Apple Silicon (M-series)

## Development

### Requirements

- macOS Apple Silicon
- Node.js 20 or newer
- npm

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Run tests

```bash
npm test
```

### Typecheck

```bash
npm run typecheck
```

### Build renderer

```bash
npm run build
```

### Package macOS DMG

```bash
npm run package:mac
```

The generated package will be placed under the `release/` directory.

## Why This Project

Many knowledge tools are either too heavy, too cloud-dependent, or too generic for practical local knowledge workflows.

WorkKnowlage explores a different direction: a lightweight, local-first, extensible knowledge base that supports structured knowledge organization, enhanced editing capabilities, practical document usage features, and future AI-assisted knowledge workflows.

The goal is not to replace every note-taking or documentation tool. The goal is to provide a focused local knowledge workbench for users who want to keep ownership of their knowledge while still having strong editing, search, relationship, export, and sharing capabilities.

## Contributing

Contributions, ideas, and feedback are welcome.

Useful contribution areas include:

- Bug reports
- Editor workflow improvements
- Search quality
- Export edge cases
- Sharing reliability
- macOS packaging
- Documentation
- Local-first AI workflow design

Please keep changes focused and well-described. When behavior changes, tests are strongly encouraged.

## License

WorkKnowlage is licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for details.
```
