import { describe, expect, test } from 'vitest';
import { shouldShowRichTableToolbar } from './richTableUiState';

describe('shouldShowRichTableToolbar', () => {
  test('hides the toolbar when the table editor is not focused', () => {
    expect(shouldShowRichTableToolbar({
      isEditable: true,
      isTableActive: true,
      isFocused: false,
      hasActiveSelection: false,
      hasCollapsedCellCursor: true,
      isToolbarHovered: false,
      openColorMenu: false,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(false);
  });

  test('shows the toolbar when the focused cursor is inside a table cell', () => {
    expect(shouldShowRichTableToolbar({
      isEditable: true,
      isTableActive: true,
      isFocused: true,
      hasActiveSelection: false,
      hasCollapsedCellCursor: true,
      isToolbarHovered: false,
      openColorMenu: false,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(true);
  });
});
