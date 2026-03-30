const COLLAB_DISABLED_MESSAGE = 'Collaboration is disabled in WorkKnowlage';

const throwCollabDisabled = (): never => {
  throw new Error(COLLAB_DISABLED_MESSAGE);
};

export const ySyncPluginKey = {
  getState() {
    return undefined;
  },
};

export const yUndoPluginKey = {
  getState() {
    return undefined;
  },
};

export const yCursorPlugin = throwCollabDisabled;
export const ySyncPlugin = throwCollabDisabled;
export const yUndoPlugin = throwCollabDisabled;
export const redoCommand = throwCollabDisabled;
export const undoCommand = throwCollabDisabled;
export const defaultSelectionBuilder = throwCollabDisabled;
export const getRelativeSelection = throwCollabDisabled;
export const absolutePositionToRelativePosition = throwCollabDisabled;
export const relativePositionToAbsolutePosition = throwCollabDisabled;
export const yXmlFragmentToProseMirrorRootNode = throwCollabDisabled;
export const prosemirrorToYXmlFragment = throwCollabDisabled;
export const prosemirrorToYDoc = throwCollabDisabled;
