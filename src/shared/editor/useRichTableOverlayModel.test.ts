import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useRichTableOverlayModel } from './useRichTableOverlayModel';

const defineRect = (element: HTMLElement, rect: Partial<DOMRectReadOnly>) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: rect.bottom ?? 0,
      height: rect.height ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
      top: rect.top ?? 0,
      width: rect.width ?? 0,
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      toJSON: () => rect,
    }),
  });
};

const defineScrollableWidth = (element: HTMLElement, dimensions: { clientWidth: number; scrollWidth: number }) => {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: dimensions.clientWidth,
  });
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    value: dimensions.scrollWidth,
  });
};

describe('useRichTableOverlayModel', () => {
  test('returns the geometry and visibility snapshot used by RichTable overlays', () => {
    const container = document.createElement('div');
    const scrollShell = document.createElement('div');
    scrollShell.className = 'rt-scroll-shell';
    defineScrollableWidth(scrollShell, { clientWidth: 640, scrollWidth: 640 });
    container.appendChild(scrollShell);

    const toolbar = document.createElement('div');
    defineRect(scrollShell, { top: 100, left: 80, right: 720, bottom: 420, width: 640, height: 320 });
    const editorSurface = document.createElement('div');
    editorSurface.className = 'shared-blocknote-surface';
    defineRect(editorSurface, { top: 100, left: 80, right: 720, bottom: 420, width: 640, height: 320 });
    container.appendChild(editorSurface);
    editorSurface.appendChild(scrollShell);
    defineRect(toolbar, { top: 0, left: 0, width: 180, height: 40 });

    const containerRef = { current: container };
    const toolbarRef = { current: toolbar };

    const { result } = renderHook(() =>
      useRichTableOverlayModel({
        containerRef,
        toolbarRef,
        showUi: true,
        activeCellBackground: null,
        activeTextColor: null,
        hasActiveSelection: true,
        hasCollapsedCellCursor: false,
        isEditable: true,
        isFocused: true,
        isTableActive: true,
        isTableHovered: true,
        isToolbarHovered: false,
        isEdgeHandleHovered: false,
        isColActionLaneHovered: false,
        isRowActionLaneHovered: false,
        openColorMenu: false,
        openRowMenu: false,
        openColMenu: false,
        colTopAddButtonPos: { top: 88, left: 400 },
        rowGripPos: { top: 240, left: 71 },
        colGripPos: { top: 91, left: 240 },
        tableFrame: { top: 100, left: 80, right: 720, bottom: 420, width: 640, height: 320 },
        tableViewportFrame: { top: 100, left: 80, right: 720, bottom: 420, width: 640, height: 320 },
        isToolbarExpanded: false,
      })
    );

    expect(result.current.editorClip).toEqual(expect.objectContaining({
      top: 100,
      left: 80,
      right: 720,
      bottom: 420,
    }));
    expect(result.current.toolbarViewportPosition).toEqual({
      top: 52,
      left: 310,
    });
    expect(result.current.clampedRowEdge).toEqual(expect.objectContaining({
      top: 433,
      left: 400,
      width: 640,
    }));
    expect(result.current.rowGripPos).toEqual({
      top: 240,
      left: 71,
    });
    expect(result.current.colGripPos).toEqual({
      top: 91,
      left: 240,
    });
    expect(result.current.colTopAddButtonPos).toEqual({
      top: 89,
      left: 400,
    });
    expect(result.current.clampedColEdgeHandlePosition).toEqual(expect.objectContaining({
      top: 260,
      left: 699,
      height: 296,
    }));
    expect(result.current.showToolbar).toBe(true);
    expect(result.current.shouldShowTableGrips).toBe(true);
    expect(result.current.shouldShowEdgeHandles).toBe(true);
    expect(result.current.addRowVisible).toBe(true);
    expect(result.current.addColVisible).toBe(true);
  });

  test('pins the add-column handle to the visible right edge when the table overflows horizontally', () => {
    const container = document.createElement('div');
    const scrollShell = document.createElement('div');
    scrollShell.className = 'rt-scroll-shell';
    defineScrollableWidth(scrollShell, { clientWidth: 640, scrollWidth: 960 });
    container.appendChild(scrollShell);

    const toolbar = document.createElement('div');
    defineRect(scrollShell, { top: 100, left: 80, right: 720, bottom: 420, width: 640, height: 320 });
    const editorSurface = document.createElement('div');
    editorSurface.className = 'shared-blocknote-surface';
    defineRect(editorSurface, { top: 100, left: 80, right: 720, bottom: 420, width: 640, height: 320 });
    container.appendChild(editorSurface);
    editorSurface.appendChild(scrollShell);
    defineRect(toolbar, { top: 0, left: 0, width: 180, height: 40 });

    const containerRef = { current: container };
    const toolbarRef = { current: toolbar };

    const { result } = renderHook(() =>
      useRichTableOverlayModel({
        containerRef,
        toolbarRef,
        showUi: true,
        activeCellBackground: null,
        activeTextColor: null,
        hasActiveSelection: true,
        hasCollapsedCellCursor: false,
        isEditable: true,
        isFocused: true,
        isTableActive: true,
        isTableHovered: true,
        isToolbarHovered: false,
        isEdgeHandleHovered: false,
        isColActionLaneHovered: false,
        isRowActionLaneHovered: false,
        openColorMenu: false,
        openRowMenu: false,
        openColMenu: false,
        colTopAddButtonPos: { top: 88, left: 640 },
        rowGripPos: { top: 240, left: 71 },
        colGripPos: { top: 91, left: 240 },
        tableFrame: { top: 100, left: 0, right: 640, bottom: 420, width: 640, height: 320 },
        tableViewportFrame: { top: 100, left: 0, right: 640, bottom: 420, width: 640, height: 320 },
        isToolbarExpanded: false,
      })
    );

    expect(result.current.clampedColEdgeHandlePosition).toEqual(expect.objectContaining({
      left: 699,
      top: 260,
      height: 296,
    }));
    expect(result.current.colGripPos).toEqual({
      top: 91,
      left: 240,
    });
    expect(result.current.colTopAddButtonPos).toEqual({
      top: 89,
      left: 640,
    });
  });
});
