/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** The type of selection change */
export enum SelectionChangeType {
  /** Added to selection. */
  Add,

  /** Removed from selection. */
  Remove,

  /** Selection was replaced. */
  Replace,

  /** Selection was cleared. */
  Clear,
}
