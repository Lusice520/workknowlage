import React, { useMemo, useRef } from 'react';
import {
  FilePanelController,
  GridSuggestionMenuController,
  LinkToolbarController,
  SideMenuController,
  SuggestionMenuController,
  TableHandlesController,
  getDefaultReactSlashMenuItems,
} from './blocknoteReactNoComments';
import { getDocumentMentionItems, getKnowledgeBaseSlashItems } from './editorSchema';
import { KnowledgeBaseEditorView } from './KnowledgeBaseEditorView';
import { KnowledgeBaseFormattingToolbar } from './KnowledgeBaseFormattingToolbar';
import { KnowledgeBaseImagePreview } from './KnowledgeBaseImagePreview';
import { SelectionFormattingToolbarController } from './SelectionFormattingToolbarController';
import { SharedBlockNoteSearchPanel } from './SharedBlockNoteSearchPanel';
import { useSharedBlockNoteCursorVisibility } from './useSharedBlockNoteCursorVisibility';
import { useSharedBlockNoteImagePreview } from './useSharedBlockNoteImagePreview';
import { useSharedBlockNoteKeyboardGuards } from './useSharedBlockNoteKeyboardGuards';
import { useSharedBlockNoteMermaidPreview } from './useSharedBlockNoteMermaidPreview';
import { useSharedBlockNoteSearch } from './useSharedBlockNoteSearch';
import {
  shouldHandleClipboardFilePasteAsUpload,
  useSharedBlockNoteUploads,
} from './useSharedBlockNoteUploads';
import {
  isEditorComposingInput,
  shouldTrapArrowLeftAfterRichTable,
} from './sharedBlockNoteEditorBehavior';
import type { MentionDocumentCandidate } from '../types/workspace';
import './SharedBlockNoteSurface.css';

export {
  isEditorComposingInput,
  shouldHandleClipboardFilePasteAsUpload,
  shouldTrapArrowLeftAfterRichTable,
};

const NOOP = () => {};
const joinClassNames = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

const getSlashItems = async (editor: any, query: string) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const mergedItems = [
    ...getKnowledgeBaseSlashItems(editor),
    ...getDefaultReactSlashMenuItems(editor),
  ];

  return mergedItems.filter((item) => {
    const title = String(item.title || '').toLowerCase();
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    return title.startsWith(normalizedQuery) || aliases.some((alias: string) => alias.toLowerCase().startsWith(normalizedQuery));
  });
};

export interface SharedBlockNoteSurfaceProps {
  className?: string;
  editor: any;
  showToast?: (message: string, type?: string) => void;
  onTransientSearchStatusChange?: (event: {
    matchCount: number;
    query: string;
    requestKey: number;
    status: 'matched' | 'no-match';
  }) => void;
  transientSearchRequest?: {
    autoClearMs?: number;
    query: string;
    requestKey: number;
  } | null;
  uploadFiles?: (files: File[]) => Promise<string[]>;
  mentionDocuments?: MentionDocumentCandidate[];
  currentDocumentId?: string | null;
}

export const SharedBlockNoteSurface = ({
  className = '',
  currentDocumentId = null,
  editor,
  mentionDocuments = [],
  onTransientSearchStatusChange,
  showToast = NOOP,
  transientSearchRequest = null,
  uploadFiles,
}: SharedBlockNoteSurfaceProps) => {
  const editorBodyRef = useRef<HTMLDivElement | null>(null);
  const search = useSharedBlockNoteSearch({
    editor,
    editorBodyRef,
    onTransientSearchStatusChange,
    transientSearchRequest,
  });
  const uploads = useSharedBlockNoteUploads({
    editor,
    showToast,
    uploadFiles,
  });
  const imagePreview = useSharedBlockNoteImagePreview();
  const { handleEditorBodyMouseDownCapture } = useSharedBlockNoteKeyboardGuards({ editor });

  useSharedBlockNoteCursorVisibility({
    editor,
    editorBodyRef,
  });
  useSharedBlockNoteMermaidPreview({
    editor,
    editorBodyRef,
  });

  const mentionSuggestion = useMemo(() => {
    if (mentionDocuments.length === 0) {
      return null;
    }

    return (
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={(query) => Promise.resolve(
          getDocumentMentionItems(editor, query, mentionDocuments, currentDocumentId)
        )}
      />
    );
  }, [currentDocumentId, editor, mentionDocuments]);

  return (
    <>
      <div
        ref={editorBodyRef}
        className={joinClassNames('shared-blocknote-surface', 'custom-scrollbar', uploads.isDragOverUpload ? 'upload-drag-over' : '', className)}
        onMouseDownCapture={handleEditorBodyMouseDownCapture}
      >
        {search.isSearchOpen ? (
          <SharedBlockNoteSearchPanel
            activeSearchResultIndex={search.activeSearchResultIndex}
            onClose={search.closeSearch}
            onJumpToNext={() => search.jumpToSearchResult(1)}
            onJumpToPrevious={() => search.jumpToSearchResult(-1)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                search.closeSearch();
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                search.jumpToSearchResult(event.shiftKey ? -1 : 1);
              }
            }}
            onQueryChange={search.setSearchQuery}
            searchInputRef={search.searchInputRef}
            searchQuery={search.searchQuery}
            searchResultsCount={search.searchResults.length}
          />
        ) : null}
        <KnowledgeBaseEditorView editor={editor} className="blocknote-unified-editor">
          <SelectionFormattingToolbarController
            editor={editor}
            formattingToolbar={KnowledgeBaseFormattingToolbar}
          />
          <LinkToolbarController />
          <SideMenuController />
          <FilePanelController />
          <TableHandlesController />
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={(query) => getSlashItems(editor, query)}
          />
          {mentionSuggestion}
          <GridSuggestionMenuController
            triggerCharacter=":"
            columns={10}
            minQueryLength={2}
          />
        </KnowledgeBaseEditorView>
      </div>
      <KnowledgeBaseImagePreview
        imagePreview={imagePreview.imagePreview}
        imagePreviewScale={imagePreview.imagePreviewScale}
        onClose={imagePreview.closeImagePreview}
        onZoomIn={imagePreview.zoomInPreviewImage}
        onZoomOut={imagePreview.zoomOutPreviewImage}
        onResetZoom={imagePreview.resetPreviewImageZoom}
      />
    </>
  );
};

export default SharedBlockNoteSurface;
