# Share Links Experience Design

> Date: 2026-05-21
> Owner: Lusice
> Status: approved for implementation

## Goal

Improve sharing feedback and add a workspace-level share link management view.

## Design

The document header keeps the existing share dropdown. When a share action starts, the document title status capsule immediately enters a loading state, for example `正在生成公网链接...`, so the user sees progress even while Cloudflare Tunnel is starting. The share button may stay disabled during the operation, but the status capsule must remain visible and informative.

The public share password remains one-time and hash-only in persistent storage. React keeps the latest generated password in memory for the current app session, keyed by document id and public token. While the password is remembered, users can copy `公网链接 + 密码` repeatedly. After app restart or password loss, users can still copy the public URL and can use `重置公网链接和密码` to create a fresh public link and password.

The left sidebar gains a `共享链接` entry beside `所有笔记` and `收藏夹`. The center pane shows all active shares in the current space, grouped by document. Each local or public share row shows type, status, URL hint, expiry when available, and actions: copy, close, and for public shares, reset. The page also provides `一键关闭所有链接`.

## Verification

Implementation should cover focused React tests for the title capsule, copy/reset actions, and the new collection view, plus repository/API tests for listing and closing workspace shares.
