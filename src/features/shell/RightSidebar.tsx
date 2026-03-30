import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CornerDownLeft, Hash, Library, Link2, ListTree, Plus, X } from 'lucide-react';
import { deriveOutlineFromContentJson } from '../../shared/lib/documentContent';
import { extractOutgoingMentions } from '../../shared/lib/outgoingMentions';
import type {
  BacklinkRecord,
  DocumentNavigationTarget,
  DocumentRecord,
  FolderNode,
  OutgoingMentionRecord,
  QuickNoteRecord,
  Space,
} from '../../shared/types/workspace';

interface RightSidebarProps {
  activeDocument: DocumentRecord | null;
  activeQuickNote?: QuickNoteRecord | null;
  activeFolder: FolderNode | null;
  activeSpace: Space | null;
  onAddTagToDocument: (documentId: string, label: string) => Promise<void>;
  onRemoveTagFromDocument: (documentId: string, tagId: string) => Promise<void>;
  onOpenBacklinkDocument?: (target: DocumentNavigationTarget) => void;
}

const compactInputStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

const referenceSectionLabelStyle = 'text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400';
const referenceEmptyStateClassName =
  'py-3 text-[12px] text-slate-400 text-center rounded-[12px] border border-dashed border-slate-300/60 bg-slate-50/50';

const normalizeTagLabel = (label: string) => {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    return '';
  }

  return trimmedLabel.startsWith('#') ? trimmedLabel : `#${trimmedLabel}`;
};

const renderReferenceCard = ({
  id,
  title,
  description,
  ariaLabel,
  disabled,
  onClick,
}: {
  id: string;
  title: string;
  description: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    key={id}
    aria-label={ariaLabel}
    className="group w-full cursor-pointer rounded-[14px] border border-white/80 bg-white/60 px-3 py-2.5 text-left shadow-sm transition-all duration-300 hover:bg-white hover:-translate-y-0.5 hover:border-slate-200/60 hover:shadow-md disabled:cursor-default disabled:opacity-75"
    disabled={disabled}
    onClick={onClick}
  >
    <p className="text-[13px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{title}</p>
    <p className="mt-1 text-[12px] leading-[1.4] text-slate-500 line-clamp-2">{description}</p>
  </button>
);

const renderReferenceSection = ({
  title,
  icon,
  emptyState,
  children,
}: {
  title: string;
  icon: ReactNode;
  emptyState: string;
  children: ReactNode;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <p className={referenceSectionLabelStyle}>{title}</p>
      <div className="text-slate-400">{icon}</div>
    </div>
    {children ?? <div className={referenceEmptyStateClassName}>{emptyState}</div>}
  </div>
);

export function RightSidebar({
  activeDocument,
  activeQuickNote = null,
  activeFolder: _activeFolder,
  activeSpace: _activeSpace,
  onAddTagToDocument,
  onRemoveTagFromDocument,
  onOpenBacklinkDocument,
}: RightSidebarProps) {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [nextTagLabel, setNextTagLabel] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAddingTag) {
      return;
    }

    tagInputRef.current?.focus();
  }, [isAddingTag]);

  useEffect(() => {
    setIsAddingTag(false);
    setNextTagLabel('');
  }, [activeDocument?.id, activeQuickNote?.id]);

  const activeOutline = useMemo(() => {
    return activeDocument?.outline
      ? activeDocument.outline
      : activeQuickNote
        ? deriveOutlineFromContentJson(activeQuickNote.contentJson)
        : [];
  }, [activeDocument?.outline, activeQuickNote]);

  const isOutlineItemClickable = Boolean(activeDocument && onOpenBacklinkDocument);

  const outgoingMentions = useMemo<OutgoingMentionRecord[]>(() => {
    if (activeDocument) {
      return extractOutgoingMentions(activeDocument.contentJson, activeDocument.id);
    }

    return [];
  }, [activeDocument]);

  const incomingBacklinks = activeDocument?.backlinks ?? [];
  const hasBidirectionalReferences = outgoingMentions.length > 0 || incomingBacklinks.length > 0;

  const overviewTitle = activeQuickNote ? '快记概览' : '文稿概览';
  const overviewSubtitle = activeQuickNote ? 'Quick Note Outline' : 'Details & Props';
  const outlineDescription = activeQuickNote ? '快速浏览当前快记结构' : '快速浏览当前文稿结构';

  const handleSubmitTag = async () => {
    const normalizedLabel = normalizeTagLabel(nextTagLabel);
    if (!activeDocument || !normalizedLabel) {
      setIsAddingTag(false);
      setNextTagLabel('');
      return;
    }

    await onAddTagToDocument(activeDocument.id, normalizedLabel);
    setIsAddingTag(false);
    setNextTagLabel('');
  };

  return (
    <aside
      data-testid="right-sidebar"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/40 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/5 backdrop-blur-2xl transition-all"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header Section */}
        <div className="flex items-center gap-3 px-1 mt-1 mb-2 border-b border-slate-200/50 pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-b from-white to-slate-50 text-blue-600 shadow-sm ring-1 ring-slate-200/60">
            <Library size={18} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-[14px] font-bold text-slate-800 tracking-tight leading-tight">{overviewTitle}</h3>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mt-0.5">{overviewSubtitle}</p>
          </div>
        </div>

        {/* Tags Section (Moved to top) */}
        <section className="mt-7 shrink-0">
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">标签云</p>
            <div className="flex items-center gap-1.5">
              <Hash size={14} className="text-slate-400" />
              <button
                type="button"
                aria-label="添加标签"
                disabled={!activeDocument}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                onClick={() => {
                  if (!activeDocument) {
                    return;
                  }
                  setIsAddingTag(true);
                }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
          {isAddingTag ? (
            <div className="mb-3 px-1">
              <input
                ref={tagInputRef}
                type="text"
                value={nextTagLabel}
                onChange={(event) => setNextTagLabel(event.target.value)}
                onBlur={() => {
                  setIsAddingTag(false);
                  setNextTagLabel('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSubmitTag();
                  }
                  if (event.key === 'Escape') {
                    setIsAddingTag(false);
                    setNextTagLabel('');
                  }
                }}
                placeholder="输入标签..."
                className="w-full rounded-[10px] border border-slate-200 bg-white/90 px-3 py-2 text-[12px] font-medium text-slate-700 outline-none ring-2 ring-blue-100 placeholder:text-slate-300"
                style={compactInputStyle}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 px-1">
            {activeDocument?.tags && activeDocument.tags.length > 0 ? (
              activeDocument.tags.map((tag) => (
                <div
                  key={tag.id}
                  className={[
                    'group inline-flex items-center gap-1 rounded-[10px] border px-2.5 py-1 text-[12px] font-semibold tracking-wide shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-md backdrop-blur-md',
                    tag.tone === 'primary' 
                      ? 'bg-blue-50/90 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300' 
                      : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-800',
                  ].join(' ')}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tag.tone === 'primary' ? 'bg-blue-400' : 'bg-slate-300'}`}></span>
                  {tag.label}
                  <button
                    type="button"
                    aria-label={`移除标签 ${tag.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:bg-white/70 hover:opacity-100"
                    onClick={() => {
                      if (!activeDocument) {
                        return;
                      }
                      void onRemoveTagFromDocument(activeDocument.id, tag.id);
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))
            ) : (
               <div className="w-full py-2 text-[12px] text-slate-400 text-center rounded-[10px] border border-dashed border-slate-300/60 bg-slate-50/50">
                暂无标签
              </div>
            )}
          </div>
        </section>

        {/* Outline Section (Moved to bottom) */}
        <section className="mt-7 flex min-h-0 flex-1 flex-col rounded-[18px] border border-white/70 bg-white/45 px-3 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">内容目录</p>
              <p className="mt-1 text-[12px] text-slate-500">{outlineDescription}</p>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-slate-100/80 text-slate-500 ring-1 ring-slate-200/70">
              <ListTree size={14} />
            </div>
          </div>
          <div
            data-testid="right-sidebar-outline-scroll"
            className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar"
          >
            {activeOutline.length > 0 ? (
              activeOutline.map((item, index) => {
                const isActive = index === 0;
                const itemClassName = [
                  'group flex w-full items-center rounded-[12px] border px-3 py-2 text-left text-[13px] transition-all duration-200',
                  isActive
                    ? 'border-blue-200 bg-blue-50/90 text-blue-700 shadow-sm'
                    : 'border-transparent bg-white/65 text-slate-600 hover:border-slate-200 hover:bg-white/90 hover:text-slate-900',
                  isOutlineItemClickable ? 'cursor-pointer' : 'cursor-default',
                ].join(' ');

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-label={`定位到大纲标题 ${item.title}`}
                    className={itemClassName}
                    style={{ paddingLeft: `${12 + Math.max(0, item.level - 1) * 14}px` }}
                    disabled={!isOutlineItemClickable}
                    onClick={() => {
                      if (!activeDocument || !onOpenBacklinkDocument) {
                        return;
                      }

                      onOpenBacklinkDocument({
                        documentId: activeDocument.id,
                        blockId: item.id,
                      });
                    }}
                  >
                    <span className="mr-2 shrink-0 rounded-[8px] bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      H{item.level}
                    </span>
                    <span className="truncate tracking-[0.01em]">{item.title}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-2 py-3 text-[12px] text-slate-400 text-center rounded-[12px] border border-dashed border-slate-300/60 bg-slate-50/50">
                暂无大纲内容
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Backlinks Section (Footer area) */}
      <div className="mt-6 pt-4 border-t border-slate-200/50 relative z-10 shrink-0">
        <section>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">关联引用</p>
            <Link2 size={14} className="text-slate-400" />
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
            {activeDocument ? (
              hasBidirectionalReferences ? (
                <>
                  {renderReferenceSection({
                    title: '提及文档',
                    icon: <ArrowUpRight size={14} />,
                    emptyState: '当前文档还没有提及其他文档',
                    children:
                      outgoingMentions.length > 0
                        ? outgoingMentions.map((mention) =>
                            renderReferenceCard({
                              id: mention.id,
                              title: mention.title,
                              description: mention.description,
                              ariaLabel: `打开提及文档 ${mention.title}`,
                              disabled: !onOpenBacklinkDocument,
                              onClick: () => {
                                if (!onOpenBacklinkDocument) {
                                  return;
                                }

                                onOpenBacklinkDocument({
                                  documentId: mention.targetDocumentId,
                                });
                              },
                            }),
                          )
                        : null,
                  })}
                  {renderReferenceSection({
                    title: '被提及于',
                    icon: <CornerDownLeft size={14} />,
                    emptyState: '当前文档还没有被其他文档提及',
                    children:
                      incomingBacklinks.length > 0
                        ? incomingBacklinks.map((backlink: BacklinkRecord) =>
                            renderReferenceCard({
                              id: backlink.id,
                              title: backlink.title,
                              description: backlink.description,
                              ariaLabel: `打开来源文档 ${backlink.title}`,
                              disabled: !backlink.sourceDocumentId || !onOpenBacklinkDocument,
                              onClick: () => {
                                if (!backlink.sourceDocumentId || !onOpenBacklinkDocument) {
                                  return;
                                }

                                onOpenBacklinkDocument({
                                  documentId: backlink.sourceDocumentId,
                                  blockId: backlink.sourceBlockId ?? undefined,
                                });
                              },
                            }),
                          )
                        : null,
                  })}
                </>
              ) : (
                <div className={referenceEmptyStateClassName}>当前文档还没有关联引用</div>
              )
            ) : (
              <div className={referenceEmptyStateClassName}>
                暂无关联引用
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
