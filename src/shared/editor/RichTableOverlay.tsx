import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Ellipsis, EllipsisVertical, Palette, Plus, AlignLeft, AlignCenter, AlignRight, Columns2 } from 'lucide-react';
import { getRichTableOverlayHost } from './richTableOverlayHost';
import type { RichTableOverlayModel } from './useRichTableOverlayModel';

const COLOR_OPTIONS = [
  { label: '默认', value: null },
  { label: '灰色', value: '#6b7280' },
  { label: '棕色', value: '#7c5a46' },
  { label: '红色', value: '#dc2626' },
  { label: '橙色', value: '#ea580c' },
  { label: '黄色', value: '#ca8a04' },
  { label: '绿色', value: '#16a34a' },
  { label: '蓝色', value: '#2563eb' },
  { label: '紫色', value: '#7c3aed' },
  { label: '粉色', value: '#db2777' },
];

const BG_OPTIONS = [
  { label: '默认', value: null },
  { label: '灰色', value: '#f3f4f6' },
  { label: '棕色', value: '#f5ece6' },
  { label: '红色', value: '#fee2e2' },
  { label: '橙色', value: '#ffedd5' },
  { label: '黄色', value: '#fef9c3' },
  { label: '绿色', value: '#dcfce7' },
  { label: '蓝色', value: '#dbeafe' },
  { label: '紫色', value: '#ede9fe' },
  { label: '粉色', value: '#fce7f3' },
];

const GRIP_MENU_OFFSET = 26;
const EDGE_PLUS_ICON_SIZE = 14;
const GRIP_ICON_SIZE = 13;

const ToolbarButton = ({ onClick, disabled, active, icon, title }: any) => (
  <button
    type="button"
    className={`rt-icon-btn ${active ? 'active' : ''}`}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    contentEditable={false}
  >
    {icon}
  </button>
);

type OverlayActions = {
  setIsToolbarHovered: (value: boolean) => void;
  setIsEdgeHandleHovered: (value: boolean) => void;
  setIsToolbarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenColorMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenRowMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenColMenu: React.Dispatch<React.SetStateAction<boolean>>;
};

type RichTableOverlayProps = {
  actions: OverlayActions;
  commandApi: any;
  overlayModel: RichTableOverlayModel;
  floatingControlsPortalRef: React.RefObject<HTMLDivElement>;
  toolbarPortalRef: React.RefObject<HTMLDivElement>;
  toolbarRef: React.RefObject<HTMLDivElement>;
};

const normalizeColorValue = (value: any) => (value ? String(value).trim().toLowerCase() : null);

export const RichTableOverlay = ({
  actions,
  commandApi,
  overlayModel,
  floatingControlsPortalRef,
  toolbarPortalRef,
  toolbarRef,
}: RichTableOverlayProps) => {
  const host = getRichTableOverlayHost();
  if (!host) return null;

  const activeTextColor = overlayModel.activeTextColor;
  const activeCellBackground = overlayModel.activeCellBackground;

  const toolbarPortal = createPortal(
    <div
      ref={toolbarPortalRef}
      className="rt-top-toolbar-portal"
      style={{
        top: `${overlayModel.toolbarViewportPosition?.top ?? 0}px`,
        left: `${overlayModel.toolbarViewportPosition?.left ?? 0}px`,
        visibility: overlayModel.toolbarViewportPosition ? 'visible' : 'hidden',
      }}
      contentEditable={false}
    >
      <div
        ref={toolbarRef}
        className={`rt-top-toolbar ${overlayModel.showToolbar ? 'is-visible' : 'is-hidden'}`}
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => actions.setIsToolbarHovered(true)}
        onMouseLeave={() => actions.setIsToolbarHovered(false)}
      >
        <ToolbarButton
          title={overlayModel.isToolbarExpanded ? '收起工具栏' : '展开工具栏'}
          icon={overlayModel.isToolbarExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          onClick={() => actions.setIsToolbarExpanded((value) => !value)}
        />
        {overlayModel.isToolbarExpanded ? (
          <>
            <span className="rt-divider" />
            <ToolbarButton title="左对齐" icon={<AlignLeft size={14} />} onClick={() => commandApi.applyCellAlign('left')} />
            <ToolbarButton title="居中" icon={<AlignCenter size={14} />} onClick={() => commandApi.applyCellAlign('center')} />
            <ToolbarButton title="右对齐" icon={<AlignRight size={14} />} onClick={() => commandApi.applyCellAlign('right')} />
            <span className="rt-divider" />
          </>
        ) : null}
        <div className="rt-color-wrap" contentEditable={false}>
          <ToolbarButton
            title="颜色"
            icon={<Palette size={14} />}
            active={overlayModel.openColorMenu}
            onClick={() => {
              actions.setOpenColorMenu((value) => !value);
              actions.setOpenRowMenu(false);
              actions.setOpenColMenu(false);
            }}
          />
          {overlayModel.openColorMenu ? (
            <div className="rt-color-menu" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
              <div className="rt-color-section-title">文本</div>
              {COLOR_OPTIONS.map((item) => (
                <button
                  key={`txt-${item.label}`}
                  type="button"
                  className="rt-color-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commandApi.applyTextColor(item.value)}
                >
                  <span className="rt-color-swatch" style={{ color: item.value || '#111827' }}>A</span>
                  <span>{item.label}</span>
                  {normalizeColorValue(item.value) === activeTextColor ? <Check size={12} /> : null}
                </button>
              ))}
              <div className="rt-color-section-title">背景色</div>
              {BG_OPTIONS.map((item) => (
                <button
                  key={`bg-${item.label}`}
                  type="button"
                  className="rt-color-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commandApi.applyCellBackground(item.value)}
                >
                  <span className="rt-color-swatch bg" style={{ backgroundColor: item.value || 'transparent' }}>A</span>
                  <span>{item.label}</span>
                  {normalizeColorValue(item.value) === activeCellBackground ? <Check size={12} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <ToolbarButton title="合并单元格" icon={<span className="rt-mini-text">合</span>} onClick={() => commandApi.runTableAction(() => commandApi.chainTableFocus()?.mergeCells().run() ?? false, '请先选择多个相邻单元格再合并')} />
        <ToolbarButton title="拆分单元格" icon={<span className="rt-mini-text">拆</span>} onClick={() => commandApi.runTableAction(() => commandApi.chainTableFocus()?.splitCell().run() ?? false, '当前单元格不可拆分')} />
        <ToolbarButton title="调整相同宽度" icon={<Columns2 size={14} />} onClick={commandApi.equalizeTableColumnWidths} />
        {overlayModel.showToolbar ? (
          <>
            <span className="rt-divider" />
            <ToolbarButton title="表头行" icon={<span className="rt-mini-text">行头</span>} onClick={() => commandApi.runTableAction(() => commandApi.chainTableFocus()?.toggleHeaderRow().run() ?? false, '请先定位到单元格')} />
            <ToolbarButton title="表头列" icon={<span className="rt-mini-text">列头</span>} onClick={() => commandApi.runTableAction(() => commandApi.chainTableFocus()?.toggleHeaderColumn().run() ?? false, '请先定位到单元格')} />
          </>
        ) : null}
      </div>
    </div>,
    host
  );

  const floatingControlsPortal = createPortal(
    <div ref={floatingControlsPortalRef} className="rt-floating-controls-portal" contentEditable={false}>
      {overlayModel.addColVisible && overlayModel.clampedColEdgeHandlePosition ? (
        <button
          type="button"
          className="rt-add-col-handle"
          style={{
            top: `${overlayModel.clampedColEdgeHandlePosition.top}px`,
            left: `${overlayModel.clampedColEdgeHandlePosition.left}px`,
            height: `${overlayModel.clampedColEdgeHandlePosition.height}px`,
          }}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => actions.setIsEdgeHandleHovered(true)}
          onMouseLeave={() => actions.setIsEdgeHandleHovered(false)}
          onClick={() => commandApi.runAddTableAction(() => commandApi.runEdgeAppendAction('col'), '添加列失败，请重试')}
          title="新增列"
        >
          <Plus size={EDGE_PLUS_ICON_SIZE} />
        </button>
      ) : null}
      {overlayModel.addRowVisible && overlayModel.clampedRowEdge ? (
        <button
          type="button"
          className="rt-add-row-handle"
          style={{
            top: `${overlayModel.clampedRowEdge.top}px`,
            left: `${overlayModel.clampedRowEdge.left}px`,
            width: `${overlayModel.clampedRowEdge.width}px`,
          }}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => actions.setIsEdgeHandleHovered(true)}
          onMouseLeave={() => actions.setIsEdgeHandleHovered(false)}
          onClick={() => commandApi.runAddTableAction(() => commandApi.runEdgeAppendAction('row'), '添加行失败，请重试')}
          title="新增行"
        >
          <Plus size={EDGE_PLUS_ICON_SIZE} />
        </button>
      ) : null}
      {overlayModel.shouldShowTableGrips && overlayModel.rowGripPos ? (
        <button
          type="button"
          className="rt-table-grip row"
          style={{ top: `${overlayModel.rowGripPos.top}px`, left: `${overlayModel.rowGripPos.left}px` }}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => actions.setIsEdgeHandleHovered(true)}
          onMouseLeave={() => actions.setIsEdgeHandleHovered(false)}
          onClick={() => {
            const selected = commandApi.selectAxisFromHandle('row');
            if (!selected) return;
            actions.setOpenRowMenu((value) => !value);
            actions.setOpenColMenu(false);
            actions.setOpenColorMenu(false);
          }}
          title="行操作"
        >
          <EllipsisVertical size={GRIP_ICON_SIZE} />
        </button>
      ) : null}
      {overlayModel.shouldShowTableGrips && overlayModel.colGripPos ? (
        <button
          type="button"
          className="rt-table-grip col"
          style={{ top: `${overlayModel.colGripPos.top}px`, left: `${overlayModel.colGripPos.left}px` }}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => actions.setIsEdgeHandleHovered(true)}
          onMouseLeave={() => actions.setIsEdgeHandleHovered(false)}
          onClick={() => {
            const selected = commandApi.selectAxisFromHandle('col');
            if (!selected) return;
            actions.setOpenColMenu((value) => !value);
            actions.setOpenRowMenu(false);
            actions.setOpenColorMenu(false);
          }}
          title="列操作"
        >
          <Ellipsis size={GRIP_ICON_SIZE} />
        </button>
      ) : null}
      {overlayModel.openRowMenu ? (
        <div
          className="rt-handle-menu"
          style={{
            top: overlayModel.rowGripPos ? `${overlayModel.rowGripPos.top}px` : undefined,
            left: overlayModel.rowGripPos ? `${overlayModel.rowGripPos.left + GRIP_MENU_OFFSET}px` : undefined,
            transform: 'translateY(-50%)',
          }}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => commandApi.runAddTableAction(() => commandApi.chainTableFocus()?.addRowBefore().run() ?? false, '请先定位到单元格')}>上方添加行</button>
          <button type="button" onClick={() => commandApi.runAddTableAction(() => commandApi.chainTableFocus()?.addRowAfter().run() ?? false, '请先定位到单元格')}>下方添加行</button>
          <button type="button" className="danger" onClick={() => commandApi.runTableAction(() => commandApi.chainTableFocus()?.deleteRow().run() ?? false, '请先定位到单元格')}>删除行</button>
        </div>
      ) : null}
      {overlayModel.openColMenu ? (
        <div
          className="rt-handle-menu"
          style={{
            top: overlayModel.colGripPos ? `${overlayModel.colGripPos.top + GRIP_MENU_OFFSET}px` : undefined,
            left: overlayModel.colGripPos ? `${overlayModel.colGripPos.left}px` : undefined,
            transform: 'translateX(-50%)',
          }}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => commandApi.runAddTableAction(() => commandApi.chainTableFocus()?.addColumnBefore().run() ?? false, '请先定位到单元格')}>左侧添加列</button>
          <button type="button" onClick={() => commandApi.runAddTableAction(() => commandApi.chainTableFocus()?.addColumnAfter().run() ?? false, '请先定位到单元格')}>右侧添加列</button>
          <button type="button" className="danger" onClick={() => commandApi.runTableAction(() => commandApi.chainTableFocus()?.deleteColumn().run() ?? false, '请先定位到单元格')}>删除列</button>
        </div>
      ) : null}
    </div>,
    host
  );

  return (
    <>
      {toolbarPortal}
      {floatingControlsPortal}
    </>
  );
};
