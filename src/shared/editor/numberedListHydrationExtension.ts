import { createExtension } from '@blocknote/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const NUMBERED_LIST_HYDRATION_PLUGIN_KEY = new PluginKey('wk-numbered-list-hydration');

const addNumberedListDecorationsFromGroup = (
  groupNode: any,
  groupPos: number,
  decorations: Decoration[],
) => {
  let currentIndex = 0;

  groupNode.forEach((childNode: any, childOffset: number) => {
    const childPos = groupPos + 1 + childOffset;
    const contentNode = childNode?.firstChild;
    const contentPos = childPos + 1;

    if (contentNode?.type?.name === 'numberedListItem') {
      // Clipboard/import HTML can carry polluted start values on every item.
      // Until the product exposes intentional custom starts, render contiguous
      // numbered-list groups as sequential 1..n in the editor surface.
      currentIndex += 1;
      decorations.push(
        Decoration.node(
          contentPos,
          contentPos + contentNode.nodeSize,
          { 'data-index': String(currentIndex) },
        ),
      );
    } else {
      currentIndex = 0;
    }

    childNode?.forEach?.((nestedNode: any, nestedOffset: number) => {
      if (nestedNode?.type?.name !== 'blockGroup') {
        return;
      }

      addNumberedListDecorationsFromGroup(
        nestedNode,
        childPos + 1 + nestedOffset,
        decorations,
      );
    });
  });
};

const buildNumberedListHydrationDecorations = (doc: any) => {
  const decorations: Decoration[] = [];

  doc.forEach((node: any, offset: number) => {
    if (node?.type?.name !== 'blockGroup') {
      return;
    }

    addNumberedListDecorationsFromGroup(node, offset, decorations);
  });

  return DecorationSet.create(doc, decorations);
};

export const NumberedListHydrationExtension = createExtension({
  key: 'wkNumberedListHydration',
  prosemirrorPlugins: [
    new Plugin({
      key: NUMBERED_LIST_HYDRATION_PLUGIN_KEY,
      props: {
        decorations(state) {
          const plugin = this as Plugin & {
            __wkLastDoc?: any;
            __wkLastDecorations?: DecorationSet;
          };

          if (plugin.__wkLastDoc === state.doc && plugin.__wkLastDecorations) {
            return plugin.__wkLastDecorations;
          }

          plugin.__wkLastDoc = state.doc;
          plugin.__wkLastDecorations = buildNumberedListHydrationDecorations(state.doc);
          return plugin.__wkLastDecorations;
        },
      },
    }),
  ],
});
