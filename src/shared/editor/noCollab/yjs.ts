const COLLAB_DISABLED_MESSAGE = 'Collaboration is disabled in WorkKnowlage';

const throwCollabDisabled = (): never => {
  throw new Error(COLLAB_DISABLED_MESSAGE);
};

class DisabledCollabClass {
  constructor() {
    throwCollabDisabled();
  }
}

export class Doc extends DisabledCollabClass {}
export class UndoManager extends DisabledCollabClass {}
export class AbstractType extends DisabledCollabClass {}
export class ContentType extends DisabledCollabClass {}
export class Item extends DisabledCollabClass {}
export class XmlFragment extends DisabledCollabClass {}
export class XmlElement extends DisabledCollabClass {}
export class XmlText extends DisabledCollabClass {}
export class Map extends DisabledCollabClass {}
export class Array extends DisabledCollabClass {}

export { XmlElement as XMLElement };

export const create = throwCollabDisabled;
export const applyUpdate = throwCollabDisabled;
export const encodeStateAsUpdate = throwCollabDisabled;
export const encodeStateVector = throwCollabDisabled;
export const findIndexSS = throwCollabDisabled;
