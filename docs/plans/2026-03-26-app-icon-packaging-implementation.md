# App Icon And DMG Packaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a production app icon for WorkKnowlage and package the Electron app into a macOS DMG.

**Architecture:** Add a vector icon source and a small build script that generates PNG sizes and an `.icns` bundle using native macOS tools. Then wire `electron-builder` into `package.json` with macOS icon and DMG configuration, run the renderer build, and produce a signed-optional local `.dmg` artifact.

**Tech Stack:** Electron, electron-builder, Node.js, SVG, macOS `sips`, macOS `iconutil`, macOS `hdiutil`

---

### Task 1: Create icon source and generation script

**Files:**
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/build/icon/workknowlage-icon.svg`
- Create: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/scripts/generate-icon-assets.mjs`

**Step 1: Write the failing verification**

Run: `node scripts/generate-icon-assets.mjs`

Expected: FAIL because the source files do not exist yet.

**Step 2: Write minimal implementation**

Add the approved SVG icon and a script that:
- renders a 1024 PNG from the SVG
- creates an `.iconset`
- resizes the PNG into required macOS icon sizes
- runs `iconutil` to produce `build/icon/WorkKnowlage.icns`

**Step 3: Run verification**

Run: `node scripts/generate-icon-assets.mjs`

Expected: PASS and icon assets are generated.

### Task 2: Add macOS packaging config

**Files:**
- Modify: `/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/package.json`

**Step 1: Write the failing verification**

Run: `npx electron-builder --mac dmg --dir`

Expected: FAIL or missing config because builder is not installed/configured yet.

**Step 2: Write minimal implementation**

Add `electron-builder` and package config for:
- `productName`
- `appId`
- `files`
- `directories.output`
- `mac.icon`
- `dmg`

Add scripts for icon generation and DMG packaging.

**Step 3: Run verification**

Run: `npm run package:mac -- --dir`

Expected: PASS with unpacked mac app output.

### Task 3: Produce final DMG

**Files:**
- Reuse generated assets and packaging config

**Step 1: Build renderer**

Run: `npm run build`

**Step 2: Generate icon assets**

Run: `npm run icon:build`

**Step 3: Build DMG**

Run: `npm run package:mac`

Expected: PASS and `.dmg` appears in the configured output directory.
