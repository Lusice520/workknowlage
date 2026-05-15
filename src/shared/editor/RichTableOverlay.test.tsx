import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RichTableOverlay } from './RichTableOverlay';

test('moves the RichTable portal JSX into RichTableOverlay while RichTable becomes composition-only', () => {
  const overlayPath = path.resolve(__dirname, 'RichTableOverlay.tsx');
  const richTablePath = path.resolve(__dirname, 'RichTable.tsx');
  const overlaySource = fs.readFileSync(overlayPath, 'utf8');
  const richTableSource = fs.readFileSync(richTablePath, 'utf8');

  expect(overlaySource).toContain('createPortal(');
  expect(overlaySource).toContain('getRichTableOverlayHost');
  expect(overlaySource).toContain('rt-floating-controls-portal');
  expect(overlaySource).toContain('rt-top-toolbar-portal');
  expect(richTableSource).toContain('<RichTableOverlay');
  expect(richTableSource).not.toContain('createPortal(');
  expect(richTableSource).not.toContain('document.body');
});

describe('RichTableOverlay', () => {
  test('keeps collapsed toolbar content minimal', () => {
    const commandApi = {
      applyCellAlign: vi.fn(),
      applyCellBackground: vi.fn(),
      applyTextColor: vi.fn(),
      chainTableFocus: vi.fn(),
      equalizeTableColumnWidths: vi.fn(),
      isInlineCodeActive: false,
      runAddTableAction: vi.fn(),
      runEdgeAppendAction: vi.fn(),
      runTableAction: vi.fn(),
      selectAxisFromHandle: vi.fn(),
      toggleInlineCode: vi.fn(),
    };
    const actions = {
      setIsToolbarHovered: vi.fn(),
      setIsEdgeHandleHovered: vi.fn(),
      setIsToolbarExpanded: vi.fn(),
      setOpenColorMenu: vi.fn(),
      setOpenRowMenu: vi.fn(),
      setOpenColMenu: vi.fn(),
    };
    const overlayModel = {
      addColVisible: false,
      addRowVisible: false,
      activeCellBackground: null,
      activeTextColor: null,
      clampedColEdgeHandlePosition: null,
      clampedRowEdge: null,
      colGripPos: null,
      editorClip: null,
      isToolbarExpanded: false,
      openColMenu: false,
      openColorMenu: false,
      openRowMenu: false,
      rowGripPos: null,
      shouldShowEdgeHandles: false,
      shouldShowTableGrips: false,
      showToolbar: true,
      showUi: true,
      tableFrame: null,
      tableViewportFrame: null,
      toolbarViewportPosition: { top: 24, left: 36 },
    };

    render(
      <RichTableOverlay
        actions={actions}
        commandApi={commandApi}
        overlayModel={overlayModel as any}
        floatingControlsPortalRef={{ current: null }}
        toolbarPortalRef={{ current: null }}
        toolbarRef={{ current: null }}
      />
    );

    expect(screen.getByTitle('展开工具栏')).toBeInTheDocument();
    expect(screen.getByTitle('颜色')).toBeInTheDocument();
    expect(screen.getByTitle('合并单元格')).toBeInTheDocument();
    expect(screen.getByTitle('拆分单元格')).toBeInTheDocument();
    expect(screen.getByTitle('调整相同宽度')).toBeInTheDocument();
    expect(screen.queryByTitle('左对齐')).not.toBeInTheDocument();
    expect(screen.queryByTitle('表头行')).not.toBeInTheDocument();
    expect(screen.queryByTitle('表头列')).not.toBeInTheDocument();
  });

  test('renders a dedicated current-column add button above the first row and removes the duplicate right-add menu action', () => {
    const commandApi = {
      applyCellAlign: vi.fn(),
      applyCellBackground: vi.fn(),
      applyTextColor: vi.fn(),
      chainTableFocus: vi.fn(() => ({
        addColumnBefore: vi.fn(() => ({ run: vi.fn(() => true) })),
        deleteColumn: vi.fn(() => ({ run: vi.fn(() => true) })),
      })),
      equalizeTableColumnWidths: vi.fn(),
      isInlineCodeActive: false,
      runAddTableAction: vi.fn(),
      runEdgeAppendAction: vi.fn(),
      runTableAction: vi.fn(),
      selectAxisFromHandle: vi.fn(),
      toggleInlineCode: vi.fn(),
    };
    const actions = {
      setIsToolbarHovered: vi.fn(),
      setIsEdgeHandleHovered: vi.fn(),
      setIsToolbarExpanded: vi.fn(),
      setOpenColorMenu: vi.fn(),
      setOpenRowMenu: vi.fn(),
      setOpenColMenu: vi.fn(),
    };
    const overlayModel = {
      addColVisible: false,
      addRowVisible: false,
      activeCellBackground: null,
      activeTextColor: null,
      clampedColEdgeHandlePosition: null,
      clampedRowEdge: null,
      colGripPos: { top: 91, left: 240 },
      colTopAddButtonPos: { top: 89, left: 400 },
      editorClip: null,
      isToolbarExpanded: false,
      openColMenu: true,
      openColorMenu: false,
      openRowMenu: false,
      rowGripPos: null,
      shouldShowEdgeHandles: false,
      shouldShowTableGrips: true,
      showToolbar: false,
      showUi: true,
      tableFrame: null,
      tableViewportFrame: null,
      toolbarViewportPosition: null,
    };

    render(
      <RichTableOverlay
        actions={actions}
        commandApi={commandApi}
        overlayModel={overlayModel as any}
        floatingControlsPortalRef={{ current: null }}
        toolbarPortalRef={{ current: null }}
        toolbarRef={{ current: null }}
      />
    );

    expect(screen.getByTitle('当前列右侧添加列')).toBeInTheDocument();
    expect(screen.getByText('左侧添加列')).toBeInTheDocument();
    expect(screen.queryByText('右侧添加列')).not.toBeInTheDocument();
    expect(screen.getByText('删除列')).toBeInTheDocument();
  });

  test('shows the current-column add button only under the same visibility contract as column grips', () => {
    const commandApi = {
      applyCellAlign: vi.fn(),
      applyCellBackground: vi.fn(),
      applyTextColor: vi.fn(),
      chainTableFocus: vi.fn(() => ({
        addColumnAfter: vi.fn(() => ({ run: vi.fn(() => true) })),
      })),
      equalizeTableColumnWidths: vi.fn(),
      isInlineCodeActive: false,
      runAddTableAction: vi.fn(),
      runEdgeAppendAction: vi.fn(),
      runTableAction: vi.fn(),
      selectAxisFromHandle: vi.fn(),
      toggleInlineCode: vi.fn(),
    };
    const actions = {
      setIsToolbarHovered: vi.fn(),
      setIsEdgeHandleHovered: vi.fn(),
      setIsToolbarExpanded: vi.fn(),
      setOpenColorMenu: vi.fn(),
      setOpenRowMenu: vi.fn(),
      setOpenColMenu: vi.fn(),
    };
    const overlayModel = {
      addColVisible: false,
      addRowVisible: false,
      activeCellBackground: null,
      activeTextColor: null,
      clampedColEdgeHandlePosition: null,
      clampedRowEdge: null,
      colGripPos: null,
      colTopAddButtonPos: { top: 89, left: 400 },
      editorClip: null,
      isToolbarExpanded: false,
      openColMenu: false,
      openColorMenu: false,
      openRowMenu: false,
      rowGripPos: null,
      shouldShowEdgeHandles: false,
      shouldShowTableGrips: false,
      showToolbar: false,
      showUi: true,
      tableFrame: null,
      tableViewportFrame: null,
      toolbarViewportPosition: null,
    };

    render(
      <RichTableOverlay
        actions={actions}
        commandApi={commandApi}
        overlayModel={overlayModel as any}
        floatingControlsPortalRef={{ current: null }}
        toolbarPortalRef={{ current: null }}
        toolbarRef={{ current: null }}
      />
    );

    expect(screen.queryByTitle('当前列右侧添加列')).not.toBeInTheDocument();
  });
});
