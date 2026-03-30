# BlockNote No-Collab Design

**Goal:** Remove collaboration dependencies from the app's editor bundle because this product does not need collaboration features.

**Why now:** The current editor bundle still statically pulls in the BlockNote collaboration chain through upstream package internals even though the app does not expose collaboration, comments, awareness, or thread features.

## Approaches

### Option 1: Alias collaboration dependencies to local no-op stubs

- Redirect `yjs`, `y-prosemirror`, and `y-protocols` imports to local stub modules
- Remove the dedicated `editor-blocknote-collab` manual chunk because the real packages are no longer part of the app build
- Keep the app-level editor API unchanged

**Pros**

- Smallest app change
- Avoids forking BlockNote
- Keeps build/test/runtime under our control

**Cons**

- Depends on upstream collaboration code staying dormant in our app
- Needs carefully shaped stub exports

### Option 2: Fork or patch BlockNote internals to stop exporting collaboration code

**Pros**

- Cleaner in theory

**Cons**

- High maintenance cost
- Much larger surface area

## Decision

Adopt **Option 1**.

Implementation scope:

- add local no-collab stubs
- alias collaboration packages in [vite.config.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts)
- remove the `editor-blocknote-collab` chunk rule
- add regression coverage in [vitePackagingConfig.test.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/test/vitePackagingConfig.test.ts)

Verification standard:

- `npm test` passes
- `npm run typecheck` passes
- `npm run build` passes
- build output no longer emits an `editor-blocknote-collab` asset
