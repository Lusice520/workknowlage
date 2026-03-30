import { useContext } from 'react';
import {
  BasicTextStyleButton,
  BlockTypeSelect,
  ColorStyleButton,
  ComponentsContext,
  CreateLinkButton,
  FileCaptionButton,
  FileDeleteButton,
  FileDownloadButton,
  FilePreviewButton,
  FileRenameButton,
  FileReplaceButton,
  NestBlockButton,
  TextAlignButton,
  UnnestBlockButton,
} from './blocknoteReactNoComments';

export function KnowledgeBaseFormattingToolbar() {
  const Components = useContext(ComponentsContext)!;

  return (
    <Components.FormattingToolbar.Root className="bn-toolbar bn-formatting-toolbar">
      <BlockTypeSelect items={[]} />
      <FileCaptionButton />
      <FileReplaceButton />
      <FileRenameButton />
      <FileDeleteButton />
      <FileDownloadButton />
      <FilePreviewButton />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <BasicTextStyleButton basicTextStyle="code" />
      <TextAlignButton textAlignment="left" />
      <TextAlignButton textAlignment="center" />
      <TextAlignButton textAlignment="right" />
      <ColorStyleButton />
      <NestBlockButton />
      <UnnestBlockButton />
      <CreateLinkButton />
    </Components.FormattingToolbar.Root>
  );
}
