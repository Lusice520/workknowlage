import { afterEach, describe, expect, test, vi } from 'vitest';
import type { WorkKnowlageDesktopApi } from '../types/preload';
import { createInitialWorkspaceState, getActiveDocument, loadWorkspaceState } from './workspaceSelectors';

describe('workspaceSelectors', () => {
  const originalApi = window.workKnowlage;

  afterEach(() => {
    window.workKnowlage = originalApi;
  });

  test('returns the first document as active by default', () => {
    const state = createInitialWorkspaceState();
    const activeDocument = getActiveDocument(state);

    expect(activeDocument?.title).toBe('创意草案');
  });

  test('loads the requested space snapshot instead of always using the first space', async () => {
    window.workKnowlage = {
      meta: { version: '0.1.0' },
      spaces: {
        list: async () => [
          { id: 'space-alpha', name: 'Alpha', label: 'WORKSPACE' },
          { id: 'space-bravo', name: 'Bravo', label: 'WORKSPACE' },
        ],
        create: async () => ({ id: 'space-new', name: 'New', label: 'WORKSPACE' }),
        update: async () => {},
        delete: async () => {},
      },
      folders: {
        list: async (spaceId) =>
          spaceId === 'space-bravo'
            ? [{ id: 'folder-bravo', spaceId, parentId: null, name: 'Bravo Folder' }]
            : [{ id: 'folder-alpha', spaceId, parentId: null, name: 'Alpha Folder' }],
        create: async (data) => ({ id: 'folder-new', ...data }),
        rename: async () => {},
        move: async () => {},
        delete: async () => {},
      },
      documents: {
        list: async (...args) => {
          const [spaceId, folderId] = args.length === 2
            ? [args[0], args[1]]
            : [undefined, args[0]];

          if (spaceId === 'space-bravo' && folderId === null) {
            return [{
              id: 'doc-root',
              spaceId: 'space-bravo',
              folderId: null as unknown as string,
              title: 'Bravo Root Doc',
              contentJson: '[]',
              updatedAtLabel: 'today',
              wordCountLabel: '4 字',
              badgeLabel: '',
              outline: [],
              tags: [],
              backlinks: [],
              sections: [],
            }];
          }

          return folderId === 'folder-bravo'
            ? [{
                id: 'doc-bravo',
                spaceId: 'space-bravo',
                folderId,
                title: 'Bravo Doc',
                contentJson: '[]',
                updatedAtLabel: 'today',
                wordCountLabel: '10 字',
                badgeLabel: '',
                outline: [],
                tags: [],
                backlinks: [],
                sections: [],
              }]
            : (spaceId === 'space-alpha'
              ? [{
                  id: 'doc-alpha',
                  spaceId: 'space-alpha',
                  folderId,
                  title: 'Alpha Doc',
                  contentJson: '[]',
                  updatedAtLabel: 'today',
                  wordCountLabel: '10 字',
                  badgeLabel: '',
                  outline: [],
                  tags: [],
                  backlinks: [],
                  sections: [],
                }]
              : []);
        },
        getById: async () => null,
        create: async (data) => ({
          id: 'doc-new',
          ...data,
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '0 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        update: async (_id, data) => data as any,
        move: async (id, targetFolderId) => ({
          id,
          spaceId: targetFolderId === 'folder-bravo' ? 'space-bravo' : 'space-alpha',
          folderId: targetFolderId,
          title: targetFolderId === 'folder-bravo' ? 'Bravo Doc' : 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        delete: async () => {},
      },
      quickNotes: {
        get: async () => null,
        upsert: async (data) => ({
          id: 'quick-note-test',
          ...data,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        }),
        listMonth: async () => [],
        assets: {
          upload: async () => [],
        },
      },
      assets: {
        upload: async () => [],
      },
      shares: {
        get: async () => null,
        create: async () => null,
        regenerate: async () => null,
        disable: async () => null,
        getPublicUrl: async () => '',
      },
      tags: {
        listForDocument: async () => [],
        addToDocument: async () => ({ id: 'tag-new', label: '#tag', tone: 'neutral' }),
        removeFromDocument: async () => {},
      },
    } satisfies WorkKnowlageDesktopApi;

    const state = await (loadWorkspaceState as unknown as (options: {
      activeSpaceId: string;
      activeDocumentId: string;
      expandedFolderIds: string[];
    }) => Promise<Awaited<ReturnType<typeof loadWorkspaceState>>>)({
      activeSpaceId: 'space-bravo',
      activeDocumentId: 'doc-bravo',
      expandedFolderIds: ['folder-bravo'],
    });

    expect(state.activeSpaceId).toBe('space-bravo');
    expect(state.seed.folders.map((folder) => folder.id)).toEqual(['folder-bravo']);
    expect(state.seed.documents.map((document) => document.id)).toEqual(['doc-root', 'doc-bravo']);
    expect(state.activeDocumentId).toBe('doc-bravo');
    expect(state.expandedFolderIds).toEqual(['folder-bravo']);
  });

  test('loads root-level documents for the active space', async () => {
    window.workKnowlage = {
      meta: { version: '0.1.0' },
      spaces: {
        list: async () => [
          { id: 'space-bravo', name: 'Bravo', label: 'WORKSPACE' },
        ],
        create: async () => ({ id: 'space-new', name: 'New', label: 'WORKSPACE' }),
        update: async () => {},
        delete: async () => {},
      },
      folders: {
        list: async (spaceId: string) => [{ id: 'folder-bravo', spaceId, parentId: null, name: 'Bravo Folder' }],
        create: async (data: any) => ({ id: 'folder-new', ...data }),
        rename: async () => {},
        move: async () => {},
        delete: async () => {},
      },
      documents: {
        list: async (...args: any[]) => {
          const [spaceId, folderId] = args.length === 2
            ? [args[0], args[1]]
            : [undefined, args[0]];

          if (spaceId === 'space-bravo' && folderId === null) {
            return [{
              id: 'doc-root',
              spaceId: 'space-bravo',
              folderId: null as unknown as string,
              title: 'Bravo Root Doc',
              contentJson: '[]',
              updatedAtLabel: 'today',
              wordCountLabel: '4 字',
              badgeLabel: '',
              outline: [],
              tags: [],
              backlinks: [],
              sections: [],
            }];
          }

          return folderId === 'folder-bravo'
            ? [{
              id: 'doc-bravo',
              spaceId: 'space-bravo',
              folderId,
              title: 'Bravo Doc',
              contentJson: '[]',
              updatedAtLabel: 'today',
              wordCountLabel: '10 字',
              badgeLabel: '',
              outline: [],
              tags: [],
              backlinks: [],
              sections: [],
            }]
            : [];
        },
        getById: async () => null,
        create: async (data: any) => ({
          id: 'doc-new',
          ...data,
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '0 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        update: async (_id: string, data: any) => data as any,
        move: async (id: string, targetFolderId: string | null) => ({
          id,
          spaceId: 'space-bravo',
          folderId: targetFolderId,
          title: 'Bravo Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        delete: async () => {},
      },
      quickNotes: {
        get: async () => null,
        upsert: async (data: any) => ({
          id: 'quick-note-test',
          ...data,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        }),
        listMonth: async () => [],
        assets: {
          upload: async () => [],
        },
      },
      assets: {
        upload: async () => [],
      },
      shares: {
        get: async () => null,
        create: async () => null,
        regenerate: async () => null,
        disable: async () => null,
        getPublicUrl: async () => '',
      },
      tags: {
        listForDocument: async () => [],
        addToDocument: async () => ({ id: 'tag-new', label: '#tag', tone: 'neutral' }),
        removeFromDocument: async () => {},
      },
    } as unknown as WorkKnowlageDesktopApi;

    const state = await loadWorkspaceState({
      activeSpaceId: 'space-bravo',
      activeDocumentId: 'doc-root',
      expandedFolderIds: ['folder-bravo'],
    });

    expect(state.seed.documents.map((document) => document.id)).toEqual(['doc-root', 'doc-bravo']);
    expect(state.activeDocumentId).toBe('doc-root');
  });

  test('loads nested document descendants and preserves expanded document ids in fallback mode', async () => {
    const documentsList = vi.fn(async (...args: any[]) => {
      const [spaceId, folderId] = args.length === 2
        ? [args[0], args[1]]
        : [undefined, args[0]];

      if (spaceId !== 'space-bravo') {
        return [];
      }

      if (folderId === 'folder-bravo') {
        return [{
          id: 'doc-parent',
          spaceId: 'space-bravo',
          folderId,
          title: 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }];
      }

      if (folderId === 'doc-parent') {
        return [{
          id: 'doc-child',
          spaceId: 'space-bravo',
          folderId,
          title: 'Child Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '3 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }];
      }

      return [];
    });

    window.workKnowlage = {
      meta: { version: '0.1.0' },
      spaces: {
        list: async () => [{ id: 'space-bravo', name: 'Bravo', label: 'WORKSPACE' }],
        create: async () => ({ id: 'space-new', name: 'New', label: 'WORKSPACE' }),
        update: async () => {},
        delete: async () => {},
      },
      folders: {
        list: async (spaceId: string) => [
          { id: 'folder-bravo', spaceId, parentId: null, name: 'Bravo Folder' },
          { id: 'folder-child', spaceId, parentId: 'doc-parent', name: 'Child Folder' },
        ],
        create: async (data: any) => ({ id: 'folder-new', ...data }),
        rename: async () => {},
        move: async () => {},
        delete: async () => {},
      },
      documents: {
        list: documentsList,
        getById: async () => null,
        create: async (data: any) => ({
          id: 'doc-new',
          ...data,
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '0 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        update: async (_id: string, data: any) => data as any,
        move: async (id: string, targetFolderId: string | null) => ({
          id,
          spaceId: 'space-bravo',
          folderId: targetFolderId,
          title: targetFolderId === 'doc-parent' ? 'Child Doc' : 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        delete: async () => {},
      },
      quickNotes: {
        get: async () => null,
        upsert: async (data: any) => ({
          id: 'quick-note-test',
          ...data,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        }),
        listMonth: async () => [],
        assets: {
          upload: async () => [],
        },
      },
      assets: {
        upload: async () => [],
      },
      shares: {
        get: async () => null,
        create: async () => null,
        regenerate: async () => null,
        disable: async () => null,
        getPublicUrl: async () => '',
      },
      tags: {
        listForDocument: async () => [],
        addToDocument: async () => ({ id: 'tag-new', label: '#tag', tone: 'neutral' }),
        removeFromDocument: async () => {},
      },
    } as unknown as WorkKnowlageDesktopApi;

    const state = await loadWorkspaceState({
      activeSpaceId: 'space-bravo',
      activeDocumentId: 'doc-child',
      expandedFolderIds: ['folder-bravo', 'doc-parent'],
    });

    expect(state.seed.documents.map((document) => document.id)).toEqual(['doc-parent', 'doc-child']);
    expect(state.seed.folders.map((folder) => folder.id)).toEqual(['folder-bravo', 'folder-child']);
    expect(state.expandedFolderIds).toEqual(['folder-bravo', 'doc-parent']);
    expect(documentsList).toHaveBeenCalledWith('space-bravo', 'doc-parent');
  });

  test('prefers workspace snapshot loading when the api exposes it', async () => {
    const documentsList = vi.fn(async () => {
      throw new Error('documents.list should not be used when workspace snapshot is available');
    });
    const foldersList = vi.fn(async () => {
      throw new Error('folders.list should not be used when workspace snapshot is available');
    });

    window.workKnowlage = {
      meta: { version: '0.1.0' },
      workspace: {
        getSnapshot: async (spaceId: string) => ({
          folders: [{ id: 'folder-snapshot', spaceId, parentId: null, name: 'Snapshot Folder' }],
          documents: [{
            id: 'doc-snapshot',
            spaceId,
            folderId: null as unknown as string,
            title: 'Snapshot Doc',
            contentJson: '[]',
            updatedAtLabel: 'today',
            wordCountLabel: '4 字',
            badgeLabel: '',
            outline: [],
            tags: [],
            backlinks: [],
            sections: [],
            isFavorite: false,
          }],
        }),
      },
      spaces: {
        list: async () => [{ id: 'space-snapshot', name: 'Snapshot', label: 'WORKSPACE' }],
        create: async () => ({ id: 'space-new', name: 'New', label: 'WORKSPACE' }),
        update: async () => {},
        delete: async () => {},
      },
      folders: {
        list: foldersList,
        create: async (data: any) => ({ id: 'folder-new', ...data }),
        rename: async () => {},
        move: async () => {},
        delete: async () => {},
      },
      documents: {
        list: documentsList,
        getById: async () => null,
        create: async (data: any) => ({
          id: 'doc-new',
          ...data,
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '0 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        update: async (_id: string, data: any) => data as any,
        move: async (id: string, targetFolderId: string | null) => ({
          id,
          spaceId: 'space-snapshot',
          folderId: targetFolderId,
          title: 'Snapshot Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '4 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        }),
        delete: async () => {},
      },
      quickNotes: {
        get: async () => null,
        upsert: async (data: any) => ({
          id: 'quick-note-test',
          ...data,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        }),
        listMonth: async () => [],
        assets: {
          upload: async () => [],
        },
      },
      assets: {
        upload: async () => [],
      },
      shares: {
        get: async () => null,
        create: async () => null,
        regenerate: async () => null,
        disable: async () => null,
        getPublicUrl: async () => '',
      },
      tags: {
        listForDocument: async () => [],
        addToDocument: async () => ({ id: 'tag-new', label: '#tag', tone: 'neutral' }),
        removeFromDocument: async () => {},
      },
    } satisfies WorkKnowlageDesktopApi;

    const state = await loadWorkspaceState({
      activeSpaceId: 'space-snapshot',
      activeDocumentId: 'doc-snapshot',
      expandedFolderIds: [],
    });

    expect(state.seed.folders.map((folder) => folder.id)).toEqual(['folder-snapshot']);
    expect(state.seed.documents.map((document) => document.id)).toEqual(['doc-snapshot']);
    expect(documentsList).not.toHaveBeenCalled();
    expect(foldersList).not.toHaveBeenCalled();
  });
});
