interface RichTableToolbarVisibilityState {
  hasActiveSelection: boolean;
  hasCollapsedCellCursor: boolean;
  isEditable: boolean;
  isFocused: boolean;
  isTableActive: boolean;
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
    isToolbarHovered ||
    openColorMenu ||
    openRowMenu ||
    openColMenu
  );
};
