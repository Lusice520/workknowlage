# Temporary Public Share Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a share dropdown with preserved LAN sharing plus Cloudflare Tunnel temporary public sharing with generated passwords and expiry.

**Architecture:** Keep existing LAN sharing on `/share/:token`. Add a separate public token and `/public/share/:publicToken` password gate so public auth never changes local LAN behavior. Run Cloudflare Tunnel as an Electron main-process runtime around the existing local share server and expose it through IPC/preload to the React share hook.

**Tech Stack:** Electron main/preload, Node `http`/`crypto`/`child_process`, SQLite/better-sqlite3, React/Vitest.

---

### Task 1: Share Data Model

**Files:**
- Modify: `electron/db/schema.cjs`
- Modify: `electron/db/index.cjs`
- Modify: `electron/share/repository.cjs`
- Test: `electron/share/repository.test.ts`

**Steps:**
1. Write failing tests for public token creation, password hash verification, expiry metadata, and local token preservation.
2. Add nullable public share columns with compatible migration.
3. Implement `createPublicShare`, `disablePublicShare`, `getPublicShareByToken`, and password verification.
4. Run focused repository tests.

### Task 2: Share Server Password Gate

**Files:**
- Modify: `electron/share/server.cjs`
- Test: `electron/share/server.test.ts`

**Steps:**
1. Write failing tests that `/public/share/:token` shows a password gate, rejects wrong passwords, accepts correct POST auth, and does not affect `/share/:token`.
2. Implement public auth sessions in server runtime memory.
3. Render the existing read-only share page after password auth.
4. Run server tests.

### Task 3: Cloudflare Tunnel Runtime

**Files:**
- Create: `electron/share/cloudflareTunnel.cjs`
- Test: `electron/share/cloudflareTunnel.test.ts`

**Steps:**
1. Write failing tests for parsing `trycloudflare.com` URLs from stdout/stderr and failing clearly when the binary cannot start or no URL appears.
2. Implement a small runtime that spawns `cloudflared tunnel --url http://127.0.0.1:<port> --no-autoupdate`.
3. Resolve bundled binary first, then PATH.
4. Run tunnel runtime tests.

### Task 4: IPC, Preload, Mock, and Hook

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Modify: `src/app/useDocumentShare.ts`
- Test: `src/app/useDocumentShare.test.ts`

**Steps:**
1. Write failing hook/mock tests for `createPublic`, copying link + password, and disabling public share.
2. Add share mode types and public share IPC methods.
3. Connect main-process runtime to repository and tunnel lifecycle.
4. Run hook tests.

### Task 5: Share Dropdown UI

**Files:**
- Modify: `src/features/shell/CenterPane.tsx`
- Test: `src/features/shell/CenterPane.test.tsx`

**Steps:**
1. Write failing UI tests that the share menu shows `局域分享` and `临时公网分享`, with expiry options for public sharing.
2. Implement menu items without removing the existing LAN flow.
3. Show concise status text for public link, password, expiry, and failures.
4. Run CenterPane tests.

### Task 6: Verification

**Commands:**
- `npm test -- electron/share/repository.test.ts electron/share/server.test.ts electron/share/cloudflareTunnel.test.ts src/app/useDocumentShare.test.ts src/features/shell/CenterPane.test.tsx`
- `npm run typecheck`
- `git diff --check`

### Task 7: Packaging Runtime

**Files:**
- Modify: `package.json`
- Create: `scripts/prepare-cloudflared.mjs`
- Create: `resources/bin/.gitignore`

**Steps:**
1. Add a build-time script that prepares the official macOS `cloudflared` binary under `resources/bin/cloudflared`.
2. Configure Electron Builder `extraResources` so packaged apps contain `resources/bin/cloudflared`.
3. Keep runtime resolution ordered as bundled binary, `CLOUDFLARED_PATH`, then system `PATH`.
