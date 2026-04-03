import { describe, expect, test, vi } from 'vitest';
import { applyRichTableSelectionWithoutScroll } from './RichTable';

describe('applyRichTableSelectionWithoutScroll', () => {
  test('dispatches a selection change without calling scrollIntoView', () => {
    const selection = {
      eq: vi.fn().mockReturnValue(false),
    };
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn(),
    };
    const dispatch = vi.fn();

    const handled = applyRichTableSelectionWithoutScroll(
      { selection: { kind: 'current' }, tr: transaction } as any,
      dispatch,
      selection as any,
    );

    expect(handled).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledWith(selection);
    expect(transaction.scrollIntoView).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(transaction);
  });

  test('skips dispatch when the target selection already matches the current one', () => {
    const selection = {
      eq: vi.fn().mockReturnValue(true),
    };
    const dispatch = vi.fn();

    const handled = applyRichTableSelectionWithoutScroll(
      { selection: { kind: 'current' }, tr: { setSelection: vi.fn() } } as any,
      dispatch,
      selection as any,
    );

    expect(handled).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
