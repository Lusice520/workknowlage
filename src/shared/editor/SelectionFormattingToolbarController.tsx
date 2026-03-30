import { useMemo, type FC } from 'react';
import { defaultProps } from '@blocknote/core';
import { FormattingToolbarExtension } from '@blocknote/core/extensions';
import type { Placement } from '@floating-ui/react';
import {
  PositionPopover,
  useEditorState,
  useExtension,
  useExtensionState,
} from './blocknoteReactNoComments';
import type { BlockNoteEditor, BlockSchema, InlineContentSchema, StyleSchema } from '@blocknote/core';
import { flip, offset, shift } from '@floating-ui/react';
import { NodeSelection, TextSelection } from 'prosemirror-state';

export const shouldShowFormattingToolbarForSelection = (
  editor: BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema> | null | undefined
) => {
  const selection = editor?.prosemirrorState?.selection;
  const doc = editor?.prosemirrorState?.doc;

  if (!selection || !doc || selection.empty) {
    return false;
  }

  if (
    selection instanceof NodeSelection &&
    (selection.node.type.spec.content === 'inline*' ||
      selection.node.firstChild?.type.spec.content === 'inline*')
  ) {
    return false;
  }

  if (
    selection instanceof TextSelection &&
    doc.textBetween(selection.from, selection.to).length === 0
  ) {
    return false;
  }

  let spansCode = false;
  selection.content().content.descendants((node) => {
    if (node.type.spec.code) {
      spansCode = true;
    }

    return !spansCode;
  });

  return !spansCode;
};

export function SelectionFormattingToolbarController({
  editor,
  formattingToolbar,
}: {
  editor: BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>;
  formattingToolbar?: FC<any>;
}) {
  const formattingToolbarExtension = useExtension(FormattingToolbarExtension, {
    editor,
  });
  const show = useExtensionState(FormattingToolbarExtension, {
    editor,
  });
  const shouldShow = useEditorState({
    editor,
    on: 'selection',
    selector: ({ editor: currentEditor }) =>
      shouldShowFormattingToolbarForSelection(currentEditor),
  });
  const position = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      formattingToolbarExtension.store.state
        ? {
            from: currentEditor.prosemirrorState.selection.from,
            to: currentEditor.prosemirrorState.selection.to,
          }
        : undefined,
  });
  const placement = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor.getTextCursorPosition().block?.props?.textAlignment || defaultProps.textAlignment,
  });
  const floatingPlacement: Placement =
    placement === 'center'
      ? 'top'
      : placement === 'right'
        ? 'top-end'
        : 'top-start';

  const floatingUIOptions = useMemo(() => ({
    useFloatingOptions: {
      middleware: [offset(10), shift(), flip()],
      onOpenChange: (open: boolean, _event: unknown, reason?: string) => {
        formattingToolbarExtension.store.setState(open);

        if (reason === 'escape-key') {
          editor.focus();
        }
      },
      open: Boolean(show && shouldShow),
      placement: floatingPlacement,
    },
    focusManagerProps: {
      disabled: true,
    },
    elementProps: {
      style: {
        zIndex: 40,
      },
    },
  }), [editor, floatingPlacement, formattingToolbarExtension.store, shouldShow, show]);

  if (!show || !shouldShow) {
    return null;
  }

  const Component = formattingToolbar;

  return (
    <PositionPopover position={position} {...floatingUIOptions}>
      {Component ? <Component /> : null}
    </PositionPopover>
  );
}
