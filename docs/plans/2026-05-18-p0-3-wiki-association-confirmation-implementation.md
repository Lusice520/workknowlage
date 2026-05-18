# P0.3 Wiki Association Confirmation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the user confirmation layer for Wiki association documents: pin, ignore, convert to manual association, view all evidence, and persist these choices locally.

**Architecture:** Keep association derivation pure and deterministic in `src/shared/lib/sidebarAssociations.ts`. Add a local SQLite decision repository exposed through Electron IPC and the browser fallback API, then merge derived associations with user decisions in app-level hooks before rendering `RightSidebar`. `RightSidebar` remains a presentation component that receives prepared state and action callbacks.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Electron IPC, better-sqlite3, Tailwind utilities, lucide-react.

---

## Task 1: Add SQLite Decision Schema And Repository

**Files:**
- Modify: `electron/db/schema.cjs`
- Create: `electron/db/repositories/wikiAssociationDecisions.cjs`
- Create: `scripts/electronWikiAssociationDecisionsSmoke.cjs`
- Create: `electron/db/repositories/wikiAssociationDecisions.smoke.test.ts`

**Step 1: Write the failing smoke test**

Create `electron/db/repositories/wikiAssociationDecisions.smoke.test.ts`:

```ts
/// <reference types="node" />
// @vitest-environment node

import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const smokeScriptPath = path.resolve(process.cwd(), 'scripts/electronWikiAssociationDecisionsSmoke.cjs');

test('persists wiki association decisions across Electron SQLite reopen', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-wiki-decisions-'));

  try {
    const result = spawnSync(electronBinary, [smokeScriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        WORKKNOWLAGE_USER_DATA_DIR: userDataDir,
      },
      timeout: 30_000,
      encoding: 'utf8',
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error([`status ${String(result.status)}`, result.stderr, result.stdout].filter(Boolean).join('\n'));
    }

    const resultLine = String(result.stdout || '').trim().split('\n').findLast((line) => line.startsWith('__WIKI_DECISIONS__'));
    const smokeResult = JSON.parse(resultLine?.replace('__WIKI_DECISIONS__', '') ?? '{}');

    expect(smokeResult.ok).toBe(true);
    expect(smokeResult.reopenedDecisions).toEqual([
      expect.objectContaining({
        workspaceId: smokeResult.spaceId,
        sourceDocumentId: smokeResult.sourceDocumentId,
        targetDocumentId: smokeResult.targetDocumentId,
        status: 'manual',
      }),
    ]);
    expect(smokeResult.afterClear).toEqual([]);
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}, 30_000);
```

**Step 2: Write the failing smoke script**

Create `scripts/electronWikiAssociationDecisionsSmoke.cjs`:

```js
const { initDatabase, closeDatabase } = require('../electron/db/index.cjs');
const spacesRepo = require('../electron/db/repositories/spaces.cjs');
const documentsRepo = require('../electron/db/repositories/documents.cjs');
const decisionsRepo = require('../electron/db/repositories/wikiAssociationDecisions.cjs');

async function runSmoke() {
  initDatabase();

  const space = spacesRepo.createSpace({ name: 'Wiki Decision Space', label: 'WORKSPACE' });
  const source = documentsRepo.createDocument({ spaceId: space.id, folderId: null, title: 'Source Doc' });
  const target = documentsRepo.createDocument({ spaceId: space.id, folderId: null, title: 'Target Doc' });

  decisionsRepo.setWikiAssociationDecision({
    workspaceId: space.id,
    sourceDocumentId: source.id,
    targetDocumentId: target.id,
    status: 'pinned',
  });
  decisionsRepo.setWikiAssociationDecision({
    workspaceId: space.id,
    sourceDocumentId: source.id,
    targetDocumentId: target.id,
    status: 'manual',
  });

  closeDatabase();
  initDatabase();

  const reopenedDecisions = decisionsRepo.listWikiAssociationDecisionsForSource({
    workspaceId: space.id,
    sourceDocumentId: source.id,
  });
  decisionsRepo.clearWikiAssociationDecision({
    workspaceId: space.id,
    sourceDocumentId: source.id,
    targetDocumentId: target.id,
  });
  const afterClear = decisionsRepo.listWikiAssociationDecisionsForSource({
    workspaceId: space.id,
    sourceDocumentId: source.id,
  });

  closeDatabase();
  console.log(`__WIKI_DECISIONS__${JSON.stringify({
    ok: true,
    spaceId: space.id,
    sourceDocumentId: source.id,
    targetDocumentId: target.id,
    reopenedDecisions,
    afterClear,
  })}`);
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Wiki association decisions smoke failed:', error);
    process.exitCode = 1;
  });
```

**Step 3: Run the test to verify it fails**

Run:

```bash
rtk npm test -- electron/db/repositories/wikiAssociationDecisions.smoke.test.ts
```

Expected: FAIL because `wikiAssociationDecisions.cjs` does not exist and the schema has no `wiki_association_decisions` table.

**Step 4: Add the schema**

Modify `electron/db/schema.cjs` after the `backlinks` table:

```sql
CREATE TABLE IF NOT EXISTS wiki_association_decisions (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status             TEXT NOT NULL CHECK(status IN ('pinned','manual','ignored')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(source_document_id <> target_document_id),
  UNIQUE(workspace_id, source_document_id, target_document_id)
);
```

Add indexes near the other indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_wiki_association_decisions_source
  ON wiki_association_decisions(workspace_id, source_document_id);
CREATE INDEX IF NOT EXISTS idx_wiki_association_decisions_target
  ON wiki_association_decisions(workspace_id, target_document_id);
```

**Step 5: Add the repository**

Create `electron/db/repositories/wikiAssociationDecisions.cjs`:

```js
const crypto = require('node:crypto');

const VALID_STATUSES = new Set(['pinned', 'manual', 'ignored']);

function resolveDatabase(database) {
  if (database) return database;
  return require('../index.cjs').getDatabase();
}

function normalizeDecisionInput(input) {
  const workspaceId = String(input?.workspaceId ?? '').trim();
  const sourceDocumentId = String(input?.sourceDocumentId ?? '').trim();
  const targetDocumentId = String(input?.targetDocumentId ?? '').trim();
  const status = String(input?.status ?? '').trim();

  if (!workspaceId || !sourceDocumentId || !targetDocumentId) {
    throw new Error('workspaceId, sourceDocumentId, and targetDocumentId are required');
  }
  if (sourceDocumentId === targetDocumentId) {
    throw new Error('sourceDocumentId and targetDocumentId must be different');
  }
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid wiki association status: ${status}`);
  }

  return { workspaceId, sourceDocumentId, targetDocumentId, status };
}

function mapDecision(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceDocumentId: row.source_document_id,
    targetDocumentId: row.target_document_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildDecisionId(workspaceId, sourceDocumentId, targetDocumentId) {
  const hash = crypto
    .createHash('sha1')
    .update(`${workspaceId}:${sourceDocumentId}:${targetDocumentId}`)
    .digest('hex')
    .slice(0, 16);
  return `wiki-association-${hash}`;
}

function listWikiAssociationDecisionsForSource({ workspaceId, sourceDocumentId }, database) {
  const resolvedDatabase = resolveDatabase(database);
  return resolvedDatabase
    .prepare(`
      SELECT *
      FROM wiki_association_decisions
      WHERE workspace_id = ?
        AND source_document_id = ?
      ORDER BY updated_at DESC
    `)
    .all(workspaceId, sourceDocumentId)
    .map(mapDecision);
}

function setWikiAssociationDecision(input, database) {
  const resolvedDatabase = resolveDatabase(database);
  const normalized = normalizeDecisionInput(input);
  const id = buildDecisionId(
    normalized.workspaceId,
    normalized.sourceDocumentId,
    normalized.targetDocumentId,
  );

  resolvedDatabase
    .prepare(`
      INSERT INTO wiki_association_decisions (
        id, workspace_id, source_document_id, target_document_id, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(workspace_id, source_document_id, target_document_id)
      DO UPDATE SET status = excluded.status, updated_at = datetime('now')
    `)
    .run(
      id,
      normalized.workspaceId,
      normalized.sourceDocumentId,
      normalized.targetDocumentId,
      normalized.status,
    );

  return listWikiAssociationDecisionsForSource({
    workspaceId: normalized.workspaceId,
    sourceDocumentId: normalized.sourceDocumentId,
  }, resolvedDatabase).find((decision) => decision.targetDocumentId === normalized.targetDocumentId);
}

function clearWikiAssociationDecision({ workspaceId, sourceDocumentId, targetDocumentId }, database) {
  const resolvedDatabase = resolveDatabase(database);
  resolvedDatabase
    .prepare(`
      DELETE FROM wiki_association_decisions
      WHERE workspace_id = ?
        AND source_document_id = ?
        AND target_document_id = ?
    `)
    .run(workspaceId, sourceDocumentId, targetDocumentId);
}

module.exports = {
  listWikiAssociationDecisionsForSource,
  setWikiAssociationDecision,
  clearWikiAssociationDecision,
};
```

**Step 6: Run the test to verify it passes**

Run:

```bash
rtk npm test -- electron/db/repositories/wikiAssociationDecisions.smoke.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add electron/db/schema.cjs electron/db/repositories/wikiAssociationDecisions.cjs scripts/electronWikiAssociationDecisionsSmoke.cjs electron/db/repositories/wikiAssociationDecisions.smoke.test.ts
git commit -m "feat: persist wiki association decisions"
```

## Task 2: Expose Decisions Through API, IPC, And Browser Fallback

**Files:**
- Modify: `src/shared/types/preload.ts`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/lib/workKnowlageApi.mock.ts`
- Test: `src/shared/lib/workKnowlageApi.mock.test.ts` if present; otherwise add coverage in `src/app/useWikiAssociationDecisions.test.tsx` in Task 4.

**Step 1: Extend shared preload types**

Add near the existing preload types:

```ts
export type WikiAssociationDecisionStatus = 'pinned' | 'manual' | 'ignored';

export interface WikiAssociationDecisionRecord {
  id: string;
  workspaceId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  status: WikiAssociationDecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WikiAssociationDecisionInput {
  workspaceId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  status: WikiAssociationDecisionStatus;
}
```

Add to `WorkKnowlageDesktopApi`:

```ts
wikiAssociations?: {
  listDecisionsForSource: (
    workspaceId: string,
    sourceDocumentId: string,
  ) => Promise<WikiAssociationDecisionRecord[]>;
  setDecision: (input: WikiAssociationDecisionInput) => Promise<WikiAssociationDecisionRecord | null>;
  clearDecision: (
    workspaceId: string,
    sourceDocumentId: string,
    targetDocumentId: string,
  ) => Promise<void>;
};
```

**Step 2: Wire Electron main IPC**

Modify `electron/main.cjs`:

```js
const wikiAssociationDecisionsRepo = require('./db/repositories/wikiAssociationDecisions.cjs');
```

Register handlers near the workspace/search handlers:

```js
ipcMain.handle('wikiAssociations:listDecisionsForSource', (_event, workspaceId, sourceDocumentId) =>
  wikiAssociationDecisionsRepo.listWikiAssociationDecisionsForSource({ workspaceId, sourceDocumentId })
);
ipcMain.handle('wikiAssociations:setDecision', (_event, input) =>
  wikiAssociationDecisionsRepo.setWikiAssociationDecision(input)
);
ipcMain.handle('wikiAssociations:clearDecision', (_event, workspaceId, sourceDocumentId, targetDocumentId) =>
  wikiAssociationDecisionsRepo.clearWikiAssociationDecision({ workspaceId, sourceDocumentId, targetDocumentId })
);
```

**Step 3: Wire preload**

Modify `electron/preload.cjs`:

```js
wikiAssociations: {
  listDecisionsForSource: (workspaceId, sourceDocumentId) =>
    ipcRenderer.invoke('wikiAssociations:listDecisionsForSource', workspaceId, sourceDocumentId),
  setDecision: (input) => ipcRenderer.invoke('wikiAssociations:setDecision', input),
  clearDecision: (workspaceId, sourceDocumentId, targetDocumentId) =>
    ipcRenderer.invoke('wikiAssociations:clearDecision', workspaceId, sourceDocumentId, targetDocumentId),
},
```

**Step 4: Add browser fallback state**

Modify `src/shared/lib/workKnowlageApi.mock.ts` so fallback mode supports the same namespace. Store records in a local array closed over by `createMutableFallbackDesktopApi`.

Implementation shape:

```ts
let wikiAssociationDecisions: WikiAssociationDecisionRecord[] = [];

const findDecisionIndex = (workspaceId: string, sourceDocumentId: string, targetDocumentId: string) =>
  wikiAssociationDecisions.findIndex(
    (decision) =>
      decision.workspaceId === workspaceId &&
      decision.sourceDocumentId === sourceDocumentId &&
      decision.targetDocumentId === targetDocumentId,
  );
```

Expose:

```ts
wikiAssociations: {
  async listDecisionsForSource(workspaceId, sourceDocumentId) {
    return wikiAssociationDecisions.filter(
      (decision) => decision.workspaceId === workspaceId && decision.sourceDocumentId === sourceDocumentId,
    );
  },
  async setDecision(input) {
    const now = new Date().toISOString();
    const existingIndex = findDecisionIndex(input.workspaceId, input.sourceDocumentId, input.targetDocumentId);
    const nextDecision = {
      id: `wiki-association-${input.workspaceId}-${input.sourceDocumentId}-${input.targetDocumentId}`,
      ...input,
      createdAt: existingIndex >= 0 ? wikiAssociationDecisions[existingIndex].createdAt : now,
      updatedAt: now,
    };
    if (existingIndex >= 0) {
      wikiAssociationDecisions[existingIndex] = nextDecision;
    } else {
      wikiAssociationDecisions.push(nextDecision);
    }
    return nextDecision;
  },
  async clearDecision(workspaceId, sourceDocumentId, targetDocumentId) {
    wikiAssociationDecisions = wikiAssociationDecisions.filter(
      (decision) =>
        decision.workspaceId !== workspaceId ||
        decision.sourceDocumentId !== sourceDocumentId ||
        decision.targetDocumentId !== targetDocumentId,
    );
  },
},
```

**Step 5: Run focused typecheck**

Run:

```bash
rtk npm run typecheck
```

Expected: PASS. If TypeScript complains about optional `wikiAssociations`, keep the API optional and guard in app hooks so older preload objects degrade gracefully.

**Step 6: Commit**

```bash
git add src/shared/types/preload.ts electron/main.cjs electron/preload.cjs src/shared/lib/workKnowlageApi.mock.ts
git commit -m "feat: expose wiki association decisions api"
```

## Task 3: Add Pure Decision Merge Logic

**Files:**
- Modify: `src/shared/lib/sidebarAssociations.ts`
- Modify: `src/shared/lib/sidebarAssociations.test.ts`

**Step 1: Write failing tests**

Add tests to `src/shared/lib/sidebarAssociations.test.ts`:

```ts
test('pins an associated document ahead of ordinary algorithmic associations', () => {
  const base = deriveSidebarAssociations({ activeDocument, documents, folders });
  const merged = mergeSidebarAssociationDecisions({
    associationState: base,
    activeDocument,
    documents,
    folders,
    decisions: [{
      id: 'decision-1',
      workspaceId: activeDocument.spaceId,
      sourceDocumentId: activeDocument.id,
      targetDocumentId: 'target-doc',
      status: 'pinned',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    }],
  });

  expect(merged.associatedDocuments[0]).toMatchObject({
    documentId: 'target-doc',
    decisionStatus: 'pinned',
  });
});

test('hides ignored algorithmic associated documents and excludes them from wiki count', () => {
  const base = deriveSidebarAssociations({ activeDocument, documents, folders });
  const merged = mergeSidebarAssociationDecisions({
    associationState: base,
    activeDocument,
    documents,
    folders,
    decisions: [{
      id: 'decision-ignored',
      workspaceId: activeDocument.spaceId,
      sourceDocumentId: activeDocument.id,
      targetDocumentId: 'target-doc',
      status: 'ignored',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    }],
  });

  expect(merged.associatedDocuments.some((document) => document.documentId === 'target-doc')).toBe(false);
  expect(merged.ignoredAssociatedDocuments).toEqual([
    expect.objectContaining({ documentId: 'target-doc', decisionStatus: 'ignored' }),
  ]);
});

test('keeps manual associations even when there is no current evidence', () => {
  const merged = mergeSidebarAssociationDecisions({
    associationState: emptyAssociationState,
    activeDocument,
    documents: [activeDocument, targetDocument],
    folders,
    decisions: [{
      id: 'decision-manual',
      workspaceId: activeDocument.spaceId,
      sourceDocumentId: activeDocument.id,
      targetDocumentId: targetDocument.id,
      status: 'manual',
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    }],
  });

  expect(merged.associatedDocuments).toEqual([
    expect.objectContaining({
      documentId: targetDocument.id,
      decisionStatus: 'manual',
      hasCurrentEvidence: false,
    }),
  ]);
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: FAIL because `mergeSidebarAssociationDecisions` and decision fields do not exist.

**Step 3: Add shared decision types**

Modify `src/shared/lib/sidebarAssociations.ts`:

```ts
export type SidebarAssociationDecisionStatus = 'pinned' | 'manual' | 'ignored';

export interface SidebarAssociationDecisionRecord {
  id: string;
  workspaceId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  status: SidebarAssociationDecisionStatus;
  createdAt: string;
  updatedAt: string;
}
```

Extend `SidebarAssociatedDocument`:

```ts
decisionStatus?: Exclude<SidebarAssociationDecisionStatus, 'ignored'>;
hasCurrentEvidence?: boolean;
```

Add:

```ts
export interface SidebarIgnoredAssociatedDocument {
  documentId: string;
  title: string;
  folderPath: string;
  decisionStatus: 'ignored';
  updatedAt: string;
}
```

Extend `SidebarAssociationResult`:

```ts
ignoredAssociatedDocuments: SidebarIgnoredAssociatedDocument[];
```

Update every empty/default result object in source and tests to include `ignoredAssociatedDocuments: []`.

**Step 4: Implement the pure merge helper**

Add near the associated document helpers:

```ts
export const mergeSidebarAssociationDecisions = ({
  associationState,
  activeDocument,
  documents,
  folders,
  decisions,
}: {
  associationState: SidebarAssociationResult;
  activeDocument: DocumentRecord | null;
  documents: DocumentRecord[];
  folders: FolderNode[];
  decisions: SidebarAssociationDecisionRecord[];
}): SidebarAssociationResult => {
  if (!activeDocument || decisions.length === 0) {
    return {
      ...associationState,
      ignoredAssociatedDocuments: associationState.ignoredAssociatedDocuments ?? [],
    };
  }

  const decisionsByTarget = new Map(decisions.map((decision) => [decision.targetDocumentId, decision]));
  const ignoredAssociatedDocuments: SidebarIgnoredAssociatedDocument[] = [];
  const documentById = new Map(documents.map((document) => [document.id, document]));

  const associatedDocuments = associationState.associatedDocuments
    .filter((associatedDocument) => {
      const decision = decisionsByTarget.get(associatedDocument.documentId);
      if (decision?.status !== 'ignored') return true;
      ignoredAssociatedDocuments.push({
        documentId: associatedDocument.documentId,
        title: associatedDocument.title,
        folderPath: associatedDocument.folderPath,
        decisionStatus: 'ignored',
        updatedAt: decision.updatedAt,
      });
      return false;
    })
    .map((associatedDocument) => {
      const decision = decisionsByTarget.get(associatedDocument.documentId);
      return decision?.status === 'pinned' || decision?.status === 'manual'
        ? {
            ...associatedDocument,
            decisionStatus: decision.status,
            hasCurrentEvidence: getAssociatedDocumentEvidenceCount(associatedDocument) > 0,
          }
        : associatedDocument;
    });

  decisions.forEach((decision) => {
    if (decision.status === 'ignored' || associatedDocuments.some((document) => document.documentId === decision.targetDocumentId)) {
      return;
    }

    const targetDocument = documentById.get(decision.targetDocumentId);
    if (!targetDocument || targetDocument.deletedAt) {
      return;
    }

    associatedDocuments.push({
      documentId: targetDocument.id,
      title: targetDocument.title,
      folderPath: getFolderPathLabel(targetDocument.folderId, folders),
      score: decision.status === 'manual' ? 2 : 1.5,
      badges: [],
      similarityEvidence: [],
      textEvidence: [],
      decisionStatus: decision.status,
      hasCurrentEvidence: false,
    });
  });

  associatedDocuments.sort(compareAssociatedDocumentsWithDecisions);

  return {
    ...associationState,
    associatedDocuments,
    ignoredAssociatedDocuments,
    summary: {
      ...associationState.summary,
      wikiAssociationCount: associatedDocuments.length,
    },
  };
};
```

Implement `compareAssociatedDocumentsWithDecisions` so `manual` sorts before `pinned`, both sort before ordinary associations, then existing score/evidence sorting applies.

**Step 5: Run tests to verify they pass**

Run:

```bash
rtk npm test -- src/shared/lib/sidebarAssociations.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/shared/lib/sidebarAssociations.ts src/shared/lib/sidebarAssociations.test.ts
git commit -m "feat: merge wiki association decisions"
```

## Task 4: Add App-Level Decision Hook And Wire AppShell

**Files:**
- Create: `src/app/useWikiAssociationDecisions.ts`
- Create: `src/app/useWikiAssociationDecisions.test.tsx`
- Modify: `src/features/shell/AppShell.tsx`
- Modify: `src/app/useSidebarAssociations.test.tsx` only if empty association shape changes break existing tests.

**Step 1: Write failing hook tests**

Create `src/app/useWikiAssociationDecisions.test.tsx`:

```tsx
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useWikiAssociationDecisions } from './useWikiAssociationDecisions';

test('loads decisions for the active source document and exposes set and clear actions', async () => {
  const api = {
    wikiAssociations: {
      listDecisionsForSource: vi.fn().mockResolvedValue([]),
      setDecision: vi.fn().mockResolvedValue({
        id: 'decision-1',
        workspaceId: 'space-1',
        sourceDocumentId: 'source-1',
        targetDocumentId: 'target-1',
        status: 'pinned',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-18T00:00:00.000Z',
      }),
      clearDecision: vi.fn().mockResolvedValue(undefined),
    },
  };

  const { result } = renderHook(() =>
    useWikiAssociationDecisions({
      workspaceId: 'space-1',
      sourceDocumentId: 'source-1',
      api: api as never,
    }),
  );

  await waitFor(() => expect(api.wikiAssociations.listDecisionsForSource).toHaveBeenCalledWith('space-1', 'source-1'));

  await act(async () => {
    await result.current.setDecision('target-1', 'pinned');
  });
  expect(result.current.decisions).toEqual([
    expect.objectContaining({ targetDocumentId: 'target-1', status: 'pinned' }),
  ]);

  await act(async () => {
    await result.current.clearDecision('target-1');
  });
  expect(api.wikiAssociations.clearDecision).toHaveBeenCalledWith('space-1', 'source-1', 'target-1');
});
```

**Step 2: Run the hook test to verify it fails**

Run:

```bash
rtk npm test -- src/app/useWikiAssociationDecisions.test.tsx
```

Expected: FAIL because the hook does not exist.

**Step 3: Implement the hook**

Create `src/app/useWikiAssociationDecisions.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import type {
  WikiAssociationDecisionRecord,
  WikiAssociationDecisionStatus,
  WorkKnowlageDesktopApi,
} from '../shared/types/preload';

export function useWikiAssociationDecisions({
  workspaceId,
  sourceDocumentId,
  api = getWorkKnowlageApi(),
}: {
  workspaceId: string | null | undefined;
  sourceDocumentId: string | null | undefined;
  api?: WorkKnowlageDesktopApi;
}) {
  const [decisions, setDecisions] = useState<WikiAssociationDecisionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!workspaceId || !sourceDocumentId || !api.wikiAssociations) {
      setDecisions([]);
      return;
    }

    setIsLoading(true);
    try {
      setDecisions(await api.wikiAssociations.listDecisionsForSource(workspaceId, sourceDocumentId));
    } finally {
      setIsLoading(false);
    }
  }, [api, sourceDocumentId, workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setDecision = useCallback(async (targetDocumentId: string, status: WikiAssociationDecisionStatus) => {
    if (!workspaceId || !sourceDocumentId || !api.wikiAssociations) return;
    const nextDecision = await api.wikiAssociations.setDecision({
      workspaceId,
      sourceDocumentId,
      targetDocumentId,
      status,
    });
    if (!nextDecision) {
      await reload();
      return;
    }
    setDecisions((current) => [
      nextDecision,
      ...current.filter((decision) => decision.targetDocumentId !== targetDocumentId),
    ]);
  }, [api, reload, sourceDocumentId, workspaceId]);

  const clearDecision = useCallback(async (targetDocumentId: string) => {
    if (!workspaceId || !sourceDocumentId || !api.wikiAssociations) return;
    await api.wikiAssociations.clearDecision(workspaceId, sourceDocumentId, targetDocumentId);
    setDecisions((current) => current.filter((decision) => decision.targetDocumentId !== targetDocumentId));
  }, [api, sourceDocumentId, workspaceId]);

  return {
    decisions,
    isLoading,
    reload,
    setDecision,
    clearDecision,
  };
}
```

**Step 4: Wire AppShell merge**

Modify `src/features/shell/AppShell.tsx`:

```ts
import { useMemo } from 'react';
import { useWikiAssociationDecisions } from '../../app/useWikiAssociationDecisions';
import { mergeSidebarAssociationDecisions } from '../../shared/lib/sidebarAssociations';
```

Then:

```ts
const derivedAssociationState = useSidebarAssociations({
  activeDocument: ws.activeDocument,
  documents: ws.state.seed.documents,
  folders: ws.state.seed.folders,
  focusedOutlineItemId,
});

const wikiAssociationDecisions = useWikiAssociationDecisions({
  workspaceId: ws.activeDocument?.spaceId,
  sourceDocumentId: ws.activeDocument?.id,
});

const associationState = useMemo(
  () =>
    mergeSidebarAssociationDecisions({
      associationState: derivedAssociationState,
      activeDocument: ws.activeDocument,
      documents: ws.state.seed.documents,
      folders: ws.state.seed.folders,
      decisions: wikiAssociationDecisions.decisions,
    }),
  [derivedAssociationState, wikiAssociationDecisions.decisions, ws.activeDocument, ws.state.seed.documents, ws.state.seed.folders],
);
```

Pass `wikiAssociationDecisions.setDecision` and `wikiAssociationDecisions.clearDecision` to `RightSidebar` in Task 5.

**Step 5: Run tests**

Run:

```bash
rtk npm test -- src/app/useWikiAssociationDecisions.test.tsx src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebarContract.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/useWikiAssociationDecisions.ts src/app/useWikiAssociationDecisions.test.tsx src/features/shell/AppShell.tsx src/app/useSidebarAssociations.test.tsx
git commit -m "feat: load wiki association decisions"
```

## Task 5: Update RightSidebar UI For Actions, Detail View, And Ignored Restore

**Files:**
- Modify: `src/features/shell/RightSidebar.tsx`
- Modify: `src/features/shell/RightSidebar.test.tsx`
- Modify: `src/features/shell/AppShell.tsx`

**Step 1: Write failing RightSidebar tests**

Add tests to `src/features/shell/RightSidebar.test.tsx`:

```tsx
test('renders pinned and manual association states and calls decision handlers', async () => {
  const onSetAssociationDecision = vi.fn().mockResolvedValue(undefined);
  const onClearAssociationDecision = vi.fn().mockResolvedValue(undefined);

  render(
    <RightSidebar
      {...baseProps}
      associationState={{
        ...emptyAssociationState,
        associatedDocuments: [{
          documentId: 'target-doc',
          title: '问题清单宣贯稿内容',
          folderPath: '知识库',
          score: 2,
          badges: ['原文命中'],
          similarityEvidence: [],
          textEvidence: [],
          decisionStatus: 'pinned',
          hasCurrentEvidence: false,
        }],
      }}
      onSetAssociationDecision={onSetAssociationDecision}
      onClearAssociationDecision={onClearAssociationDecision}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Wiki' }));
  expect(screen.getByText('已固定')).toBeInTheDocument();
  expect(screen.getByText('暂无当前线索')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '取消固定 问题清单宣贯稿内容' }));
  expect(onClearAssociationDecision).toHaveBeenCalledWith('target-doc');
});

test('opens all evidence detail from associated document card', async () => {
  render(<RightSidebar {...propsWithEvidence} />);
  fireEvent.click(screen.getByRole('button', { name: 'Wiki' }));
  await userEvent.click(screen.getByRole('button', { name: '查看全部线索 问题清单宣贯稿内容' }));

  expect(screen.getByText('全部线索')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /打开原文证据/ })).toBeInTheDocument();
});

test('renders ignored association restore entry', async () => {
  const onClearAssociationDecision = vi.fn().mockResolvedValue(undefined);
  render(<RightSidebar {...propsWithIgnoredDocuments} onClearAssociationDecision={onClearAssociationDecision} />);
  fireEvent.click(screen.getByRole('button', { name: 'Wiki' }));

  expect(screen.getByText('已忽略 1')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '恢复关联 无标题文档' }));
  expect(onClearAssociationDecision).toHaveBeenCalledWith('ignored-doc');
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
rtk npm test -- src/features/shell/RightSidebar.test.tsx
```

Expected: FAIL because props, buttons, status labels, detail view, and ignored restore UI do not exist.

**Step 3: Extend RightSidebar props**

Add props:

```ts
onSetAssociationDecision?: (
  targetDocumentId: string,
  status: 'pinned' | 'manual' | 'ignored',
) => Promise<void>;
onClearAssociationDecision?: (targetDocumentId: string) => Promise<void>;
```

Pass the hooks from `AppShell.tsx`:

```tsx
<RightSidebar
  ...
  onSetAssociationDecision={wikiAssociationDecisions.setDecision}
  onClearAssociationDecision={wikiAssociationDecisions.clearDecision}
/>
```

**Step 4: Add compact card actions**

Use lucide icons instead of text-heavy controls:

```ts
import { Eye, Link2, Pin, PinOff, RotateCcw, Slash } from 'lucide-react';
```

On each associated document card, add icon buttons with accessible names:

```tsx
<button
  type="button"
  aria-label={`${associatedDocument.decisionStatus === 'pinned' ? '取消固定' : '固定关联'} ${associatedDocument.title}`}
  onClick={(event) => {
    event.stopPropagation();
    void (associatedDocument.decisionStatus === 'pinned'
      ? onClearAssociationDecision?.(associatedDocument.documentId)
      : onSetAssociationDecision?.(associatedDocument.documentId, 'pinned'));
  }}
>
  {associatedDocument.decisionStatus === 'pinned' ? <PinOff size={13} /> : <Pin size={13} />}
</button>
```

Add similar buttons for:

1. `查看全部线索 <title>` -> set local detail document id.
2. `转为手动关联 <title>` -> `onSetAssociationDecision(documentId, 'manual')`.
3. `忽略关联 <title>` -> `window.confirm(...)` then `onSetAssociationDecision(documentId, 'ignored')`.

**Step 5: Add status labels and missing-evidence copy**

Render status labels separately from evidence badges:

```tsx
{associatedDocument.decisionStatus === 'pinned' ? <span>已固定</span> : null}
{associatedDocument.decisionStatus === 'manual' ? <span>手动关联</span> : null}
{associatedDocument.hasCurrentEvidence === false ? (
  <span className="mt-1 block truncate text-[11px] text-slate-400">暂无当前线索</span>
) : null}
```

Do not add `已固定` or `手动关联` to the `badges` evidence array; those are relationship states, not evidence types.

**Step 6: Add right-sidebar detail view**

Add state:

```ts
const [detailAssociatedDocumentId, setDetailAssociatedDocumentId] = useState<string | null>(null);
```

Derive:

```ts
const detailAssociatedDocument = associatedDocuments.find(
  (document) => document.documentId === detailAssociatedDocumentId,
) ?? null;
```

When set, render a `全部线索` view inside the Wiki section instead of the list:

1. Header with back button.
2. Target document title.
3. Status actions.
4. `原文命中` evidence list.
5. `相似证据` evidence list.

Reuse existing evidence click behavior:

```tsx
onOpenBacklinkDocument?.({
  documentId: evidence.documentId,
  blockId: evidence.blockId,
  fallbackText: evidence.snippet || evidence.matchedText,
  highlightQuery: evidence.matchedText,
});
```

**Step 7: Add ignored restore entry**

If `associationState.ignoredAssociatedDocuments.length > 0`, render a compact section below associated documents:

```tsx
<p className={referenceSectionLabelStyle}>已忽略 {associationState.ignoredAssociatedDocuments.length}</p>
```

Each row has:

1. target title.
2. `恢复关联 <title>` button.
3. `onClearAssociationDecision(documentId)`.

**Step 8: Run RightSidebar tests**

Run:

```bash
rtk npm test -- src/features/shell/RightSidebar.test.tsx src/features/shell/RightSidebarContract.test.ts
```

Expected: PASS.

**Step 9: Commit**

```bash
git add src/features/shell/RightSidebar.tsx src/features/shell/RightSidebar.test.tsx src/features/shell/AppShell.tsx
git commit -m "feat: add wiki association decision controls"
```

## Task 6: Final Verification And Release Notes Prep

**Files:**
- Create: `docs/plans/2026-05-18-p0-3-wiki-association-confirmation-verification.md`
- Modify: release notes only when preparing the next build.

**Step 1: Run focused tests**

Run:

```bash
rtk npm test -- electron/db/repositories/wikiAssociationDecisions.smoke.test.ts src/shared/lib/sidebarAssociations.test.ts src/app/useWikiAssociationDecisions.test.tsx src/app/useSidebarAssociations.test.tsx src/features/shell/RightSidebar.test.tsx src/features/shell/RightSidebarContract.test.ts
```

Expected: PASS.

**Step 2: Run full test suite**

Run:

```bash
rtk npm test
```

Expected: PASS.

**Step 3: Run typecheck**

Run:

```bash
rtk npm run typecheck
```

Expected: PASS.

**Step 4: Manual product smoke**

Use a workspace with one source document and two associated target documents:

1. Open source document.
2. Switch to Wiki tab.
3. Fix one associated document with `固定`.
4. Ignore the other associated document.
5. Switch away and back; verify fixed remains and ignored stays hidden.
6. Restore ignored; verify it returns if current evidence still exists.
7. Convert fixed document to `手动关联`; verify no content is inserted into the editor.
8. Open `查看全部线索`; click original text evidence; verify target document opens and matched text highlights.

**Step 5: Write verification note**

Create `docs/plans/2026-05-18-p0-3-wiki-association-confirmation-verification.md`:

```md
# P0.3 Wiki Association Confirmation Verification

**Date:** 2026-05-18
**Status:** Verified / Pending

## Automated Checks

- [ ] `rtk npm test -- ...focused files...`
- [ ] `rtk npm test`
- [ ] `rtk npm run typecheck`

## Manual Smoke

- [ ] Fixed association persists.
- [ ] Ignored association stays hidden and can be restored.
- [ ] Manual association does not edit document content.
- [ ] All evidence detail opens and original text highlight works.

## Notes

...
```

**Step 6: Commit**

```bash
git add docs/plans/2026-05-18-p0-3-wiki-association-confirmation-verification.md
git commit -m "docs: verify wiki association confirmation"
```

## Implementation Order

1. Task 1 first because persistent decisions are the source of truth.
2. Task 2 second so renderer code has a typed API.
3. Task 3 third so merge behavior is pure and testable before UI.
4. Task 4 fourth so AppShell owns orchestration.
5. Task 5 fifth so RightSidebar stays presentational.
6. Task 6 last for confidence before packaging.

## Non-Goals

1. Do not implement evidence-level accept / ignore in this slice.
2. Do not auto-insert `@docMention` into document content.
3. Do not introduce graph view changes.
4. Do not change semantic similarity thresholds.
5. Do not add remote AI, embedding, or cloud sync.
