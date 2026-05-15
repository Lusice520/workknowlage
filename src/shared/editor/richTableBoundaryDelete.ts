import { NodeSelection } from 'prosemirror-state';
import {
  getBlockInfoFromSelection,
  getNextBlockInfo,
  getPrevBlockInfo,
} from './blocknoteCoreInternals';

type BlockInfoGetter = (state: any) => any;
type AdjacentBlockInfoGetter = (doc: any, beforePos: number) => any;
type NodeSelectionCreator = (doc: any, pos: number) => any;

const isEmptyInlineBlockContainer = (blockInfo: any) => (
  Boolean(blockInfo?.isBlockContainer) &&
  blockInfo?.blockContent?.node?.type?.spec?.content === 'inline*' &&
  blockInfo?.blockContent?.node?.childCount === 0
);

const isRichTableBlockContainer = (blockInfo: any) => (
  Boolean(blockInfo?.isBlockContainer) &&
  blockInfo?.blockContent?.node?.type?.name === 'richTable'
);

const isDividerBlockContainer = (blockInfo: any) => (
  Boolean(blockInfo?.isBlockContainer) &&
  blockInfo?.blockContent?.node?.type?.name === 'divider' &&
  blockInfo?.blockContent?.node?.type?.spec?.content === ''
);

export const handleRichTableAdjacentDeletionWithoutScroll = ({
  key,
  state,
  dispatch,
  getBlockInfoFromSelectionFn = getBlockInfoFromSelection as BlockInfoGetter,
  getPrevBlockInfoFn = getPrevBlockInfo as AdjacentBlockInfoGetter,
  getNextBlockInfoFn = getNextBlockInfo as AdjacentBlockInfoGetter,
  createNodeSelectionFn = NodeSelection.create as NodeSelectionCreator,
}: {
  key: string;
  state: any;
  dispatch: ((tr: any) => void) | undefined;
  getBlockInfoFromSelectionFn?: BlockInfoGetter;
  getPrevBlockInfoFn?: AdjacentBlockInfoGetter;
  getNextBlockInfoFn?: AdjacentBlockInfoGetter;
  createNodeSelectionFn?: NodeSelectionCreator;
}) => {
  if (!state?.doc || !state?.tr || !dispatch) return false;
  if (key !== 'Backspace' && key !== 'Delete') return false;

  const blockInfo = getBlockInfoFromSelectionFn(state);
  const deletingEmptyInlineBlock = isEmptyInlineBlockContainer(blockInfo);
  const deletingDividerBlock = isDividerBlockContainer(blockInfo);

  if (!deletingEmptyInlineBlock && !deletingDividerBlock) return false;

  const primaryAdjacentBlockInfo = key === 'Backspace'
    ? getPrevBlockInfoFn(state.doc, blockInfo.bnBlock.beforePos)
    : getNextBlockInfoFn(state.doc, blockInfo.bnBlock.beforePos);

  let adjacentBlockInfo = primaryAdjacentBlockInfo;
  if (!isRichTableBlockContainer(adjacentBlockInfo) && deletingDividerBlock) {
    adjacentBlockInfo = key === 'Backspace'
      ? getNextBlockInfoFn(state.doc, blockInfo.bnBlock.beforePos)
      : getPrevBlockInfoFn(state.doc, blockInfo.bnBlock.beforePos);
  }

  if (!isRichTableBlockContainer(adjacentBlockInfo)) return false;

  const selection = createNodeSelectionFn(state.doc, adjacentBlockInfo.blockContent.beforePos);
  const tr = state.tr
    .setSelection(selection)
    .deleteRange(blockInfo.bnBlock.beforePos, blockInfo.bnBlock.afterPos);

  dispatch(tr);
  return true;
};
