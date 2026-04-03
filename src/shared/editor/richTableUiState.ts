interface RichTableToolbarVisibilityState {
  hasActiveSelection: boolean;
  hasCollapsedCellCursor: boolean;
  isEditable: boolean;
  isFocused: boolean;
  isTableActive: boolean;
  isTableHovered: boolean;
  isToolbarHovered: boolean;
  openColMenu: boolean;
  openColorMenu: boolean;
  openRowMenu: boolean;
}

export const shouldShowRichTableToolbar = ({
  hasActiveSelection,
  hasCollapsedCellCursor,
  isEditable,
  isFocused,
  isTableActive,
  isTableHovered,
  isToolbarHovered,
  openColMenu,
  openColorMenu,
  openRowMenu,
}: RichTableToolbarVisibilityState) => {
  if (!isEditable || !isTableActive || !isFocused) {
    return false;
  }

  return (
    hasActiveSelection ||
    hasCollapsedCellCursor ||
    isTableHovered ||
    isToolbarHovered ||
    openColorMenu ||
    openRowMenu ||
    openColMenu
  );
};
