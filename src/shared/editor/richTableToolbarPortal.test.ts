import { describe, expect, test } from 'vitest';
import {
  getRichTableToolbarViewportPosition,
  getRichTableGripViewportPosition,
  getRichTableEdgeHandleViewportPosition,
  clampRichTableEdgeHandleViewportPosition,
  clampRichTableGripViewportPosition,
  intersectRichTableClipRects,
} from './richTableToolbarPortal';

describe('getRichTableToolbarViewportPosition', () => {
  test('clamps the toolbar to the top viewport padding when the table is near the top edge', () => {
    expect(
      getRichTableToolbarViewportPosition({
        tableRect: {
          top: 18,
          left: 96,
          width: 520,
        },
        toolbarRect: {
          width: 180,
          height: 40,
        },
        viewportRect: {
          width: 1280,
          height: 720,
        },
      })
    ).toEqual({
      top: 12,
      left: 266,
    });
  });

  test('keeps the original above-table position when the toolbar still fits in the strip above the editor clip', () => {
    expect(
      getRichTableToolbarViewportPosition({
        clipRect: {
          top: 128,
          left: 80,
          right: 720,
          bottom: 640,
        },
        tableRect: {
          top: 152,
          left: 96,
          width: 520,
        },
        toolbarRect: {
          width: 180,
          height: 40,
        },
        viewportRect: {
          width: 1280,
          height: 720,
        },
      })
    ).toEqual({
      top: 104,
      left: 266,
    });
  });

  test('clamps the toolbar into the strip above the editor clip only after the table is scrolled too close to the top', () => {
    expect(
      getRichTableToolbarViewportPosition({
        clipRect: {
          top: 128,
          left: 80,
          right: 720,
          bottom: 640,
        },
        tableRect: {
          top: 118,
          left: 96,
          width: 520,
        },
        toolbarRect: {
          width: 180,
          height: 40,
        },
        viewportRect: {
          width: 1280,
          height: 720,
        },
      })
    ).toEqual({
      top: 80,
      left: 266,
    });
  });

  test('clamps the toolbar inside the right viewport edge', () => {
    expect(
      getRichTableToolbarViewportPosition({
        tableRect: {
          top: 180,
          left: 1180,
          width: 260,
        },
        toolbarRect: {
          width: 220,
          height: 44,
        },
        viewportRect: {
          width: 1366,
          height: 768,
        },
      })
    ).toEqual({
      top: 128,
      left: 1134,
    });
  });
});

describe('getRichTableGripViewportPosition', () => {
  test('keeps the left row grip inside the viewport when the table starts at the content edge', () => {
    expect(
      getRichTableGripViewportPosition({
        axis: 'row',
        anchorRect: {
          left: 6,
          top: 220,
          width: 540,
          height: 46,
        },
        viewportRect: {
          width: 1440,
          height: 900,
        },
      })
    ).toEqual({
      left: 12,
      top: 243,
    });
  });
});

describe('getRichTableEdgeHandleViewportPosition', () => {
  test('keeps edge add handles slightly offset from the table while preserving a bridgeable click gap', () => {
    const tableRect = {
      top: 208,
      left: 390,
      width: 740,
      height: 246,
    };

    const rowHandle = getRichTableEdgeHandleViewportPosition({
      axis: 'row',
      tableRect,
    });
    const colHandle = getRichTableEdgeHandleViewportPosition({
      axis: 'col',
      tableRect,
    });

    expect(rowHandle).toEqual({
      top: 467,
      left: 760,
      width: 740,
    });
    expect(colHandle).toEqual({
      top: 331,
      left: 1143,
      height: 246,
    });
  });
});

describe('clampRichTableEdgeHandleViewportPosition', () => {
  test('pins the add-column handle to the visible right edge when the table is horizontally overflowing', () => {
    expect(
      clampRichTableEdgeHandleViewportPosition({
        axis: 'col',
        edgePadding: 9,
        handleRect: {
          top: 331,
          left: 962,
          height: 246,
        },
        clipRect: {
          top: 120,
          left: 80,
          right: 1080,
          bottom: 780,
        },
        stickToVisibleRightEdge: true,
      })
    ).toEqual({
      top: 331,
      left: 1062,
      height: 246,
    });
  });

  test('keeps the add-column handle visible with an inset from the editor right edge when the table grows past the viewport', () => {
    expect(
      clampRichTableEdgeHandleViewportPosition({
        axis: 'col',
        edgePadding: 9,
        handleRect: {
          top: 331,
          left: 1143,
          height: 246,
        },
        clipRect: {
          top: 120,
          left: 80,
          right: 1080,
          bottom: 780,
        },
      })
    ).toEqual({
      top: 331,
      left: 1062,
      height: 246,
    });
  });

  test('clips the add-column handle height to the visible editor bounds when the table is taller than the viewport', () => {
    expect(
      clampRichTableEdgeHandleViewportPosition({
        axis: 'col',
        edgePadding: 9,
        handleRect: {
          top: 331,
          left: 1143,
          height: 520,
        },
        clipRect: {
          top: 180,
          left: 80,
          right: 1080,
          bottom: 540,
        },
      })
    ).toEqual({
      top: 360,
      left: 1062,
      height: 342,
    });
  });
});

describe('clampRichTableGripViewportPosition', () => {
  test('keeps the column grip above the table when it still fits in the strip above the editor clip', () => {
    expect(
      clampRichTableGripViewportPosition({
        axis: 'col',
        clipRect: {
          top: 100,
          left: 80,
          right: 720,
          bottom: 420,
        },
        gripRect: {
          top: 91,
          left: 240,
        },
      })
    ).toEqual({
      top: 91,
      left: 240,
    });
  });

  test('clamps the row and column grips into the editor edge strips only after scroll pushes them past the clip', () => {
    expect(
      clampRichTableGripViewportPosition({
        axis: 'col',
        clipRect: {
          top: 100,
          left: 80,
          right: 720,
          bottom: 420,
        },
        gripRect: {
          top: 71,
          left: 60,
        },
      })
    ).toEqual({
      top: 91,
      left: 100,
    });

    expect(
      clampRichTableGripViewportPosition({
        axis: 'row',
        clipRect: {
          top: 100,
          left: 80,
          right: 720,
          bottom: 420,
        },
        gripRect: {
          top: 92,
          left: 55,
        },
      })
    ).toEqual({
      top: 120,
      left: 71,
    });
  });
});

describe('intersectRichTableClipRects', () => {
  test('intersects the table shell, editor surface, and viewport into the visible clip rect', () => {
    expect(
      intersectRichTableClipRects([
        {
          top: 140,
          left: 120,
          right: 1080,
          bottom: 980,
        },
        {
          top: 212,
          left: 96,
          right: 1048,
          bottom: 612,
        },
        {
          top: 0,
          left: 0,
          right: 1440,
          bottom: 900,
        },
      ])
    ).toEqual({
      top: 212,
      left: 120,
      right: 1048,
      bottom: 612,
    });
  });
});
