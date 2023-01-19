/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DragDrop
 */

import * as React from "react";
import { CommonProps } from "@itwin/core-react";

/** Enum for different DropEffects.
 * @beta
 * @deprecated
 */
export enum DropEffects {
  None = 0,
  Copy = 1 << 0,
  Move = 1 << 1,
  Link = 1 << 2,
}

/** Enum for status of current drag/drop item
 * @beta
 * @deprecated
 */
export enum DropStatus {
  None = 0,
  Ok,
  Drop,
  Cancel,
}

/** Properties and callbacks for the withDragSource Higher-Order Component.
 * @beta
 * @deprecated
 */
export interface DropTargetProps<DragDropObject = any> {
  /**
   * Triggered when item is dropped on wrapped component.
   * Return value is passed to the DragSource's onDragSourceEnd callback.
   */
  onDropTargetDrop?: (args: DropTargetArguments<DragDropObject>) => DropTargetArguments<DragDropObject>; // eslint-disable-line deprecation/deprecation
  /** Triggered when item is dragged over wrapped component. */
  onDropTargetOver?: (args: DropTargetArguments<DragDropObject>) => void; // eslint-disable-line deprecation/deprecation
  /** Determines whether item may be dropped on DropTarget. */
  canDropTargetDrop?: (args: DropTargetArguments<DragDropObject>) => boolean; // eslint-disable-line deprecation/deprecation
  /** List of allowed object types */
  objectTypes?: Array<string | symbol> | (() => Array<string | symbol>);
}

/** Properties and callbacks for the withDragSource Higher-Order Component.
 * @beta
 * @deprecated
 */
export interface DragSourceProps<DragDropObject = any> {
  /** Triggered when DragSource has begun a drag. */
  onDragSourceBegin?: (data: DragSourceArguments<DragDropObject>) => DragSourceArguments<DragDropObject>; // eslint-disable-line deprecation/deprecation
  /**
   * Triggered when a DragSource drag has ended.
   * Callback is always called after an onDragSourceBegin callback, regardless of whether the drag was successful.
   */
  onDragSourceEnd?: (data: DragSourceArguments<DragDropObject>) => void; // eslint-disable-line deprecation/deprecation
  /**
   * Specifies the DragSource type.
   * data parameter is non-null when data is trickled down from dragged component.
   */
  objectType?: ((data?: DragDropObject) => string | symbol) | string | symbol;
  /**
   * Specifies a default DragLayer component to display as a drag preview.
   * This property is dependent on the DragDropLayerManager in appui-react. The DragLayer is ultimately rendered using the DragDropLayerRendererComponent, which must exist within the app that is used.
   * Component may be overridden if another DragLayer is registered for the given type using the DragDropLayerManager in appui-react.
   */
  defaultDragLayer?: React.ComponentType<DragLayerProps<DragDropObject>>; // eslint-disable-line deprecation/deprecation
}

/** Base DragDropArguments interface, used by both DragSourceArguments and DragTargetArguments.
 * @beta
 * @deprecated
 */
export interface DragDropArguments<DragDropObject = any> {
  /** Arbitrary data being transferred. Actual data structure determined by the return value of the onDragSourceBegin callback. */
  dataObject: DragDropObject;
  /** Drop Effect of current drag */
  dropEffect: DropEffects; // eslint-disable-line deprecation/deprecation
  /** Status of current drop */
  dropStatus: DropStatus; // eslint-disable-line deprecation/deprecation
  /** Current mouse position. */
  clientOffset: { x: number, y: number };
  /** Mouse position at beginning of drag. */
  initialClientOffset: { x: number, y: number };
  /**
   * Current mouse position, offset by the difference between initial mouse position and initial dragSource offset.
   * Useful for preserving apparent anchor point of mouse to dragSource while rendering a dragPreview.
   */
  sourceClientOffset?: { x: number, y: number };
  /** Position of top left corner of current dragSource, measured at beginning of drag. */
  initialSourceClientOffset?: { x: number, y: number };
  /** DOMRect object of dragSource.
   * Not available in canDropTargetDrop.
   */
  dragRect?: DOMRect;
  /** DOMRect object of current dropTarget, if available.
    * Not available in canDropTargetDrop.
    */
  dropRect?: DOMRect;
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

/** Properties for DragLayer components
 * @beta
 * @deprecated
 */
export interface DragLayerProps<DragDropObject = any> extends CommonProps {
  args?: DragSourceArguments<DragDropObject>; // eslint-disable-line deprecation/deprecation
}

/** Interface for arguments supplied to DragSource callbacks, including onDragSourceBegin, and onDragSourceEnd, as well as to the DragLayers as a prop.
 * @beta
 * @deprecated
 */
export interface DragSourceArguments<DragDropObject = any> extends DragDropArguments<DragDropObject> { // eslint-disable-line deprecation/deprecation
  /** Parent object, using the data structure relevant to object being used.
   * Object populated by consumer for use as trickle down arguments.
   * Specifically used where further information is needed within a given dataProvider structure. Ie. dataProvider.removeChild(parentObject, child) type methods.
   */
  parentObject?: DragDropObject;
  defaultDragLayer?: React.ComponentType<DragLayerProps<DragDropObject>>; // eslint-disable-line deprecation/deprecation
}

/** Interface for arguments supplied to DropTarget callbacks, including onDropTargetOver, onDropTargetDrop, and canDropTargetDrop.
 * @beta
 * @deprecated
 */
export interface DropTargetArguments<DragDropObject = any> extends DragSourceArguments<DragDropObject> { // eslint-disable-line deprecation/deprecation
  /** Object that is being dropped onto, using the data structure relevant to object being used.
   * Object populated by consumer for use as trickle down arguments.
   * Specifically used where further information is needed within a given dataProvider structure. Ie. dataProvider.addChild(dropLocation, child) type methods.
   */
  dropLocation?: DragDropObject; // Where to attach
}
