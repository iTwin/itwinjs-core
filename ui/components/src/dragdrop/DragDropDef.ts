/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module DragDrop  */

/** Enum for different DropEffects. */
export enum DropEffects {
  None = 0,
  Copy = 1 << 0,
  Move = 1 << 1,
  Link = 1 << 2,
}

/** Enum for status of current drag/drop item */
export enum DropStatus {
  None = 0,
  Ok,
  Drop,
  Cancel,
}

/** Base DragDropArguments interface, used by both DragSourceArguments and DragTargetArguments. */
export interface DragDropArguments {
  /** Arbitrary data being transferred. Actual data structure determined by the return value of the onDragSourceBegin callback. */
  dataObject: any;
  /** Drop Effect of current drag */
  dropEffect: DropEffects;
  /** Status of current drop */
  dropStatus: DropStatus;
  /** Current mouse position. */
  clientOffset: {x: number, y: number};
  /** Mouse position at beginning of drag. */
  initialClientOffset: {x: number, y: number};
  /**
   * Current mouse position, offset by the difference between initial mouse position and initial dragSource offset.
   * Useful for preserving apparent anchor point of mouse to dragSource while rendering a dragPreview.
   */
  sourceClientOffset?: {x: number, y: number};
  /** Position of top left corner of current dragSource, measured at beginning of drag. */
  initialSourceClientOffset?: {x: number, y: number};
  /** ClientRect object of dragSource.
   * Not available in canDropTargetDrop.
   */
  dragRect?: ClientRect;
  /** ClientRect object of current dropTarget, if available.
   * Not available in canDropTargetDrop.
   */
  dropRect?: ClientRect;
  /** determines whether item is dropped on same structure as the drag source, or a different structure.
   * Passed from OnDropTargetDrop for use in OnDragSourceEnd
   * Used primarily for cases where the dataProvider object needs to differentiate a moveItem method with a subsequent removeItem then addItem.
   */
  local?: boolean;
  /** specifies the row to be dropped onto.
   * Populated by consumers for trickle down arguments.
   * Specifically used where further information is needed within a given dataProvider structure. Ie. insertRow(rowIndex, rowItem) type methods.
   */
  row?: number;
  /** specifies the col to be dropped onto.
   * Populated by consumers for trickle down arguments.
   * Specifically used where further information is needed within a given dataProvider structure. Ie. dataProvider.insertCol(colIndex, colItem) type methods.
   */
  col?: number;
}

/** Interface for arguments supplied to DragSource callbacks, including onDragSourceBegin, and onDragSourceEnd, as well as to the DragLayers as a prop. */
export interface DragSourceArguments extends DragDropArguments {
  /** Parent object, using the data structure relavent to object being used.
   * Object populated by consumer for use as trickle down arguments.
   * Specifically used where further information is needed within a given dataProvider structure. Ie. dataProvider.removeChild(parentObject, child) type methods.
   */
  parentObject?: any;
}
/** Interface for arguments supplied to DropTarget callbacks, including onDropTargetOver, onDropTargetDrop, and canDropTargetDrop. */
export interface DropTargetArguments extends DragDropArguments {
  /** Object that is being dropped onto, using the data structure relavent to object being used.
   * Object populated by consumer for use as trickle down arguments.
   * Specifically used where further information is needed within a given dataProvider structure. Ie. dataProvider.addChild(dropLocation, child) type methods.
   */
  dropLocation?: any; // Where to attach
}
