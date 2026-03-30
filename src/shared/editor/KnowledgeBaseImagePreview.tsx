import { createPortal } from 'react-dom';
import { Download, ExternalLink, X } from 'lucide-react';

export interface KnowledgeBaseImagePreviewProps {
  imagePreview: { url: string; name?: string } | null;
  imagePreviewScale: number;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const KnowledgeBaseImagePreview = ({
  imagePreview,
  imagePreviewScale,
  onClose,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: KnowledgeBaseImagePreviewProps) => {
  if (!imagePreview || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="kb-image-preview-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="kb-image-preview-dialog" role="dialog" aria-modal="true" aria-label="图片预览">
        <div className="kb-image-preview-header">
          <span className="kb-image-preview-title" title={imagePreview.name || '图片预览'}>
            {imagePreview.name || '图片预览'}
          </span>
          <div className="kb-image-preview-actions">
            <button type="button" className="kb-image-preview-btn" onClick={onZoomOut} title="缩小">
              -
            </button>
            <button type="button" className="kb-image-preview-btn kb-image-preview-zoom" onClick={onResetZoom} title="重置缩放">
              {Math.round(imagePreviewScale * 100)}%
            </button>
            <button type="button" className="kb-image-preview-btn" onClick={onZoomIn} title="放大">
              +
            </button>
            <a className="kb-image-preview-btn" href={imagePreview.url} download title="下载图片">
              <Download size={15} />
            </a>
            <a className="kb-image-preview-btn" href={imagePreview.url} target="_blank" rel="noreferrer" title="新窗口打开">
              <ExternalLink size={15} />
            </a>
            <button type="button" className="kb-image-preview-btn" onClick={onClose} title="关闭预览">
              <X size={15} />
            </button>
          </div>
        </div>
        <div
          className="kb-image-preview-body"
          onWheel={(event) => {
            event.preventDefault();
            if (event.deltaY > 0) {
              onZoomOut();
            } else if (event.deltaY < 0) {
              onZoomIn();
            }
          }}
        >
          <img
            src={imagePreview.url}
            alt={imagePreview.name || '图片预览'}
            className="kb-image-preview-image"
            style={{ transform: `scale(${imagePreviewScale})` }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
