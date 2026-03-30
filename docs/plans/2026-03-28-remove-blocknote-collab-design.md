# Remove BlockNote Collaboration Design

**Goal:** Remove BlockNote collaboration and comments code paths from the editor runtime because this product does not need them.

**Why now:** The bundle work proved that collaboration-related code is still being pulled into the editor entry even after chunk tuning. The remaining root cause is app-level usage of BlockNote view and formatting helpers that import comment-aware default UI modules.

## Considered Options

### Option 1: Disable comments and collaboration through props only

- Pass `comments={false}` and related flags to the existing BlockNote view

**Pros**

- Smallest code diff

**Cons**

- Does not remove the import chain, because the current BlockNote view module imports the default comments-aware UI unconditionally

### Option 2: Replace the default BlockNote view with a local lightweight wrapper

- Keep the same editor instance and visible non-collaboration controllers
- Manually mount only the controllers the product actually uses
- Replace formatting toolbar helper usage with a local comment-free toolbar

**Pros**

- Removes the proven app-level import path into comments and collaboration code
- Preserves current user-visible editor behavior outside collaboration
- Fits the product requirement exactly

**Cons**

- Slightly more code than a prop-only change
- Introduces a local wrapper that mirrors a subset of upstream BlockNote view behavior

## Decision

Adopt **Option 2**.

Implementation outline:

- add a local lightweight editor view under `src/shared/editor`
- stop using the default `@blocknote/mantine` BlockNote view wrapper
- stop using formatting toolbar helpers that import comment buttons
- keep slash menu, link toolbar, side menu, file panel, and table handles
- remove comments and collaboration from the app-level editor surface

Verification standard:

- focused tests fail first, then pass
- `npm test` passes
- `npm run typecheck` passes
- `npm run build` passes
- the build output no longer emits an `editor-blocknote-collab` chunk
