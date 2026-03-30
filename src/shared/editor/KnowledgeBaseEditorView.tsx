import type { HTMLAttributes, ReactNode } from 'react';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { mergeCSSClasses } from '@blocknote/core';
import {
  BlockNoteContext,
  ComponentsContext,
  useEditorChange,
  useEditorSelectionChange,
} from './blocknoteReactNoComments';
import { MantineContext, MantineProvider } from '@mantine/core';
import { ElementRenderer } from '../../../node_modules/@blocknote/react/src/editor/ElementRenderer.js';
import {
  Portals,
  getContentComponent,
} from '../../../node_modules/@blocknote/react/src/editor/EditorContent.js';
import { knowledgeBaseEditorComponents } from './knowledgeBaseEditorComponents';

const NOOP = () => {};

export interface KnowledgeBaseEditorViewProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSelectionChange'> {
  autoFocus?: boolean;
  children?: ReactNode;
  editable?: boolean;
  editor: any;
  onChange?: (editor: any) => void;
  onSelectionChange?: () => void;
}

export function KnowledgeBaseEditorView({
  autoFocus,
  children,
  className,
  editable,
  editor,
  onChange = NOOP,
  onSelectionChange = NOOP,
  ...rest
}: KnowledgeBaseEditorViewProps) {
  const [contentEditableProps, setContentEditableProps] = useState<Record<string, any>>();
  const portalManager = useMemo(() => getContentComponent(), []);
  const mantineContext = useContext(MantineContext);

  useEditorChange(onChange, editor);
  useEditorSelectionChange(onSelectionChange, editor);

  const blockNoteContextValue = useMemo(() => ({
    colorSchemePreference: 'light' as const,
    editor,
    setContentEditableProps,
  }), [editor]);

  const setElementRenderer = useCallback((ref: any) => {
    editor.elementRenderer = ref;
  }, [editor]);

  const mount = useCallback((element: HTMLElement | null) => {
    editor.isEditable = editable !== false;
    editor._tiptapEditor.contentComponent = portalManager;

    if (element) {
      editor.mount(element);
      return;
    }

    editor.unmount();
  }, [editable, editor, portalManager]);

  const view = (
    <ComponentsContext.Provider value={knowledgeBaseEditorComponents}>
      <BlockNoteContext.Provider value={blockNoteContextValue}>
        <ElementRenderer ref={setElementRenderer} />
        <div
          className={mergeCSSClasses('bn-container', 'bn-mantine', 'light', className || '')}
          data-color-scheme="light"
          data-mantine-color-scheme="light"
          {...rest}
        >
          <Portals contentComponent={portalManager} />
          <div
            aria-autocomplete="list"
            aria-haspopup="listbox"
            data-bn-autofocus={autoFocus}
            ref={mount}
            {...contentEditableProps}
          />
          {children}
        </div>
      </BlockNoteContext.Provider>
    </ComponentsContext.Provider>
  );

  if (mantineContext) {
    return view;
  }

  return (
    <MantineProvider
      withCssVariables={false}
      getRootElement={() => undefined}
    >
      {view}
    </MantineProvider>
  );
}
