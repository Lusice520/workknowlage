const COLLAB_DISABLED_MESSAGE = 'Collaboration is disabled in WorkKnowlage';

export class Awareness {
  constructor() {
    throw new Error(COLLAB_DISABLED_MESSAGE);
  }
}
