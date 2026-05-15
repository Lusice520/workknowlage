import { useCallback, useEffect, useState } from 'react';
import { isImageAttachment } from './editorSchema';

const hasMeaningfulClipboardTextPayload = (dataTransfer: Pick<DataTransfer, 'getData'> | null | undefined) => {
  if (!dataTransfer?.getData) return false;

  const clipboardHtml = String(dataTransfer.getData('text/html') || '').trim();
  if (clipboardHtml.length > 0) return true;

  const clipboardText = String(dataTransfer.getData('text/plain') || '').trim();
  return clipboardText.length > 0;
};

export const shouldHandleClipboardFilePasteAsUpload = ({
  files,
  dataTransfer,
}: {
  files: File[];
  dataTransfer: Pick<DataTransfer, 'getData'> | null | undefined;
}) => {
  if (!files.length) return false;

  const allFilesAreImages = files.every((file) => String(file?.type || '').startsWith('image/'));
  if (!allFilesAreImages) return true;

  return !hasMeaningfulClipboardTextPayload(dataTransfer);
};

export function useSharedBlockNoteUploads({
  editor,
  showToast,
  uploadFiles,
}: {
  editor: any;
  showToast: (message: string, type?: string) => void;
  uploadFiles?: (files: File[]) => Promise<string[]>;
}) {
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);

  const uploadClipboardFiles = useCallback(async (files: File[]) => {
    if (!uploadFiles || !files || files.length === 0) return [];

    try {
      return await uploadFiles(files);
    } catch (error) {
      console.error(error);
      showToast('文件上传失败', 'error');
      return [];
    }
  }, [showToast, uploadFiles]);

  const insertUploadedBlocks = useCallback((urls: string[], files: File[]) => {
    if (!editor || !urls?.length) return;
    const cursorBlockId =
      editor.getTextCursorPosition()?.block?.id ||
      editor.document?.[editor.document.length - 1]?.id;
    if (!cursorBlockId) return;

    const blocks = urls.map((url, index) => {
      const file = files[index];
      const name = file?.name || url.split('/').pop() || '附件';
      return {
        type: 'kbAttachment',
        props: {
          url,
          name,
          isImage: isImageAttachment(file, url, name),
        },
      };
    });

    editor.insertBlocks(blocks, cursorBlockId, 'after');
  }, [editor]);

  const extractFiles = useCallback((dataTransfer: DataTransfer | null | undefined) => {
    if (!dataTransfer) return [];
    const transferFiles = Array.from(dataTransfer.files || []).filter((file) => file && file.size >= 0);
    if (transferFiles.length > 0) return transferFiles;
    if (!dataTransfer.items?.length) return [];

    const files: File[] = [];
    for (const item of dataTransfer.items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    return files;
  }, []);

  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return undefined;

    const handlePaste = async (event: ClipboardEvent) => {
      const files = extractFiles(event.clipboardData);
      if (files.length === 0) return;
      if (!shouldHandleClipboardFilePasteAsUpload({ files, dataTransfer: event.clipboardData })) return;

      event.preventDefault();
      event.stopPropagation();

      const urls = await uploadClipboardFiles(files);
      if (urls.length === 0) return;

      insertUploadedBlocks(urls, files);
      showToast(`已粘贴上传 ${urls.length} 个文件`, 'success');
    };

    dom.addEventListener('paste', handlePaste, true);
    return () => {
      dom.removeEventListener('paste', handlePaste, true);
    };
  }, [editor, extractFiles, insertUploadedBlocks, showToast, uploadClipboardFiles]);

  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return undefined;

    const handleDragOverUpload = (event: DragEvent) => {
      const files = extractFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setIsDragOverUpload(true);
    };

    const handleDragLeaveUpload = (event: DragEvent) => {
      if (!dom.contains(event.relatedTarget as Node)) {
        setIsDragOverUpload(false);
      }
    };

    const handleDropUpload = async (event: DragEvent) => {
      const files = extractFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      setIsDragOverUpload(false);

      const urls = await uploadClipboardFiles(files);
      if (urls.length === 0) return;
      insertUploadedBlocks(urls, files);
      showToast(`已拖拽上传 ${urls.length} 个文件`, 'success');
    };

    dom.addEventListener('dragover', handleDragOverUpload, true);
    dom.addEventListener('dragleave', handleDragLeaveUpload, true);
    dom.addEventListener('drop', handleDropUpload, true);

    return () => {
      dom.removeEventListener('dragover', handleDragOverUpload, true);
      dom.removeEventListener('dragleave', handleDragLeaveUpload, true);
      dom.removeEventListener('drop', handleDropUpload, true);
    };
  }, [editor, extractFiles, insertUploadedBlocks, showToast, uploadClipboardFiles]);

  return {
    isDragOverUpload,
  };
}
