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
      isTableHovered: false,
      isToolbarHovered: false,
      openColorMenu: false,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(false);
  });

  test('shows the toolbar for a collapsed cursor inside a focused table cell', () => {
    expect(shouldShowRichTableToolbar({
      isEditable: true,
      isTableActive: true,
      isFocused: true,
      hasActiveSelection: false,
      hasCollapsedCellCursor: true,
      isTableHovered: false,
      isToolbarHovered: false,
      openColorMenu: false,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(true);
  });

  test('shows the toolbar when the user has an active selection inside the table', () => {
    expect(shouldShowRichTableToolbar({
      isEditable: true,
      isTableActive: true,
      isFocused: true,
      hasActiveSelection: true,
      hasCollapsedCellCursor: false,
      isTableHovered: false,
      isToolbarHovered: false,
      openColorMenu: false,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(true);
  });

  test('shows the toolbar when the user hovers the table surface', () => {
    expect(shouldShowRichTableToolbar({
      isEditable: true,
      isTableActive: true,
      isFocused: true,
      hasActiveSelection: false,
      hasCollapsedCellCursor: true,
      isTableHovered: true,
      isToolbarHovered: false,
      openColorMenu: false,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(true);
  });

  test('shows the toolbar when one of the inline control menus is open', () => {
    expect(shouldShowRichTableToolbar({
      isEditable: true,
      isTableActive: true,
      isFocused: true,
      hasActiveSelection: false,
      hasCollapsedCellCursor: true,
      isTableHovered: false,
      isToolbarHovered: false,
      openColorMenu: true,
      openRowMenu: false,
      openColMenu: false,
    })).toBe(true);
  });
});
