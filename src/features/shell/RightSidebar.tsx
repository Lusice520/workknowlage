import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownLeft, ArrowUpRight, FileText, Hash, Library, ListTree, Plus, Sparkles, X } from 'lucide-react';
import { deriveOutlineFromContentJson } from '../../shared/lib/documentContent';
import type {
  SidebarAssociationResult,
  SidebarAssociatedDocument,
  SidebarAssociatedDocumentBadge,
  SidebarAssociatedDocumentEvidence,
  SidebarTextEvidence,
} from '../../shared/lib/sidebarAssociations';
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
  associationState?: SidebarAssociationResult;
  focusedOutlineItemId?: string | null;
  onAddTagToDocument: (documentId: string, label: string) => Promise<void>;
  onFocusOutlineItem?: (outlineItemId: string | null) => void;
  onRemoveTagFromDocument: (documentId: string, tagId: string) => Promise<void>;
  onOpenBacklinkDocument?: (target: DocumentNavigationTarget) => void;
}

const compactInputStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

const emptyAssociationState: SidebarAssociationResult = {
  relatedDocuments: [],
  relatedTags: [],
  similarBlocks: [],
  suggestedLinks: [],
  textEvidence: [],
  associatedDocuments: [],
  summary: {
    wikiAssociationCount: 0,
  },
};

type RightSidebarTab = 'properties' | 'wiki';

const referenceSectionLabelStyle = 'text-[12px] font-semibold tracking-[0.04em] text-slate-500';
const referenceEmptyStateClassName = 'rounded-[12px] bg-slate-50/80 px-3 py-2.5 text-[12px] text-slate-500';

const getWikiAssociationBadgeLabel = (count: number) => {
  if (count <= 0) {
    return '';
  }

  return count > 9 ? '9+' : `${count}`;
};

const normalizeTagLabel = (label: string) => {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    return '';
  }

  return trimmedLabel.startsWith('#') ? trimmedLabel : `#${trimmedLabel}`;
};

const renderAssociationRow = ({
  id,
  title,
  meta,
  icon,
  active = false,
  ariaLabel,
  disabled,
  onClick,
}: {
  id: string;
  title: string;
  meta?: string;
  icon?: ReactNode;
  active?: boolean;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    key={id}
    aria-label={ariaLabel}
    className={[
      'group flex w-full items-start gap-2.5 rounded-[10px] px-1.5 py-2.5 text-left transition-colors duration-200 hover:bg-slate-100/70 disabled:cursor-default disabled:opacity-75',
      active ? 'bg-slate-100/85' : '',
    ].join(' ')}
    disabled={disabled}
    onClick={onClick}
  >
    {icon ? (
      <span
        className={[
          'mt-[2px] shrink-0 transition-colors',
          active ? 'text-violet-500' : 'text-slate-400 group-hover:text-slate-500',
        ].join(' ')}
      >
        {icon}
      </span>
    ) : null}
    <span className="min-w-0 flex-1">
      <span
        className={[
          'block truncate text-[13px] font-medium transition-colors',
          active ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900',
        ].join(' ')}
      >
        {title}
      </span>
      {meta ? <span className="mt-0.5 block truncate text-[11px] text-slate-400">{meta}</span> : null}
    </span>
  </button>
);

const truncatePreviewText = (value: string | undefined, maxLength = 88) => {
  if (!value) {
    return '';
  }

  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
};

const addLegacyAssociatedDocumentBadge = (
  badges: SidebarAssociatedDocumentBadge[],
  badge: SidebarAssociatedDocumentBadge,
) => {
  if (!badges.includes(badge)) {
    badges.push(badge);
  }
};

const getAssociatedDocumentEvidenceCount = (document: SidebarAssociatedDocument): number =>
  document.similarityEvidence.length + document.textEvidence.length;

const getAssociatedDocumentEvidenceSummary = (document: SidebarAssociatedDocument): string => {
  const summary: string[] = [];

  if (document.similarityEvidence.length > 0) {
    summary.push(`${document.similarityEvidence.length} 处相似`);
  }

  if (document.textEvidence.length > 0) {
    summary.push(`${document.textEvidence.length} 条线索`);
  }

  if (summary.length > 0) {
    return summary.join(' · ');
  }

  return document.badges.join(' · ');
};

const buildLegacyAssociatedDocuments = (associationState: SidebarAssociationResult): SidebarAssociatedDocument[] => {
  const associatedDocumentMap = new Map<string, SidebarAssociatedDocument>();

  const getOrCreateAssociatedDocument = ({
    documentId,
    title,
    folderPath = '',
    score,
  }: {
    documentId: string;
    title: string;
    folderPath?: string;
    score: number;
  }) => {
    const current = associatedDocumentMap.get(documentId);
    if (current) {
      current.score = Math.max(current.score, score);
      if (!current.folderPath && folderPath) {
        current.folderPath = folderPath;
      }
      return current;
    }

    const associatedDocument: SidebarAssociatedDocument = {
      documentId,
      title,
      folderPath,
      score,
      badges: [],
      similarityEvidence: [],
      textEvidence: [],
    };
    associatedDocumentMap.set(documentId, associatedDocument);
    return associatedDocument;
  };

  associationState.relatedDocuments.forEach((document) => {
    const associatedDocument = getOrCreateAssociatedDocument({
      documentId: document.documentId,
      title: document.title,
      folderPath: document.folderPath,
      score: document.score,
    });

    addLegacyAssociatedDocumentBadge(associatedDocument.badges, '主题相似');
    associatedDocument.similarityEvidence.push(
      ...(document.previewMatches ?? [])
        .filter((match) => match.snippet.trim().length > 0 || match.searchText.trim().length > 0)
        .map((match) => ({
          blockId: match.blockId,
          label: match.label,
          snippet: match.snippet || truncatePreviewText(match.searchText),
          searchText: match.searchText || match.snippet,
          reason: document.reason,
          score: document.score,
        })),
    );
  });

  associationState.similarBlocks.forEach((block) => {
    const associatedDocument = getOrCreateAssociatedDocument({
      documentId: block.documentId,
      title: block.documentTitle,
      score: block.score,
    });

    addLegacyAssociatedDocumentBadge(associatedDocument.badges, '局部相似');
    associatedDocument.similarityEvidence.push({
      blockId: block.blockId,
      label: block.label,
      snippet: truncatePreviewText(block.text),
      searchText: block.text,
      reason: '局部相似',
      score: block.score,
    });
  });

  associationState.textEvidence.forEach((evidence) => {
    const associatedDocument = getOrCreateAssociatedDocument({
      documentId: evidence.documentId,
      title: evidence.documentTitle,
      score: evidence.score,
    });

    addLegacyAssociatedDocumentBadge(associatedDocument.badges, '原文命中');
    associatedDocument.textEvidence.push(evidence);
  });

  return Array.from(associatedDocumentMap.values()).sort((left, right) => {
    const leftEvidenceCount = getAssociatedDocumentEvidenceCount(left);
    const rightEvidenceCount = getAssociatedDocumentEvidenceCount(right);
    const leftHasTextEvidence = left.textEvidence.length > 0 ? 1 : 0;
    const rightHasTextEvidence = right.textEvidence.length > 0 ? 1 : 0;

    return (
      right.score - left.score ||
      rightHasTextEvidence - leftHasTextEvidence ||
      rightEvidenceCount - leftEvidenceCount ||
      left.title.localeCompare(right.title)
    );
  });
};

const getPreviewPosition = (anchorRect: DOMRect, previewHeight: number) => {
  const previewWidth = 356;
  const offset = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(16, Math.min(anchorRect.left - previewWidth - offset, viewportWidth - previewWidth - 16));
  const top = Math.max(
    16,
    Math.min(anchorRect.top - 12, viewportHeight - previewHeight - 16),
  );

  return { left, top };
};

interface AssociatedDocumentHoverPreview {
  documentId: string;
  title: string;
  similarityEvidence: SidebarAssociatedDocumentEvidence[];
  textEvidence: SidebarTextEvidence[];
  rect: DOMRect;
}

export function RightSidebar({
  activeDocument,
  activeQuickNote = null,
  activeFolder: _activeFolder,
  activeSpace: _activeSpace,
  associationState = emptyAssociationState,
  focusedOutlineItemId = null,
  onAddTagToDocument,
  onFocusOutlineItem,
  onRemoveTagFromDocument,
  onOpenBacklinkDocument,
}: RightSidebarProps) {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [nextTagLabel, setNextTagLabel] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState<RightSidebarTab>('properties');
  const [hoveredSimilarDocumentId, setHoveredSimilarDocumentId] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<AssociatedDocumentHoverPreview | null>(null);
  const hoverCloseTimeoutRef = useRef<number | null>(null);
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
    setActiveSidebarTab('properties');
    setHoveredSimilarDocumentId(null);
    setHoverPreview(null);
  }, [activeDocument?.id, activeQuickNote?.id]);

  useEffect(
    () => () => {
      if (hoverCloseTimeoutRef.current !== null) {
        window.clearTimeout(hoverCloseTimeoutRef.current);
      }
    },
    [],
  );

  const activeOutline = useMemo(() => {
    return activeDocument?.outline
      ? activeDocument.outline
      : activeQuickNote
        ? deriveOutlineFromContentJson(activeQuickNote.contentJson)
        : [];
  }, [activeDocument?.outline, activeQuickNote]);

  const isOutlineItemClickable = Boolean(activeDocument);

  const outgoingMentions = useMemo<OutgoingMentionRecord[]>(() => {
    if (activeDocument) {
      return extractOutgoingMentions(activeDocument.contentJson, activeDocument.id);
    }

    return [];
  }, [activeDocument]);

  const incomingBacklinks = activeDocument?.backlinks ?? [];
  const hasExplicitReferences = outgoingMentions.length > 0 || incomingBacklinks.length > 0;
  const overviewTitle = activeQuickNote ? '快记概览' : '文稿概览';
  const overviewSubtitle = activeQuickNote ? 'Quick Note Outline' : 'Details & Props';
  const outlineDescription = activeQuickNote ? '快速浏览当前快记结构' : '快速浏览当前文稿结构';
  const associatedDocuments = useMemo(
    () =>
      associationState.associatedDocuments.length > 0
        ? associationState.associatedDocuments
        : buildLegacyAssociatedDocuments(associationState),
    [associationState],
  );
  const hasAssociatedDocumentResults = associatedDocuments.length > 0;
  const wikiAssociationCount = useMemo(() => {
    const associatedDocumentIds = new Set<string>();

    outgoingMentions.forEach((mention) => associatedDocumentIds.add(mention.targetDocumentId));
    incomingBacklinks.forEach((backlink) => associatedDocumentIds.add(backlink.sourceDocumentId));
    associatedDocuments.forEach((document) => associatedDocumentIds.add(document.documentId));

    return Math.max(associatedDocumentIds.size, associationState.summary?.wikiAssociationCount ?? 0);
  }, [associatedDocuments, associationState.summary?.wikiAssociationCount, incomingBacklinks, outgoingMentions]);
  const wikiAssociationBadgeLabel = getWikiAssociationBadgeLabel(wikiAssociationCount);

  const clearHoverCloseTimeout = () => {
    if (hoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  };

  const hideHoverPreview = () => {
    clearHoverCloseTimeout();
    setHoveredSimilarDocumentId(null);
    setHoverPreview(null);
  };

  const scheduleHideHoverPreview = () => {
    clearHoverCloseTimeout();
    hoverCloseTimeoutRef.current = window.setTimeout(() => {
      setHoveredSimilarDocumentId(null);
      setHoverPreview(null);
      hoverCloseTimeoutRef.current = null;
    }, 120);
  };

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

  const hoverPreviewEvidenceCount = hoverPreview
    ? hoverPreview.similarityEvidence.length + hoverPreview.textEvidence.length
    : 0;
  const hoverPreviewEvidenceSummary = hoverPreview
    ? [
        hoverPreview.similarityEvidence.length > 0 ? `${hoverPreview.similarityEvidence.length} 处相似` : '',
        hoverPreview.textEvidence.length > 0 ? `${hoverPreview.textEvidence.length} 条线索` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <aside
      data-testid="right-sidebar"
      className="flex h-full min-h-0 w-full flex-col overflow-visible rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(248,250,252,0.92)_100%)] p-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5 backdrop-blur-2xl transition-all"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mt-1 flex items-start gap-3 px-1 pb-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/85 text-blue-600 ring-1 ring-slate-200/70">
            <Library size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{overviewSubtitle}</p>
            <h3 className="mt-1 text-[15px] font-bold leading-tight tracking-tight text-slate-800">{overviewTitle}</h3>
            <p className="mt-1 text-[12px] leading-[1.5] text-slate-500">{outlineDescription}</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-[12px] bg-slate-100/70 p-1">
          <button
            type="button"
            className={[
              'flex h-8 items-center justify-center rounded-[9px] text-[12px] font-semibold transition-all',
              activeSidebarTab === 'properties'
                ? 'bg-white text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
            aria-pressed={activeSidebarTab === 'properties'}
            onClick={() => {
              setActiveSidebarTab('properties');
              hideHoverPreview();
            }}
          >
            属性
          </button>
          <button
            type="button"
            className={[
              'flex h-8 items-center justify-center gap-1.5 rounded-[9px] text-[12px] font-semibold transition-all',
              activeSidebarTab === 'wiki'
                ? 'bg-white text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
            aria-pressed={activeSidebarTab === 'wiki'}
            onClick={() => setActiveSidebarTab('wiki')}
          >
            <span>Wiki</span>
            {wikiAssociationBadgeLabel ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
                {wikiAssociationBadgeLabel}
              </span>
            ) : null}
          </button>
        </div>

        {activeSidebarTab === 'properties' ? (
        <>
        <section className="shrink-0 border-t border-slate-200/55 pt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">标签云</p>
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
            <div className="mb-2 px-1">
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
          <div className="flex flex-wrap gap-1.5 px-1">
            {activeDocument?.tags && activeDocument.tags.length > 0 ? (
              activeDocument.tags.map((tag) => (
                <div
                  key={tag.id}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-blue-50/85 px-2.5 py-1 text-[11px] font-medium text-blue-700 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  {tag.label}
                  <button
                    type="button"
                    aria-label={`移除标签 ${tag.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-current opacity-55 transition-opacity hover:opacity-100"
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
              <div className="w-full rounded-[10px] bg-slate-50/80 px-3 py-2 text-center text-[12px] text-slate-400">
                暂无标签
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 flex min-h-0 flex-1 flex-col border-t border-slate-200/55 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">文稿脉络</p>
            <ListTree size={14} className="text-slate-300" />
          </div>
          <div
            data-testid="right-sidebar-outline-scroll"
            className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3 pt-2 custom-scrollbar"
          >
            {activeOutline.length > 0 ? (
              activeOutline.map((item, index) => {
                const isActive = focusedOutlineItemId ? item.id === focusedOutlineItemId : index === 0;
                const itemClassName = [
                  'group flex w-full items-center gap-2 rounded-[14px] px-2 py-1.5 text-left text-[13px] transition-all duration-200',
                  isActive
                    ? 'bg-white text-indigo-600 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70'
                    : 'text-slate-400 hover:bg-slate-50/70 hover:text-slate-700',
                  isOutlineItemClickable ? 'cursor-pointer' : 'cursor-default',
                ].join(' ');

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-label={`定位到大纲标题 ${item.title}`}
                    className={itemClassName}
                    style={{ paddingLeft: `${8 + Math.max(0, item.level - 1) * 14}px` }}
                    disabled={!isOutlineItemClickable}
                    onClick={() => {
                      if (!activeDocument) {
                        return;
                      }

                      onFocusOutlineItem?.(item.id);
                      onOpenBacklinkDocument?.({
                        documentId: activeDocument.id,
                        blockId: item.id,
                      });
                    }}
                  >
                    <span
                      className={[
                        'shrink-0 rounded-[8px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
                        isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100/80 text-slate-300',
                      ].join(' ')}
                    >
                      H{item.level}
                    </span>
                    <span className="truncate leading-[1.45] tracking-[0.01em]">{item.title}</span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[12px] bg-slate-50/80 px-3 py-3 text-center text-[12px] text-slate-400">
                暂无大纲内容
              </div>
            )}
          </div>
        </section>
        </>
        ) : null}

        {activeSidebarTab === 'wiki' ? (
        <section
          data-testid="knowledge-association-card"
          className="relative min-h-0 flex-1 border-t border-slate-200/60 pt-5"
        >
          <div className="mb-4 px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">知识关联</p>
          </div>
          <div className="min-h-[228px] space-y-5 overflow-y-auto px-1 pr-1 custom-scrollbar">
            <div className="space-y-2">
              <p className={referenceSectionLabelStyle}>显式引用</p>
              {activeDocument ? (
                hasExplicitReferences ? (
                  <div className="divide-y divide-slate-100/90">
                    {outgoingMentions.map((mention) =>
                      renderAssociationRow({
                        id: mention.id,
                        title: mention.title,
                        icon: <ArrowUpRight size={13} />,
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
                    )}
                    {incomingBacklinks.map((backlink: BacklinkRecord) =>
                      renderAssociationRow({
                        id: backlink.id,
                        title: backlink.title,
                        icon: <ArrowDownLeft size={13} />,
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
                    )}
                  </div>
                ) : (
                  <div className={referenceEmptyStateClassName}>当前文稿还没有引用或提及</div>
                )
              ) : (
                <div className={referenceEmptyStateClassName}>请选择文稿以查看知识关联</div>
              )}
            </div>

            <div className="space-y-2">
              <p className={referenceSectionLabelStyle}>关联文档</p>
              {activeDocument ? (
                hasAssociatedDocumentResults ? (
                  <div className="divide-y divide-slate-100/90">
                    {associatedDocuments.map((associatedDocument) => {
                      const evidenceSummary = getAssociatedDocumentEvidenceSummary(associatedDocument);
                      const hasHoverPreview = getAssociatedDocumentEvidenceCount(associatedDocument) > 0;
                      const isHovered =
                        hoveredSimilarDocumentId === associatedDocument.documentId ||
                        hoverPreview?.documentId === associatedDocument.documentId;

                      return (
                        <div key={associatedDocument.documentId} className="relative">
                          <button
                            type="button"
                            aria-label={`打开关联文档 ${associatedDocument.title}`}
                            className={[
                              'group flex w-full items-start gap-2.5 rounded-[10px] px-1.5 py-2.5 text-left transition-colors duration-200 hover:bg-slate-100/70 disabled:cursor-default disabled:opacity-75',
                              isHovered ? 'bg-slate-100/85' : '',
                            ].join(' ')}
                            disabled={!onOpenBacklinkDocument}
                            onMouseEnter={(event) => {
                              clearHoverCloseTimeout();
                              setHoveredSimilarDocumentId(associatedDocument.documentId);

                              if (!hasHoverPreview) {
                                setHoverPreview(null);
                                return;
                              }

                              setHoverPreview({
                                documentId: associatedDocument.documentId,
                                title: associatedDocument.title,
                                similarityEvidence: associatedDocument.similarityEvidence,
                                textEvidence: associatedDocument.textEvidence,
                                rect: event.currentTarget.getBoundingClientRect(),
                              });
                            }}
                            onMouseLeave={scheduleHideHoverPreview}
                            onClick={() => {
                              if (!onOpenBacklinkDocument) {
                                return;
                              }

                              onOpenBacklinkDocument({
                                documentId: associatedDocument.documentId,
                              });
                            }}
                          >
                            <span
                              className={[
                                'mt-[2px] shrink-0 transition-colors',
                                isHovered ? 'text-violet-500' : 'text-slate-400 group-hover:text-slate-500',
                              ].join(' ')}
                            >
                              <Sparkles size={13} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={[
                                  'block truncate text-[13px] font-medium transition-colors',
                                  isHovered ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900',
                                ].join(' ')}
                              >
                                {associatedDocument.title}
                              </span>
                              {associatedDocument.badges.length > 0 ? (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {associatedDocument.badges.map((badge) => (
                                    <span
                                      key={`${associatedDocument.documentId}-${badge}`}
                                      className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-blue-600 ring-1 ring-blue-100"
                                    >
                                      {badge}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                              {evidenceSummary ? (
                                <span className="mt-1 block truncate text-[11px] text-slate-400">{evidenceSummary}</span>
                              ) : null}
                            </span>
                          </button>
                          {hasHoverPreview && isHovered ? <span className="sr-only">显示关联证据预览</span> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={referenceEmptyStateClassName}>
                    {focusedOutlineItemId ? '当前区块暂无关联文档' : '暂未发现关联文档'}
                  </div>
                )
              ) : (
                <div className={referenceEmptyStateClassName}>请选择文稿以查看知识关联</div>
              )}
            </div>
          </div>
        </section>
        ) : null}
      </div>
      {hoverPreview && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[80] w-[356px] rounded-[24px] border border-white/80 bg-white/96 p-5 shadow-[0_28px_72px_rgba(15,23,42,0.16)] backdrop-blur-xl"
              style={getPreviewPosition(
                hoverPreview.rect,
                Math.min(420, 148 + Math.min(hoverPreviewEvidenceCount, 6) * 62),
              )}
              onMouseEnter={clearHoverCloseTimeout}
              onMouseLeave={scheduleHideHoverPreview}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-500">
                    <FileText size={18} />
                  </div>
                  <p className="truncate text-[15px] font-semibold tracking-tight text-slate-800">{hoverPreview.title}</p>
                </div>
                {hoverPreviewEvidenceSummary ? (
                  <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-500">
                    {hoverPreviewEvidenceSummary}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                <div className="max-h-[296px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {hoverPreview.similarityEvidence.map((evidence, index) => (
                    <button
                      type="button"
                      key={`${hoverPreview.documentId}-similarity-${evidence.blockId}-${index}`}
                      aria-label={`打开相似证据 ${hoverPreview.title} / ${evidence.label}`}
                      className="flex w-full flex-col items-start gap-1 rounded-[14px] bg-slate-50/85 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
                      disabled={!onOpenBacklinkDocument}
                      onClick={() => {
                        if (!onOpenBacklinkDocument) {
                          return;
                        }

                        hideHoverPreview();
                        onOpenBacklinkDocument({
                          documentId: hoverPreview.documentId,
                          blockId: evidence.blockId,
                          fallbackText: evidence.searchText,
                        });
                      }}
                    >
                      <span className="text-[11px] font-semibold text-violet-500">
                        {evidence.reason || evidence.label}
                      </span>
                      <span className="text-[12px] leading-[1.6] text-slate-700">
                        {truncatePreviewText(evidence.snippet || evidence.searchText, 72)}
                      </span>
                    </button>
                  ))}
                  {hoverPreview.textEvidence.map((evidence, index) => (
                    <button
                      type="button"
                      key={`${hoverPreview.documentId}-text-${evidence.blockId}-${index}`}
                      aria-label={`打开原文证据 ${hoverPreview.title} / ${evidence.matchedText}`}
                      className="flex w-full flex-col items-start gap-1 rounded-[14px] bg-blue-50/70 px-3 py-2.5 text-left transition-colors hover:bg-blue-50"
                      disabled={!onOpenBacklinkDocument}
                      onClick={() => {
                        if (!onOpenBacklinkDocument) {
                          return;
                        }

                        hideHoverPreview();
                        onOpenBacklinkDocument({
                          documentId: evidence.documentId,
                          blockId: evidence.blockId,
                          fallbackText: evidence.snippet || evidence.matchedText,
                        });
                      }}
                    >
                      <span className="text-[11px] font-semibold text-blue-600">{evidence.reason}</span>
                      <span className="text-[12px] leading-[1.6] text-slate-700">
                        {truncatePreviewText(evidence.matchedText, 72)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
