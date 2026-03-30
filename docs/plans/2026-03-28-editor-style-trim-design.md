# Editor Style Trim Design

**Goal:** Reduce the remaining BlockNote editor CSS payload without removing emoji support or changing the current single-user editor behavior.

**Observed issue:** The JavaScript side of the editor bundle has already been trimmed, but [main.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/main.tsx) still imports `@blocknote/mantine/style.css`. That upstream stylesheet pulls a very broad Mantine CSS set for many components the product never renders.

## Options

### Option 1: Keep the upstream `@blocknote/mantine/style.css`

**Pros**

- Zero maintenance

**Cons**

- Keeps the editor CSS oversized
- Continues importing many unrelated Mantine component styles

### Option 2: Replace it with a local trimmed editor stylesheet

**Pros**

- Preserves current editor behavior, including emoji support
- Limits CSS imports to the Mantine components the editor actually uses
- Avoids introducing loading flicker or a new runtime loading path

**Cons**

- Requires curating a local CSS entry
- Needs regression coverage so future refactors do not reintroduce the broad upstream stylesheet

### Option 3: Dynamically load editor styles with the lazy editor boundary

**Pros**

- Potentially smaller initial non-editor route payload

**Cons**

- Higher risk of visible FOUC or test instability
- More runtime complexity than we need for a closing optimization pass

## Decision

Adopt **Option 2**.

Implementation scope:

- create a local editor stylesheet entry that imports:
  - only the Mantine CSS files required by the current editor components
  - the BlockNote Mantine structural styles the app still needs
- rely on the app-wide `@mantine/core/styles.css` import for Mantine baseline variables instead of copying the upstream scoped defaults into the editor entry
- switch [main.tsx](/Volumes/WorkSpace/WorkKnowlage/WorkKnowlage/src/main.tsx) away from `@blocknote/mantine/style.css`
- add regression coverage so the app cannot silently fall back to the broad upstream stylesheet

Non-goals for this pass:

- removing emoji picker support
- adding runtime CSS lazy loading
- redesigning editor visuals

Verification standard:

- `npm run typecheck` passes
- `npm test` passes
- `npm run build` passes
- `editor-mantine` CSS output decreases relative to the current baseline
