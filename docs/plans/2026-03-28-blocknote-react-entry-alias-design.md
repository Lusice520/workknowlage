# BlockNote React Entry Alias Design

**Goal:** Remove the remaining comment-enabled `@blocknote/react` package-root bundle from the editor runtime after the collaboration stubs are already in place.

**Observed issue:** The first no-collab pass removed `yjs` assets, but `editor-blocknote-react` still bundled comment and thread UI code. The remaining path came from two places:

- app source importing `@blocknote/react` from the package root
- `@blocknote/mantine` source components importing `@blocknote/react` from the package root for shared helpers and types

## Options

### Option 1: Keep root imports and rely on more chunk splitting

**Pros**

- Minimal code churn

**Cons**

- Does not remove the comment UI code path
- Only hides the problem behind chunk boundaries

### Option 2: Introduce a curated local BlockNote React entry and alias the package root to it

**Pros**

- Removes the comment-enabled package root from both app code and Mantine source dependencies
- Preserves the current editor behavior
- Keeps the solution inside the app boundary without forking upstream packages

**Cons**

- Requires careful curation of exported helpers
- Needs a separate alias for `@blocknote/react/style.css`

## Decision

Adopt **Option 2**.

Implementation scope:

- add a curated local BlockNote React wrapper at [blocknoteReactNoComments.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/shared/editor/blocknoteReactNoComments.ts)
- migrate app source away from `@blocknote/react` package-root imports
- alias `@blocknote/react` to that wrapper in [vite.config.ts](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/vite.config.ts)
- keep `@blocknote/react/style.css` pointed at the real CSS file
- remove UI hooks for `tableHandles` because that extension is already disabled in the editor config
- add regression coverage for source imports and Vite aliases

Verification standard:

- `npm run typecheck` passes
- `npm test` passes
- `npm run build` passes
- `rg "FloatingThread|FloatingComposer|ThreadsSidebar|useThreads|useUsers|bn-thread|comments" dist/assets/editor-blocknote-react-*.js` returns no matches
