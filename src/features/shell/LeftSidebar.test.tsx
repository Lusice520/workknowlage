import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, vi } from 'vitest';
import App from '../../app/App';
import type { WorkKnowlageDesktopApi } from '../../shared/types/preload';
import type { WorkspaceState } from '../../shared/types/workspace';
import { LeftSidebar } from './LeftSidebar';

const originalApi = window.workKnowlage;

afterEach(() => {
  window.workKnowlage = originalApi;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function parseDocumentListArgs(args: any[]) {
  if (args.length === 2) {
    return { spaceId: args[0], folderId: args[1] };
  }

  return { spaceId: undefined, folderId: args[0] };
}

function createDesktopApi(): WorkKnowlageDesktopApi {
  return {
    meta: { version: '0.1.0' },
    spaces: {
      list: async () => [
        { id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' },
        { id: 'space-bravo', name: 'Bravo Space', label: 'WORKSPACE' },
        { id: 'space-charlie', name: 'Charlie Space', label: 'WORKSPACE' },
      ],
      create: async (data) => ({ id: 'space-new', ...data }),
      update: async () => {},
      delete: async () => {},
    },
    folders: {
      list: async (spaceId) => {
        if (spaceId === 'space-alpha') {
          return [{ id: 'folder-alpha', spaceId, parentId: null, name: 'Alpha Folder' }];
        }
        if (spaceId === 'space-bravo') {
          return [{ id: 'folder-bravo', spaceId, parentId: null, name: 'Bravo Folder' }];
        }
        return [];
      },
      create: async (data) => ({ id: 'folder-new', ...data }),
      rename: async () => {},
      move: async () => {},
      delete: async () => {},
    },
    documents: {
      list: async (...args: any[]) => {
        const { folderId } = parseDocumentListArgs(args);

        if (folderId === 'folder-alpha') {
          return [{
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
          }];
        }
        if (folderId === 'folder-bravo') {
          return [{
            id: 'doc-bravo',
            spaceId: 'space-bravo',
            folderId,
            title: 'Bravo Doc',
            contentJson: '[]',
            updatedAtLabel: 'today',
            wordCountLabel: '12 字',
            badgeLabel: '',
            outline: [],
            tags: [],
            backlinks: [],
            sections: [],
          }];
        }
        return [];
      },
      getById: async () => null,
      create: async (data) => ({
        id: 'doc-new',
        ...data,
        folderId: data.folderId ?? null,
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
        folderId: targetFolderId ?? null,
        title: targetFolderId === 'folder-bravo' ? 'Bravo Doc' : 'Alpha Doc',
        contentJson: '[]',
        updatedAtLabel: 'today',
        wordCountLabel: targetFolderId === 'folder-bravo' ? '12 字' : '10 字',
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
        id: 'quick-note-new',
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
  };
}

function renderSidebarHarness({
  initialState,
  onMoveDocument = vi.fn(async () => {}),
  onMoveFolder = vi.fn(async () => {}),
  onCreateDocument = vi.fn(async () => {}),
  onCreateFolder = vi.fn(async () => {}),
}: {
  initialState: WorkspaceState;
  onMoveDocument?: ReturnType<typeof vi.fn>;
  onMoveFolder?: ReturnType<typeof vi.fn>;
  onCreateDocument?: ReturnType<typeof vi.fn>;
  onCreateFolder?: ReturnType<typeof vi.fn>;
}) {
  function Harness() {
    const [state, setState] = useState(initialState);
    const activeSpace = state.seed.spaces.find((space) => space.id === state.activeSpaceId) ?? null;

    return (
      <LeftSidebar
        activeSpace={activeSpace}
        state={state}
        editingId={null}
        quickNoteRefreshKey={0}
        selectedQuickNoteDate="2026-03-26"
        searchQuery=""
        searchResults={[]}
        searchLoading={false}
        onSelectDocument={() => {}}
        onSearchQueryChange={() => {}}
        onSelectSearchResult={() => {}}
        onSelectQuickNoteDate={() => {}}
        onToggleFolder={(folderId) => {
          setState((prev) => ({
            ...prev,
            expandedFolderIds: prev.expandedFolderIds.includes(folderId)
              ? prev.expandedFolderIds.filter((item) => item !== folderId)
              : [...prev.expandedFolderIds, folderId],
          }));
        }}
        onCreateDocument={async (folderId) => {
          await onCreateDocument(folderId);
          setState((prev) => {
            const nextDocumentId = `created-doc-${prev.seed.documents.length + 1}`;

            return {
              ...prev,
              activeDocumentId: nextDocumentId,
              seed: {
                ...prev.seed,
                documents: [
                  ...prev.seed.documents,
                  {
                    id: nextDocumentId,
                    spaceId: prev.activeSpaceId,
                    folderId,
                    title: '无标题文档',
                    contentJson: '[]',
                    updatedAtLabel: 'today',
                    wordCountLabel: '0 字',
                    badgeLabel: '',
                    outline: [],
                    tags: [],
                    backlinks: [],
                    sections: [],
                  },
                ],
              },
              expandedFolderIds: [...new Set([...prev.expandedFolderIds, ...(folderId ? [folderId] : [])])],
            };
          });
        }}
        onCreateFolder={async (parentId) => {
          await onCreateFolder(parentId);
          setState((prev) => {
            const nextFolderId = `created-folder-${prev.seed.folders.length + 1}`;

            return {
              ...prev,
              seed: {
                ...prev.seed,
                folders: [
                  ...prev.seed.folders,
                  {
                    id: nextFolderId,
                    spaceId: prev.activeSpaceId,
                    parentId,
                    name: '新文件夹',
                  },
                ],
              },
              expandedFolderIds: [...new Set([...prev.expandedFolderIds, ...(parentId ? [parentId] : []), nextFolderId])],
            };
          });
        }}
        onMoveFolder={async (folderId, targetParentId) => {
          await onMoveFolder(folderId, targetParentId);
          setState((prev) => ({
            ...prev,
            seed: {
              ...prev.seed,
              folders: prev.seed.folders.map((folder) =>
                folder.id === folderId ? { ...folder, parentId: targetParentId } : folder
              ),
            },
            expandedFolderIds: [...new Set([...prev.expandedFolderIds, ...(targetParentId ? [targetParentId] : [])])],
          }));
        }}
        onRenameFolder={async () => {}}
        onRenameDocument={async () => {}}
        onMoveDocument={async (documentId, targetFolderId) => {
          await onMoveDocument(documentId, targetFolderId);
          setState((prev) => {
            const nextExpandedFolderIds = targetFolderId
              ? [...prev.expandedFolderIds, targetFolderId]
              : prev.expandedFolderIds;

            return {
              ...prev,
              seed: {
                ...prev.seed,
                documents: prev.seed.documents.map((document) =>
                  document.id === documentId ? { ...document, folderId: targetFolderId } : document
                ),
              },
              expandedFolderIds: [...new Set(nextExpandedFolderIds)],
            };
          });
        }}
        onStartEditing={() => {}}
        onCancelEditing={() => {}}
        onDeleteDocument={async () => {}}
        onDeleteFolder={async () => {}}
        onCreateSpace={async () => {}}
        onRenameSpace={async () => {}}
        onDeleteSpace={async () => {}}
        onSwitchSpace={async () => {}}
      />
    );
  }

  return act(async () => {
    render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();
    return { onMoveDocument, onMoveFolder, onCreateDocument, onCreateFolder };
  });
}

function createDragDataTransfer() {
  const store = new Map<string, string>();

  return {
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
    }),
    getData: vi.fn((type: string) => store.get(type) ?? ''),
    effectAllowed: 'move',
    dropEffect: 'move',
  };
}

async function openSidebarMenu(sidebar: HTMLElement, label: string) {
  fireEvent.click(within(sidebar).getByRole('button', { name: label }));
}

function getActWarnings(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((args) => args.some((arg) => String(arg).includes('not wrapped in act')));
}

test('switches the active document when a tree item is clicked', async () => {
  render(<App />);

  // Wait for async loading to complete
  await waitFor(() => {
    expect(screen.queryByText('正在加载工作空间...')).not.toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.click(screen.getAllByText('架构设计')[0]!);
  });

  expect(await screen.findByRole('heading', { name: '架构设计' })).toBeInTheDocument();
});

test('reloads the selected space instead of only filtering the in-memory seed', async () => {
  window.workKnowlage = createDesktopApi();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  fireEvent.click(within(screen.getByTestId('left-sidebar')).getByText('Alpha Space'));
  fireEvent.click(screen.getByText('Bravo Space'));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Bravo Doc' })).toBeInTheDocument();
  });
});

test('keeps top-level create document available when the active space has no folders and creates a root-level document', async () => {
  const api = createDesktopApi();
  const documentsBySpace: Record<string, any[]> = {
    'space-alpha': [{
      id: 'doc-alpha',
      spaceId: 'space-alpha',
      folderId: 'folder-alpha',
      title: 'Alpha Doc',
      contentJson: '[]',
      updatedAtLabel: 'today',
      wordCountLabel: '10 字',
      badgeLabel: '',
      outline: [],
      tags: [],
      backlinks: [],
      sections: [],
    }],
    'space-bravo': [{
      id: 'doc-bravo',
      spaceId: 'space-bravo',
      folderId: 'folder-bravo',
      title: 'Bravo Doc',
      contentJson: '[]',
      updatedAtLabel: 'today',
      wordCountLabel: '12 字',
      badgeLabel: '',
      outline: [],
      tags: [],
      backlinks: [],
      sections: [],
    }],
    'space-charlie': [],
  };

  api.documents.list = async (...args: any[]) => {
    const { spaceId, folderId } = parseDocumentListArgs(args);
    const targetSpaceId = spaceId
      ?? (folderId === 'folder-alpha'
        ? 'space-alpha'
        : folderId === 'folder-bravo'
          ? 'space-bravo'
          : 'space-charlie');
    return documentsBySpace[targetSpaceId].filter((document) => document.folderId === folderId);
  };
  api.documents.create = async (data: any) => {
    const createdDocument = {
      id: `doc-${documentsBySpace[data.spaceId].length + 1}`,
      spaceId: data.spaceId,
      folderId: data.folderId ?? null,
      title: data.title,
      contentJson: '[]',
      updatedAtLabel: 'today',
      wordCountLabel: '0 字',
      badgeLabel: '',
      outline: [],
      tags: [],
      backlinks: [],
      sections: [],
    };
    documentsBySpace[data.spaceId].push(createdDocument);
    return createdDocument;
  };
  window.workKnowlage = api;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  fireEvent.click(within(screen.getByTestId('left-sidebar')).getByText('Alpha Space'));
  fireEvent.click(screen.getByText('Charlie Space'));

  await waitFor(() => {
    expect(screen.getByTestId('center-pane')).toHaveTextContent('请选择一篇文档开始工作');
  });

  const sidebar = screen.getByTestId('left-sidebar');
  await openSidebarMenu(sidebar, '根目录新建操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '新建文件' }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '无标题文档' })).toBeInTheDocument();
  });
});

test('keeps quick links and new-space controls visually compact', async () => {
  window.workKnowlage = createDesktopApi();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  const allNotesButton = within(sidebar).getByRole('button', { name: '所有笔记' });
  const favoritesButton = within(sidebar).getByRole('button', { name: '收藏夹' });
  const activeSpaceTitle = within(sidebar).getByText('Alpha Space');
  const folderLabel = within(sidebar).getByText('Alpha Folder');
  const documentLabel = within(sidebar).getByText('Alpha Doc');

  expect(allNotesButton.className).toContain('text-[12px]');
  expect(favoritesButton.className).toContain('text-[12px]');
  expect(within(allNotesButton).getByText('所有笔记').className).toContain('text-[12px]');
  expect(within(allNotesButton).getByText('所有笔记').className).toContain('font-medium');
  expect(within(favoritesButton).getByText('收藏夹').className).toContain('text-[12px]');
  expect(activeSpaceTitle.className).toContain('text-[12px]');
  expect(folderLabel.className).toContain('text-[12px]');
  expect(documentLabel.className).toContain('text-[12px]');
  expect(within(sidebar).queryByRole('button', { name: '回收站' })).not.toBeInTheDocument();
  expect(within(sidebar).queryByRole('button', { name: '设置' })).not.toBeInTheDocument();

  fireEvent.click(activeSpaceTitle);

  const createSpaceButton = await screen.findByRole('button', { name: '新建空间' });
  const recycleBinButton = await screen.findByRole('button', { name: '回收站' });
  const settingsButton = await screen.findByRole('button', { name: '设置' });
  expect(createSpaceButton.className).toContain('text-[12px]');
  expect(recycleBinButton.className).toContain('text-[12px]');
  expect(settingsButton.className).toContain('text-[12px]');
  expect(activeSpaceTitle).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(createSpaceButton).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(screen.getByRole('button', { name: 'Bravo Space' })).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(recycleBinButton).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(settingsButton).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });

  fireEvent.click(createSpaceButton);

  const newSpaceInput = await screen.findByPlaceholderText('空间名称...');
  expect(newSpaceInput.className).toContain('text-[12px]');
});

test('reveals recycle bin and settings inside the space switcher instead of the sidebar footer', async () => {
  window.workKnowlage = createDesktopApi();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  expect(within(sidebar).queryByRole('button', { name: '回收站' })).not.toBeInTheDocument();
  expect(within(sidebar).queryByRole('button', { name: '设置' })).not.toBeInTheDocument();

  fireEvent.click(within(sidebar).getByText('Alpha Space'));

  expect(await screen.findByRole('button', { name: '回收站' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: '设置' })).toBeInTheDocument();
});

test('opens the trash view from the recycle bin entry and launches settings in a modal', async () => {
  window.workKnowlage = createDesktopApi();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '回收站' }));
  });

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '回收站' })).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
  });

  expect(screen.queryByTestId('sidebar-settings-panel')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
});

test('keeps inline rename inputs compact inside the sidebar tree', async () => {
  window.workKnowlage = createDesktopApi();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  fireEvent.doubleClick(within(sidebar).getByText('Alpha Doc'));

  const renameInput = await within(sidebar).findByDisplayValue('Alpha Doc');
  expect(renameInput).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(renameInput.className).toContain('ring-1');
});

test('exposes explicit rename actions for folders and documents', async () => {
  const api = createDesktopApi();
  const renameFolderSpy = vi.fn().mockResolvedValue(undefined);
  const renameDocumentSpy = vi.fn().mockResolvedValue(undefined);

  api.folders.rename = renameFolderSpy;
  api.documents.update = renameDocumentSpy as any;
  window.workKnowlage = api;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');

  await openSidebarMenu(sidebar, 'Alpha Folder 更多操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '重命名' }));

  const folderRenameInput = await within(sidebar).findByDisplayValue('Alpha Folder');
  expect(folderRenameInput).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  fireEvent.change(folderRenameInput, { target: { value: 'Alpha Folder Renamed' } });
  fireEvent.keyDown(folderRenameInput, { key: 'Enter' });

  await waitFor(() => {
    expect(renameFolderSpy).toHaveBeenCalledWith('folder-alpha', 'Alpha Folder Renamed');
  });

  await openSidebarMenu(sidebar, 'Alpha Doc 更多操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '重命名' }));

  const documentRenameInput = await within(sidebar).findByDisplayValue('Alpha Doc');
  fireEvent.change(documentRenameInput, { target: { value: 'Alpha Doc Renamed' } });
  fireEvent.keyDown(documentRenameInput, { key: 'Enter' });

  await waitFor(() => {
    expect(renameDocumentSpy).toHaveBeenCalledWith('doc-alpha', { title: 'Alpha Doc Renamed' });
  });
});

test('keeps sidebar tree actions visually hidden until hover or focus-within', async () => {
  window.workKnowlage = createDesktopApi();

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  const folderActions = within(sidebar).getByTestId('folder-actions-folder-alpha');
  const documentActions = within(sidebar).getByTestId('document-actions-doc-alpha');

  expect(folderActions.className).toContain('opacity-0');
  expect(folderActions.className).toContain('group-hover:opacity-100');
  expect(folderActions.className).toContain('group-focus-within:opacity-100');
  expect(documentActions.className).toContain('opacity-0');
  expect(documentActions.className).toContain('group-hover:opacity-100');
  expect(documentActions.className).toContain('group-focus-within:opacity-100');
});

test('exposes delete actions for folders and documents behind confirmation', async () => {
  const api = createDesktopApi();
  const deleteFolderSpy = vi.fn().mockResolvedValue(undefined);
  const deleteDocumentSpy = vi.fn().mockResolvedValue(undefined);
  const confirmSpy = vi.fn(() => true);

  api.folders.delete = deleteFolderSpy;
  api.documents.delete = deleteDocumentSpy;
  window.workKnowlage = api;
  vi.stubGlobal('confirm', confirmSpy);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  await openSidebarMenu(sidebar, 'Alpha Doc 更多操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }));

  await waitFor(() => {
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteDocumentSpy).toHaveBeenCalledWith('doc-alpha');
  });

  await openSidebarMenu(sidebar, 'Alpha Folder 更多操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }));

  await waitFor(() => {
    expect(deleteFolderSpy).toHaveBeenCalledWith('folder-alpha');
  });
});

test('supports creating child documents from a document row create menu', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-alpha',
    expandedFolderIds: ['folder-alpha'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
      ],
      documents: [
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const createDocument = vi.fn(async () => {});

  await renderSidebarHarness({
    initialState,
    onCreateDocument: createDocument,
  });

  const sidebar = screen.getByTestId('left-sidebar');

  await openSidebarMenu(sidebar, 'Alpha Doc 新建操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '新建文件' }));

  await waitFor(() => {
    expect(createDocument).toHaveBeenCalledWith('doc-alpha');
    expect(within(sidebar).getByText('无标题文档')).toBeInTheDocument();
  });
});

test('supports creating child folders from a document row create menu', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-alpha',
    expandedFolderIds: ['folder-alpha'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
      ],
      documents: [
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const createFolder = vi.fn(async () => {});

  await renderSidebarHarness({
    initialState,
    onCreateFolder: createFolder,
  });

  const sidebar = screen.getByTestId('left-sidebar');

  await openSidebarMenu(sidebar, 'Alpha Doc 新建操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '新建文件夹' }));

  await waitFor(() => {
    expect(createFolder).toHaveBeenCalledWith('doc-alpha');
    expect(within(sidebar).getByText('新文件夹')).toBeInTheDocument();
  });
});

test('does not emit act warnings when creating child documents from a document row menu', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-alpha',
    expandedFolderIds: ['folder-alpha'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
      ],
      documents: [
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  await renderSidebarHarness({ initialState });

  const sidebar = screen.getByTestId('left-sidebar');
  await openSidebarMenu(sidebar, 'Alpha Doc 新建操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '新建文件' }));

  await waitFor(() => {
    expect(within(sidebar).getByText('无标题文档')).toBeInTheDocument();
  });

  expect(getActWarnings(consoleErrorSpy)).toHaveLength(0);
});

test('renders child folders and documents nested beneath a document node', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-alpha',
    expandedFolderIds: ['folder-alpha', 'doc-alpha', 'folder-child'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-child', spaceId: 'space-alpha', parentId: 'doc-alpha', name: 'Child Folder' },
      ],
      documents: [
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
        {
          id: 'doc-child',
          spaceId: 'space-alpha',
          folderId: 'doc-alpha',
          title: 'Child Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '3 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  await renderSidebarHarness({ initialState });

  const sidebar = screen.getByTestId('left-sidebar');

  expect(within(sidebar).getByText('Alpha Doc')).toBeInTheDocument();
  expect(within(sidebar).getByText('Child Folder')).toBeInTheDocument();
  expect(within(sidebar).getByText('Child Doc')).toBeInTheDocument();
});

test('opens the selected daily quick note inside the center pane', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-26T08:00:00+08:00'));

  const api = createDesktopApi();
  const notesByDate = {
    '2026-03-25': {
      id: 'quick-note-0325',
      spaceId: 'space-alpha',
      noteDate: '2026-03-25',
      title: '3月25日快记',
      contentJson: JSON.stringify([
        {
          id: 'quick-note-0325-paragraph',
          type: 'paragraph',
          content: [{ type: 'text', text: '昨天补一个待办', styles: {} }],
          children: [],
        },
      ]),
      createdAt: '2026-03-25T10:00:00.000Z',
      updatedAt: '2026-03-25T10:00:00.000Z',
    },
    '2026-03-26': {
      id: 'quick-note-0326',
      spaceId: 'space-alpha',
      noteDate: '2026-03-26',
      title: '3月26日快记',
      contentJson: JSON.stringify([
        {
          id: 'quick-note-0326-paragraph',
          type: 'paragraph',
          content: [{ type: 'text', text: '今天先记一个想法', styles: {} }],
          children: [],
        },
      ]),
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    },
  } as const;

  api.quickNotes.get = async (noteDateOrSpaceId, maybeNoteDate?: string) => {
    const noteDate = maybeNoteDate ?? noteDateOrSpaceId;
    return notesByDate[noteDate as keyof typeof notesByDate] ?? null;
  };
  api.quickNotes.listMonth = async (monthKeyOrSpaceId, maybeMonthKey?: string) => {
    const monthKey = maybeMonthKey ?? monthKeyOrSpaceId;
    return Object.values(notesByDate)
      .filter((note) => note.noteDate.startsWith(`${monthKey}-`))
      .map((note) => ({ noteDate: note.noteDate, updatedAt: note.updatedAt }));
  };
  window.workKnowlage = api;

  render(<App />);

  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });

  expect(within(screen.getByTestId('center-pane')).getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();

  expect(screen.getByRole('button', { name: '选择 2026-03-25' })).toHaveAttribute('data-has-note', 'true');

  vi.useRealTimers();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '选择 2026-03-25' }));
  });

  expect(screen.getByRole('button', { name: '选择 2026-03-25' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '选择 2026-03-26' })).toHaveAttribute('aria-pressed', 'false');
  expect(within(screen.getByTestId('left-sidebar')).queryByText('昨天补一个待办')).not.toBeInTheDocument();

  await act(async () => {
    fireEvent.click(within(screen.getByTestId('left-sidebar')).getByText('Alpha Doc'));
    await Promise.resolve();
  });

  expect(within(screen.getByTestId('center-pane')).getByRole('heading', { name: 'Alpha Doc' })).toBeInTheDocument();
});

test('switches the quick note calendar month and jumps back to today', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-26T08:00:00+08:00'));

  window.workKnowlage = createDesktopApi();

  render(<App />);

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  const quickNotePanel = screen.getByTestId('sidebar-quick-note-panel');

  expect(within(quickNotePanel).getByText('2026年3月')).toBeInTheDocument();
  expect(within(quickNotePanel).getByText(/^周$/)).toBeInTheDocument();
  expect(within(quickNotePanel).getByText(/^六$/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '下一个月' }));

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(within(quickNotePanel).getByText('2026年4月')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '回到今天' }));

  await act(async () => {
    await vi.runAllTimersAsync();
    await Promise.resolve();
  });

  expect(within(quickNotePanel).getByText('2026年3月')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '选择 2026-03-26' })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps the quick note calendar typography compact', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-26T08:00:00+08:00'));

  window.workKnowlage = createDesktopApi();

  render(<App />);

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  const quickNotePanel = screen.getByTestId('sidebar-quick-note-panel');
  const monthLabel = within(quickNotePanel).getByText('2026年3月');
  const weekLabel = within(quickNotePanel).getByText(/^周$/);
  const dayLabel = within(quickNotePanel).getByText(/^一$/);
  const dayButton = within(quickNotePanel).getByRole('button', { name: '选择 2026-03-26' });

  expect(monthLabel).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(weekLabel).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(dayLabel).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(dayButton).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
});

test('keeps the quick note calendar layout visually tight', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-26T08:00:00+08:00'));

  window.workKnowlage = createDesktopApi();

  render(<App />);

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  const quickNotePanel = screen.getByTestId('sidebar-quick-note-panel');
  const headerRow = within(quickNotePanel).getByText('2026年3月').parentElement;
  const calendarGrid = within(quickNotePanel).getByText(/^周$/).parentElement;
  const dayButton = within(quickNotePanel).getByRole('button', { name: '选择 2026-03-26' });
  const todayButton = within(quickNotePanel).getByRole('button', { name: '回到今天' });

  expect(quickNotePanel.className).toContain('p-3');
  expect(quickNotePanel.className).toContain('mt-4');
  expect(headerRow?.className).toContain('mb-3');
  expect(calendarGrid?.className).toContain('gap-y-1.5');
  expect(dayButton.className).toContain('h-7');
  expect(todayButton.className).toContain('h-6');
  expect(todayButton.className).toContain('w-6');
});

test('searches documents from the sidebar and opens the selected document', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText('搜索文档和快记...');
  fireEvent.change(searchInput, { target: { value: '架构' } });

  const resultButton = await screen.findByRole('button', { name: '打开文档 架构设计' });
  fireEvent.click(resultButton);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '架构设计' })).toBeInTheDocument();
  });
});

test('searches quick notes from the sidebar and opens the selected quick note', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-26T08:00:00+08:00'));

  const api = createDesktopApi() as WorkKnowlageDesktopApi & {
    search?: {
      query: (spaceId: string, query: string) => Promise<Array<Record<string, string>>>;
    };
  };

  api.quickNotes.get = async (noteDateOrSpaceId, maybeNoteDate?: string) =>
    (maybeNoteDate ?? noteDateOrSpaceId) === '2026-03-25'
      ? {
          id: 'quick-note-0325',
          spaceId: 'space-alpha',
          noteDate: '2026-03-25',
          title: '3月25日快记',
          contentJson: JSON.stringify([
            {
              id: 'quick-note-0325-paragraph',
              type: 'paragraph',
              content: [{ type: 'text', text: '昨天补一个待办', styles: {} }],
              children: [],
            },
          ]),
          createdAt: '2026-03-25T10:00:00.000Z',
          updatedAt: '2026-03-25T10:00:00.000Z',
        }
      : null;
  api.quickNotes.listMonth = async () => [
    { noteDate: '2026-03-25', updatedAt: '2026-03-25T10:00:00.000Z' },
  ];
  api.search = {
    query: async () => [
      {
        id: 'quick-note-space-alpha-2026-03-25',
        kind: 'quick-note',
        title: '3月25日快记',
        preview: '昨天补一个待办',
        spaceId: 'space-alpha',
        noteDate: '2026-03-25',
      },
    ],
  };
  window.workKnowlage = api;

  render(<App />);

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  const searchInput = screen.getByPlaceholderText('搜索文档和快记...');
  fireEvent.change(searchInput, { target: { value: '待办' } });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  vi.useRealTimers();

  const resultButton = screen.getByRole('button', { name: '打开快记 3月25日快记' });
  await act(async () => {
    fireEvent.click(resultButton);
  });

  expect(screen.queryByTestId('workspace-search-panel')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '选择 2026-03-25' })).toHaveAttribute('aria-pressed', 'true');
});

test('drags a document into another folder and reloads the tree', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-alpha',
    expandedFolderIds: ['folder-alpha'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-bravo', spaceId: 'space-alpha', parentId: null, name: 'Bravo Folder' },
      ],
      documents: [
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveDocument = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveDocument: moveDocument });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedDocumentRow = within(sidebar).getAllByText('Alpha Doc')[0]?.closest('[role="button"]');
  const targetFolderRow = within(sidebar).getAllByText('Bravo Folder')[0]?.closest('[role="button"]');
  const sourceSection = within(sidebar).getAllByText('Alpha Folder')[0]?.closest('section');
  const targetSection = within(sidebar).getAllByText('Bravo Folder')[0]?.closest('section');
  const dataTransfer = createDragDataTransfer();

  expect(draggedDocumentRow).not.toBeNull();
  expect(targetFolderRow).not.toBeNull();
  expect(sourceSection).not.toBeNull();
  expect(targetSection).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedDocumentRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetFolderRow!, { dataTransfer });
  fireEvent.drop(targetFolderRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveDocument).toHaveBeenCalledWith('doc-alpha', 'folder-bravo');
    expect(within(sourceSection!).queryByText('Alpha Doc')).not.toBeInTheDocument();
    expect(within(targetSection!).getByText('Alpha Doc')).toBeInTheDocument();
  });
});

test('drags a document into another document and nests it as a child', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-parent',
    expandedFolderIds: ['folder-alpha', 'folder-bravo', 'doc-parent'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-bravo', spaceId: 'space-alpha', parentId: null, name: 'Bravo Folder' },
      ],
      documents: [
        {
          id: 'doc-parent',
          spaceId: 'space-alpha',
          folderId: 'folder-bravo',
          title: 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '8 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveDocument = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveDocument: moveDocument });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedDocumentRow = within(sidebar).getAllByText('Alpha Doc')[0]?.closest('[role="button"]');
  const targetDocumentRow = within(sidebar).getAllByText('Parent Doc')[0]?.closest('[role="button"]');
  const targetDocumentSection = within(sidebar).getAllByText('Parent Doc')[0]?.closest('section');
  const sourceSection = within(sidebar).getAllByText('Alpha Folder')[0]?.closest('section');
  const dataTransfer = createDragDataTransfer();

  expect(draggedDocumentRow).not.toBeNull();
  expect(targetDocumentRow).not.toBeNull();
  expect(targetDocumentSection).not.toBeNull();
  expect(sourceSection).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedDocumentRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetDocumentRow!, { dataTransfer });
  fireEvent.drop(targetDocumentRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveDocument).toHaveBeenCalledWith('doc-alpha', 'doc-parent');
    expect(within(sourceSection!).queryByText('Alpha Doc')).not.toBeInTheDocument();
    expect(within(targetDocumentSection!).getByText('Alpha Doc')).toBeInTheDocument();
  });
});

test('renders root-level documents in the sidebar root zone and moves documents back to root', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-root',
    expandedFolderIds: ['folder-alpha'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-bravo', spaceId: 'space-alpha', parentId: null, name: 'Bravo Folder' },
      ],
      documents: [
        {
          id: 'doc-root',
          spaceId: 'space-alpha',
          folderId: null as unknown as string,
          title: 'Root Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '4 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveDocument = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveDocument: moveDocument });

  const sidebar = screen.getByTestId('left-sidebar');
  const rootDropZone = within(sidebar).getByTestId('sidebar-root-drop-zone');
  const draggedDocumentRow = within(sidebar).getAllByText('Alpha Doc')[0]?.closest('[role="button"]');
  const dataTransfer = createDragDataTransfer();

  expect(within(rootDropZone).getByText('Root Doc')).toBeInTheDocument();
  expect(draggedDocumentRow).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedDocumentRow!, { dataTransfer });
  });
  fireEvent.dragOver(rootDropZone, { dataTransfer });
  fireEvent.drop(rootDropZone, { dataTransfer });

  await waitFor(() => {
    expect(moveDocument).toHaveBeenCalledWith('doc-alpha', null);
    expect(within(rootDropZone).getByText('Alpha Doc')).toBeInTheDocument();
  });
});

test('drags a folder into another folder and reloads the tree', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: '',
    expandedFolderIds: ['folder-alpha'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-bravo', spaceId: 'space-alpha', parentId: null, name: 'Bravo Folder' },
      ],
      documents: [],
    },
  };

  const moveFolder = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveFolder: moveFolder });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedFolderRow = within(sidebar).getAllByText('Bravo Folder')[0]?.closest('[role="button"]');
  const targetFolderRow = within(sidebar).getAllByText('Alpha Folder')[0]?.closest('[role="button"]');
  const alphaSection = within(sidebar).getAllByText('Alpha Folder')[0]?.closest('section');
  const dataTransfer = createDragDataTransfer();

  expect(draggedFolderRow).not.toBeNull();
  expect(targetFolderRow).not.toBeNull();
  expect(alphaSection).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedFolderRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetFolderRow!, { dataTransfer });
  fireEvent.drop(targetFolderRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveFolder).toHaveBeenCalledWith('folder-bravo', 'folder-alpha');
    expect(within(alphaSection!).getByText('Bravo Folder')).toBeInTheDocument();
  });
});

test('drags a folder into a document and nests it as a child', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-parent',
    expandedFolderIds: ['folder-alpha', 'folder-bravo', 'doc-parent'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-bravo', spaceId: 'space-alpha', parentId: null, name: 'Bravo Folder' },
      ],
      documents: [
        {
          id: 'doc-parent',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '8 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveFolder = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveFolder: moveFolder });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedFolderRow = within(sidebar).getAllByText('Bravo Folder')[0]?.closest('[role="button"]');
  const targetDocumentRow = within(sidebar).getAllByText('Parent Doc')[0]?.closest('[role="button"]');
  const targetDocumentSection = within(sidebar).getAllByText('Parent Doc')[0]?.closest('section');
  const dataTransfer = createDragDataTransfer();

  expect(draggedFolderRow).not.toBeNull();
  expect(targetDocumentRow).not.toBeNull();
  expect(targetDocumentSection).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedFolderRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetDocumentRow!, { dataTransfer });
  fireEvent.drop(targetDocumentRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveFolder).toHaveBeenCalledWith('folder-bravo', 'doc-parent');
    expect(within(targetDocumentSection!).getByText('Bravo Folder')).toBeInTheDocument();
  });
});

test('prevents dragging a parent document into its child document', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-parent',
    expandedFolderIds: ['folder-alpha', 'doc-parent'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
      ],
      documents: [
        {
          id: 'doc-parent',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '8 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
        {
          id: 'doc-child',
          spaceId: 'space-alpha',
          folderId: 'doc-parent',
          title: 'Child Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '3 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveDocument = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveDocument: moveDocument });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedDocumentRow = within(sidebar).getAllByText('Parent Doc')[0]?.closest('[role="button"]');
  const targetDocumentRow = within(sidebar).getAllByText('Child Doc')[0]?.closest('[role="button"]');
  const dataTransfer = createDragDataTransfer();

  expect(draggedDocumentRow).not.toBeNull();
  expect(targetDocumentRow).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedDocumentRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetDocumentRow!, { dataTransfer });
  fireEvent.drop(targetDocumentRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveDocument).not.toHaveBeenCalled();
    expect(within(sidebar).getAllByText('Parent Doc')).toHaveLength(1);
    expect(within(sidebar).getAllByText('Child Doc')).toHaveLength(1);
  });
});

test('drags a document into another document and reloads the tree', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-parent',
    expandedFolderIds: ['folder-alpha', 'doc-parent'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
      ],
      documents: [
        {
          id: 'doc-parent',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
        {
          id: 'doc-alpha',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Alpha Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '4 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveDocument = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveDocument: moveDocument });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedDocumentRow = within(sidebar).getAllByText('Alpha Doc')[0]?.closest('[role="button"]');
  const targetDocumentRow = within(sidebar).getAllByText('Parent Doc')[0]?.closest('[role="button"]');
  const parentSection = within(sidebar).getAllByText('Parent Doc')[0]?.closest('section');
  const dataTransfer = createDragDataTransfer();

  expect(draggedDocumentRow).not.toBeNull();
  expect(targetDocumentRow).not.toBeNull();
  expect(parentSection).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedDocumentRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetDocumentRow!, { dataTransfer });
  fireEvent.drop(targetDocumentRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveDocument).toHaveBeenCalledWith('doc-alpha', 'doc-parent');
    expect(within(parentSection!).getAllByText('Alpha Doc')).toHaveLength(1);
  });
});

test('drags a folder into a document and reloads the tree', async () => {
  const initialState: WorkspaceState = {
    activeSpaceId: 'space-alpha',
    activeDocumentId: 'doc-parent',
    expandedFolderIds: ['folder-alpha', 'doc-parent'],
    seed: {
      spaces: [{ id: 'space-alpha', name: 'Alpha Space', label: 'WORKSPACE' }],
      quickLinks: [{ id: 'all-notes', label: '所有笔记' }],
      folders: [
        { id: 'folder-alpha', spaceId: 'space-alpha', parentId: null, name: 'Alpha Folder' },
        { id: 'folder-bravo', spaceId: 'space-alpha', parentId: null, name: 'Bravo Folder' },
      ],
      documents: [
        {
          id: 'doc-parent',
          spaceId: 'space-alpha',
          folderId: 'folder-alpha',
          title: 'Parent Doc',
          contentJson: '[]',
          updatedAtLabel: 'today',
          wordCountLabel: '10 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
        },
      ],
    },
  };

  const moveFolder = vi.fn(async () => {});
  await renderSidebarHarness({ initialState, onMoveFolder: moveFolder });

  const sidebar = screen.getByTestId('left-sidebar');
  const draggedFolderRow = within(sidebar).getAllByText('Bravo Folder')[0]?.closest('[role="button"]');
  const targetDocumentRow = within(sidebar).getAllByText('Parent Doc')[0]?.closest('[role="button"]');
  const parentSection = within(sidebar).getAllByText('Parent Doc')[0]?.closest('section');
  const dataTransfer = createDragDataTransfer();

  expect(draggedFolderRow).not.toBeNull();
  expect(targetDocumentRow).not.toBeNull();
  expect(parentSection).not.toBeNull();

  await act(async () => {
    fireEvent.dragStart(draggedFolderRow!, { dataTransfer });
  });
  fireEvent.dragOver(targetDocumentRow!, { dataTransfer });
  fireEvent.drop(targetDocumentRow!, { dataTransfer });

  await waitFor(() => {
    expect(moveFolder).toHaveBeenCalledWith('folder-bravo', 'doc-parent');
    expect(within(parentSection!).getByText('Bravo Folder')).toBeInTheDocument();
  });
});
