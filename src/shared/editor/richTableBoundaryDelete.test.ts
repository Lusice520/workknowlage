import { describe, expect, test, vi } from 'vitest';
import { handleRichTableAdjacentDeletionWithoutScroll } from './richTableBoundaryDelete';

describe('handleRichTableAdjacentDeletionWithoutScroll', () => {
  test('deletes an empty paragraph after a RichTable without calling scrollIntoView', () => {
    const selection = { eq: vi.fn().mockReturnValue(false) };
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn(),
    };
    const dispatch = vi.fn();

    const handled = handleRichTableAdjacentDeletionWithoutScroll({
      key: 'Backspace',
      state: {
        doc: { kind: 'doc' },
        tr: transaction,
      } as any,
      dispatch,
      getBlockInfoFromSelectionFn: () => ({
        isBlockContainer: true,
        bnBlock: { beforePos: 20, afterPos: 30 },
        blockContent: {
          node: {
            childCount: 0,
            type: {
              spec: { content: 'inline*' },
            },
          },
        },
      }),
      getPrevBlockInfoFn: () => ({
        isBlockContainer: true,
        blockContent: {
          beforePos: 12,
          node: {
            type: {
              name: 'richTable',
              spec: { content: '' },
            },
          },
        },
      }),
      createNodeSelectionFn: vi.fn().mockReturnValue(selection),
    });

    expect(handled).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledWith(selection);
    expect(transaction.deleteRange).toHaveBeenCalledWith(20, 30);
    expect(transaction.scrollIntoView).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  test('deletes an empty paragraph before a RichTable without calling scrollIntoView', () => {
    const selection = { eq: vi.fn().mockReturnValue(false) };
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn(),
    };
    const dispatch = vi.fn();

    const handled = handleRichTableAdjacentDeletionWithoutScroll({
      key: 'Delete',
      state: {
        doc: { kind: 'doc' },
        tr: transaction,
      } as any,
      dispatch,
      getBlockInfoFromSelectionFn: () => ({
        isBlockContainer: true,
        bnBlock: { beforePos: 40, afterPos: 50 },
        blockContent: {
          node: {
            childCount: 0,
            type: {
              spec: { content: 'inline*' },
            },
          },
        },
      }),
      getNextBlockInfoFn: () => ({
        isBlockContainer: true,
        blockContent: {
          beforePos: 60,
          node: {
            type: {
              name: 'richTable',
              spec: { content: '' },
            },
          },
        },
      }),
      createNodeSelectionFn: vi.fn().mockReturnValue(selection),
    });

    expect(handled).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledWith(selection);
    expect(transaction.deleteRange).toHaveBeenCalledWith(40, 50);
    expect(transaction.scrollIntoView).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  test('skips when the adjacent block is not a RichTable', () => {
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn(),
    };
    const dispatch = vi.fn();

    const handled = handleRichTableAdjacentDeletionWithoutScroll({
      key: 'Backspace',
      state: {
        doc: { kind: 'doc' },
        tr: transaction,
      } as any,
      dispatch,
      getBlockInfoFromSelectionFn: () => ({
        isBlockContainer: true,
        bnBlock: { beforePos: 20, afterPos: 30 },
        blockContent: {
          node: {
            childCount: 0,
            type: {
              spec: { content: 'inline*' },
            },
          },
        },
      }),
      getPrevBlockInfoFn: () => ({
        isBlockContainer: true,
        blockContent: {
          beforePos: 12,
          node: {
            type: {
              name: 'paragraph',
              spec: { content: 'inline*' },
            },
          },
        },
      }),
      createNodeSelectionFn: vi.fn(),
    });

    expect(handled).toBe(false);
    expect(transaction.setSelection).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('deletes a selected divider before a RichTable without calling scrollIntoView', () => {
    const selection = { eq: vi.fn().mockReturnValue(false) };
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn(),
    };
    const dispatch = vi.fn();

    const handled = handleRichTableAdjacentDeletionWithoutScroll({
      key: 'Delete',
      state: {
        doc: { kind: 'doc' },
        tr: transaction,
        selection: { node: { type: { name: 'divider' } } },
      } as any,
      dispatch,
      getBlockInfoFromSelectionFn: () => ({
        isBlockContainer: true,
        bnBlock: { beforePos: 90, afterPos: 96 },
        blockContent: {
          beforePos: 91,
          node: {
            childCount: 0,
            type: {
              name: 'divider',
              spec: { content: '' },
            },
          },
        },
      }),
      getNextBlockInfoFn: () => ({
        isBlockContainer: true,
        blockContent: {
          beforePos: 100,
          node: {
            type: {
              name: 'richTable',
              spec: { content: '' },
            },
          },
        },
      }),
      createNodeSelectionFn: vi.fn().mockReturnValue(selection),
    });

    expect(handled).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledWith(selection);
    expect(transaction.deleteRange).toHaveBeenCalledWith(90, 96);
    expect(transaction.scrollIntoView).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  test('deletes a selected divider before a RichTable on Backspace without calling scrollIntoView', () => {
    const selection = { eq: vi.fn().mockReturnValue(false) };
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
      deleteRange: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn(),
    };
    const dispatch = vi.fn();

    const handled = handleRichTableAdjacentDeletionWithoutScroll({
      key: 'Backspace',
      state: {
        doc: { kind: 'doc' },
        tr: transaction,
        selection: { node: { type: { name: 'divider' } } },
      } as any,
      dispatch,
      getBlockInfoFromSelectionFn: () => ({
        isBlockContainer: true,
        bnBlock: { beforePos: 120, afterPos: 126 },
        blockContent: {
          beforePos: 121,
          node: {
            childCount: 0,
            type: {
              name: 'divider',
              spec: { content: '' },
            },
          },
        },
      }),
      getPrevBlockInfoFn: () => ({
        isBlockContainer: true,
        blockContent: {
          beforePos: 110,
          node: {
            type: {
              name: 'paragraph',
              spec: { content: 'inline*' },
            },
          },
        },
      }),
      getNextBlockInfoFn: () => ({
        isBlockContainer: true,
        blockContent: {
          beforePos: 130,
          node: {
            type: {
              name: 'richTable',
              spec: { content: '' },
            },
          },
        },
      }),
      createNodeSelectionFn: vi.fn().mockReturnValue(selection),
    });

    expect(handled).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledWith(selection);
    expect(transaction.deleteRange).toHaveBeenCalledWith(120, 126);
    expect(transaction.scrollIntoView).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });
});
