import { describe, expect, test } from 'vitest';
import {
  getRichTableToolbarViewportPosition,
  getRichTableGripViewportPosition,
  getRichTableEdgeHandleViewportPosition,
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
