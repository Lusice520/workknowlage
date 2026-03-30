import Code from '@tiptap/extension-code';
import {
  BlockNoteSchema,
  createStyleSpecFromTipTapMark,
  defaultStyleSpecs,
} from '@blocknote/core';
import { ensureLinkifyProtocolsRegistered } from './linkifyBootstrap';

const codeMarkWithInlineComposedStyles = Code.extend({
  excludes: '',
});

export const blockNoteStyleSpecs = {
  ...defaultStyleSpecs,
  code: createStyleSpecFromTipTapMark(codeMarkWithInlineComposedStyles, 'boolean'),
};

export const createBlockNoteSchema = (options: Record<string, any> = {}) => {
  ensureLinkifyProtocolsRegistered();

  return BlockNoteSchema.create({
    ...options,
    styleSpecs: {
      ...blockNoteStyleSpecs,
      ...(options.styleSpecs || {}),
    },
  });
};
