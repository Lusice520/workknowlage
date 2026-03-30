import React from 'react';
import { defaultProps } from '@blocknote/core';
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { AlertCircle, Download, ExternalLink, FileText, Image as ImageIcon, Paperclip, Table2 } from 'lucide-react';
import { createAlert } from './Alert';
import { createReactBlockSpec, createReactInlineContentSpec } from './blocknoteReactNoComments';
import { createRichTable } from './RichTable';
import { createBlockNoteSchema } from './blockNoteSchema';
import { KB_IMAGE_PREVIEW_EVENT, IMAGE_EXT_REGEX } from './constants';
import { ROOT_FOLDER_LABEL } from '../lib/documentPaths';
import type { DocumentRecord, MentionDocumentCandidate } from '../types/workspace';

const focusAlertRootAfterInsert = (editor: any) => {
  queueMicrotask(() => {
    const cursorBlock = editor.getTextCursorPosition()?.block;
    const alertBlock = cursorBlock?.type === 'alert'
      ? cursorBlock
      : (cursorBlock?.id ? editor.getParentBlock(cursorBlock.id) : null);

    if (alertBlock?.type === 'alert' && alertBlock.id) {
      editor.setTextCursorPosition(alertBlock.id, 'end');
      editor.prosemirrorView?.focus?.();
    }
  });
};

const createKbAttachmentBlock = createReactBlockSpec(
  {
    type: 'kbAttachment',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      url: {
        default: '',
      },
      name: {
        default: '附件',
      },
      isImage: {
        default: false,
      },
    },
    content: 'none',
  },
  {
    render: ({ block }: any) => {
      const { url, name, isImage } = block.props;
      if (!url) return null;

      const handlePreviewImage = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(KB_IMAGE_PREVIEW_EVENT, {
          detail: {
            url,
            name: name || '上传图片',
          },
        }));
      };

      return (
        <div className="kb-attachment-block" contentEditable={false}>
          <div className="kb-attachment-meta">
            {isImage ? <ImageIcon size={16} /> : <Paperclip size={16} />}
            <span className="kb-attachment-name" title={name}>{name || '附件'}</span>
            <a className="kb-attachment-open" href={url} target="_blank" rel="noreferrer" title="打开附件">
              <ExternalLink size={14} />
            </a>
            <a className="kb-attachment-open" href={url} download title="下载附件">
              <Download size={14} />
            </a>
          </div>
          {isImage ? (
            <button
              type="button"
              className="kb-attachment-image-link"
              onClick={handlePreviewImage}
              title="点击预览图片"
            >
              <img src={url} alt={name || '上传图片'} className="kb-attachment-image" loading="lazy" />
            </button>
          ) : null}
        </div>
      );
    },
  }
);

const createDocumentMentionInlineContent = createReactInlineContentSpec(
  {
    type: 'docMention',
    propSchema: {
      documentId: {
        default: '',
      },
      title: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => {
      const title = String(inlineContent.props.title || '').trim() || '未命名文档';

      return (
        <span
          className="kb-doc-mention"
          contentEditable={false}
          data-document-id={inlineContent.props.documentId}
          title={`提及文档：${title}`}
        >
          @{title}
        </span>
      );
    },
  }
);

export const kbSchema = createBlockNoteSchema().extend({
  inlineContentSpecs: {
    docMention: createDocumentMentionInlineContent,
  },
  blockSpecs: {
    alert: createAlert(),
    richTable: createRichTable(),
    kbAttachment: createKbAttachmentBlock(),
  },
});

const createAlertSlashItem = (editor: any) => ({
  title: '提醒块 (Alert)',
  subtext: '用于强调文字的高亮提醒区块',
  aliases: ['alert', 'notification', 'warning', 'error', 'info', 'success', '提醒', '警告'],
  group: '常规',
  icon: <AlertCircle size={18} />,
  onItemClick: () => {
    insertOrUpdateBlockForSlashMenu(editor, { type: 'alert' });
    focusAlertRootAfterInsert(editor);
  },
});

const createRichTableSlashItem = (editor: any) => ({
  title: '高级表格 (RichTable)',
  subtext: '支持真实有序/无序列表、合并拆分单元格',
  aliases: ['table', 'rich table', '表格', '高级表格', 'grid'],
  group: '常规',
  icon: <Table2 size={18} />,
  onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'richTable' }),
});

export const getKnowledgeBaseSlashItems = (editor: any) => [
  createAlertSlashItem(editor),
  createRichTableSlashItem(editor),
];

const normalizeMentionQuery = (value: string) => String(value || '').trim().toLocaleLowerCase('zh-CN');

const normalizeMentionTitle = (value: string) => String(value || '').trim();

const normalizeMentionPath = (value: string) => String(value || '').trim();

const MENTION_RESULT_LIMIT = 8;

const getMentionUpdatedAtScore = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getMentionMatchScore = (
  title: string,
  folderPath: string,
  query: string,
) => {
  if (!query) {
    return 1;
  }

  const normalizedTitle = normalizeMentionTitle(title).toLocaleLowerCase('zh-CN');
  const normalizedFolderPath = normalizeMentionPath(folderPath).toLocaleLowerCase('zh-CN');

  if (normalizedTitle.startsWith(query)) {
    return 300;
  }

  if (normalizedTitle.includes(query)) {
    return 200;
  }

  if (normalizedFolderPath.includes(query)) {
    return 100;
  }

  return 0;
};

export const getDocumentMentionItems = (
  editor: any,
  query: string,
  documents: MentionDocumentCandidate[] = [],
  currentDocumentId?: string | null,
) => {
  const normalizedQuery = normalizeMentionQuery(query);

  return documents
    .map((document) => {
      const title = normalizeMentionTitle(document.title);
      const folderPath = normalizeMentionPath(document.folderPath || '');
      const score = getMentionMatchScore(title, folderPath, normalizedQuery);

      return {
        document,
        title,
        folderPath,
        score,
      };
    })
    .filter(({ document, title, score }) => Boolean(title) && document.id !== currentDocumentId && score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const updatedAtDelta = getMentionUpdatedAtScore(right.document.updatedAt) - getMentionUpdatedAtScore(left.document.updatedAt);
      if (updatedAtDelta !== 0) {
        return updatedAtDelta;
      }

      return left.title.localeCompare(right.title, 'zh-CN');
    })
    .slice(0, MENTION_RESULT_LIMIT)
    .map(({ document, folderPath }) => ({
      title: `@${document.title}`,
      subtext: folderPath || ROOT_FOLDER_LABEL,
      aliases: [document.title, folderPath].filter(Boolean),
      group: '文档',
      icon: <FileText size={18} />,
      onItemClick: () => {
        editor.insertInlineContent([
          {
            type: 'docMention',
            props: {
              documentId: document.id,
              title: document.title,
            },
          },
          ' ',
        ]);
      },
    }));
};

export const isImageAttachment = (file: File | undefined, url: string, name: string) => {
  const candidate = `${name || ''} ${url || ''}`;
  if (file?.type?.startsWith('image/')) return true;
  return IMAGE_EXT_REGEX.test(candidate);
};
