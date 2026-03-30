import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Settings, Trash2, X, Plus } from 'lucide-react';
import type { Space } from '../../shared/types/workspace';

const compactTextStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

const requestDeleteConfirmation = (message: string) =>
  typeof window === 'undefined' || typeof window.confirm !== 'function'
    ? true
    : window.confirm(message);

const confirmDeleteSpace = (name: string) =>
  requestDeleteConfirmation(`确定删除空间「${name}」吗？`);

export interface SpaceSwitcherProps {
  spaces: Space[];
  activeSpaceId: string;
  onSwitchSpace: (spaceId: string) => Promise<void>;
  onCreateSpace: (name: string) => Promise<void>;
  onRenameSpace: (spaceId: string, newName: string) => Promise<void>;
  onDeleteSpace: (spaceId: string) => Promise<void>;
  onOpenTrash?: () => Promise<void> | void;
  onOpenSettings?: () => Promise<void> | void;
  onClose: () => void;
}

export function SpaceSwitcher({
  spaces,
  activeSpaceId,
  onSwitchSpace,
  onCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  onOpenTrash = async () => {},
  onOpenSettings = async () => {},
  onClose,
}: SpaceSwitcherProps) {
  const [creating, setCreating] = useState(false);
  const [renamingCurrentSpace, setRenamingCurrentSpace] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }

    await onCreateSpace(trimmed);
    setNewName('');
    setCreating(false);
    onCloseRef.current();
  };

  const handleRenameCurrentSpace = async (name: string) => {
    if (!activeSpace) {
      setRenamingCurrentSpace(false);
      return;
    }

    await onRenameSpace(activeSpace.id, name);
    setRenamingCurrentSpace(false);
    onCloseRef.current();
  };

  return (
    <div
      ref={panelRef}
      data-testid="space-switcher-panel"
      className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-[16px] border border-white/80 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur-xl ring-1 ring-slate-200/40"
    >
      <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">切换空间</p>
      <div className="max-h-[180px] space-y-0.5 overflow-y-auto custom-scrollbar">
        {spaces.map((space) => (
          <button
            key={space.id}
            type="button"
            aria-label={space.name}
            style={compactTextStyle}
            className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] font-medium transition-all ${
              space.id === activeSpaceId
                ? 'bg-blue-50/80 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
            onClick={async () => {
              if (space.id !== activeSpaceId) {
                await onSwitchSpace(space.id);
              }
              onClose();
            }}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold text-white shadow-sm ${
                space.id === activeSpaceId
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-br from-slate-400 to-slate-500'
              }`}
            >
              {space.name.charAt(0)}
            </div>
            <span className="truncate">{space.name}</span>
            {space.id === activeSpaceId ? <Check size={14} className="ml-auto shrink-0 text-blue-500" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-1.5 border-t border-slate-100 pt-1.5">
        {creating ? (
          <div className="flex items-center gap-1.5 px-1">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreate();
                }
                if (event.key === 'Escape') {
                  setCreating(false);
                  setNewName('');
                }
              }}
              placeholder="空间名称..."
              className="flex-1 min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 outline-none ring-2 ring-blue-100 placeholder:text-slate-300"
              style={compactTextStyle}
            />
            <button
              type="button"
              onClick={() => {
                void handleCreate();
              }}
              className="rounded-[8px] bg-blue-500 p-1.5 text-white shadow-sm transition-colors hover:bg-blue-600"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="rounded-[8px] bg-slate-100 p-1.5 text-slate-500 transition-colors hover:bg-slate-200"
            >
              <X size={13} />
            </button>
          </div>
        ) : renamingCurrentSpace && activeSpace ? (
          <div className="flex items-center gap-2 px-1 py-1">
            <Pencil size={13} className="shrink-0 text-slate-400" />
            <InlineEditInput
              defaultValue={activeSpace.name}
              onConfirm={(value) => {
                void handleRenameCurrentSpace(value);
              }}
              onCancel={() => setRenamingCurrentSpace(false)}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <button
              type="button"
              style={compactTextStyle}
              className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-blue-600"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              新建空间
            </button>
            <button
              type="button"
              aria-label="重命名当前空间"
              disabled={!activeSpace}
              style={compactTextStyle}
              className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
              onClick={() => setRenamingCurrentSpace(true)}
            >
              <Pencil size={14} />
              重命名当前空间
            </button>
            <button
              type="button"
              aria-label="删除当前空间"
              disabled={!activeSpace || spaces.length <= 1}
              style={compactTextStyle}
              className="group flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
              onClick={async () => {
                if (!activeSpace || !confirmDeleteSpace(activeSpace.name)) {
                  return;
                }

                await onDeleteSpace(activeSpace.id);
                onCloseRef.current();
              }}
            >
              <Trash2 size={14} className="transition-transform group-hover:scale-110" />
              删除当前空间
            </button>

            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-1.5">
              <button
                type="button"
                aria-label="回收站"
                style={compactTextStyle}
                className="group flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-red-500"
                onClick={async () => {
                  await onOpenTrash();
                  onCloseRef.current();
                }}
              >
                <Trash2 size={14} className="transition-transform group-hover:scale-110" />
                <span className="truncate">回收站</span>
              </button>
              <button
                type="button"
                aria-label="设置"
                aria-haspopup="dialog"
                style={compactTextStyle}
                className="group flex items-center justify-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-blue-600"
                onClick={async () => {
                  await onOpenSettings();
                  onCloseRef.current();
                }}
              >
                <Settings size={14} className="transition-transform group-hover:rotate-45" />
                <span>设置</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function InlineEditInput({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onConfirm(trimmed);
      return;
    }

    onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={handleConfirm}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          handleConfirm();
        }
        if (event.key === 'Escape') {
          onCancel();
        }
      }}
      className="flex-1 min-w-0 rounded-[6px] border border-blue-300/90 bg-white px-1.5 py-px font-normal text-slate-800 outline-none ring-1 ring-blue-100 transition-all"
      style={compactTextStyle}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
