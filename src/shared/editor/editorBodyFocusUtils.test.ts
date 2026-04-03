import { describe, expect, test, vi } from 'vitest';
import { getDomActiveSelectionRect } from './editorBodyFocusUtils';

describe('getDomActiveSelectionRect', () => {
  test('prefers the collapsed focus caret rect over the broader selection rect', () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    const textNode = document.createTextNode('long paragraph');
    paragraph.appendChild(textNode);
    root.appendChild(paragraph);
    document.body.appendChild(root);

    const selectionRect = new DOMRect(12, 40, 240, 120);
    const caretRect = new DOMRect(68, 136, 1, 18);

    const collapsedRange = {
      setStart: vi.fn(),
      collapse: vi.fn(),
      getClientRects: () => [caretRect],
      getBoundingClientRect: () => caretRect,
    } as unknown as Range;

    const activeRange = {
      cloneRange: () => collapsedRange,
      getClientRects: () => [selectionRect],
      getBoundingClientRect: () => selectionRect,
    } as unknown as Range;

    const rect = getDomActiveSelectionRect({
      rootElement: root,
      selection: {
        focusNode: textNode,
        focusOffset: 4,
        rangeCount: 1,
        getRangeAt: () => activeRange,
      },
    });

    expect(rect).toBe(caretRect);
    expect((collapsedRange.setStart as any)).toHaveBeenCalledWith(textNode, 4);
    expect((collapsedRange.collapse as any)).toHaveBeenCalledWith(true);
  });

  test('returns null when the focus node is outside the editor root', () => {
    const root = document.createElement('div');
    const other = document.createElement('div');
    const outsideTextNode = document.createTextNode('outside');
    other.appendChild(outsideTextNode);
    document.body.append(root, other);

    const activeRange = {
      cloneRange: vi.fn(),
      getClientRects: () => [new DOMRect(0, 0, 1, 16)],
      getBoundingClientRect: () => new DOMRect(0, 0, 1, 16),
    } as unknown as Range;

    const rect = getDomActiveSelectionRect({
      rootElement: root,
      selection: {
        focusNode: outsideTextNode,
        focusOffset: 0,
        rangeCount: 1,
        getRangeAt: () => activeRange,
      },
    });

    expect(rect).toBeNull();
  });
});
