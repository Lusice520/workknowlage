// Centralize the BlockNote private-core seams we still depend on so future
// upgrades only need to audit one adapter surface instead of chasing imports
// across editor business logic.
export { getBlockInfoFromSelection } from '../../../node_modules/@blocknote/core/src/api/getBlockInfoFromPos.js';
export {
  getNextBlockInfo,
  getPrevBlockInfo,
} from '../../../node_modules/@blocknote/core/src/api/blockManipulation/commands/mergeBlocks/mergeBlocks.js';
