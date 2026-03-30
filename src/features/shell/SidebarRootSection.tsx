import type { DragEvent } from 'react';
import { FilePlus2, FolderPlus, Plus } from 'lucide-react';
import type { DocumentRecord, FolderNode } from '../../shared/types/workspace';
import { SidebarActionMenu } from './SidebarActionMenu';
import { SidebarTree, type SidebarTreeProps } from './SidebarTree';

export interface SidebarRootSectionProps extends Omit<
  SidebarTreeProps,
  'rootDocuments' | 'rootFolders'
> {
  rootDocuments: DocumentRecord[];
  rootFolders: FolderNode[];
  rootDropActive: boolean;
  onRootDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onRootDrop: (event: DragEvent<HTMLDivElement>) => void;
}

export function SidebarRootSection({
  rootDocuments,
  rootFolders,
  rootDropActive,
  onRootDragOver,
  onRootDrop,
  ...treeProps
}: SidebarRootSectionProps) {
  return (
    <div
      data-testid="sidebar-root-drop-zone"
      className={`mb-2 rounded-[10px] transition-colors ${
        rootDropActive ? 'bg-blue-50/70 ring-1 ring-blue-200' : ''
      }`}
      onDragOver={onRootDragOver}
      onDrop={onRootDrop}
    >
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">根目录</p>
        <SidebarActionMenu
          triggerLabel="根目录新建操作"
          triggerTitle="新建"
          triggerIcon={<Plus size={14} />}
          items={[
            {
              label: '新建文件',
              icon: FilePlus2,
              onClick: () => {
                void treeProps.onCreateDocument(null);
              },
            },
            {
              label: '新建文件夹',
              icon: FolderPlus,
              onClick: () => {
                void treeProps.onCreateFolder(null);
              },
            },
          ]}
        />
      </div>
      <SidebarTree
        {...treeProps}
        rootDocuments={rootDocuments}
        rootFolders={rootFolders}
      />
    </div>
  );
}
