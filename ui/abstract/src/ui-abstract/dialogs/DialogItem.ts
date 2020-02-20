/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */
import { PrimitiveValue, PropertyValueFormat } from "../properties/Value";
import { PropertyDescription } from "../properties/Description";
/** DialogItemValue interface of PrimitiveValue types that have type editor support for use in dialogs
 * @beta
 */
export interface DialogItemValue extends PrimitiveValue {
  readonly valueFormat: PropertyValueFormat.Primitive;
  value?: number | string | boolean | Date;
  readonly displayValue?: string;
}
/** Interface used to identify the location of the item a DialogItem property value.
 * @beta
 */
export interface EditorPosition {
  /** Determine the order the row is shown in UI */
  rowPriority: number;
  /** Determines the column position for the type editor */
  columnIndex: number;
  /** Number of columns to occupy. Defaults to 1 */
  columnSpan?: number;
}

/** DialogItem is the specification that the display engine turns into a UI item
 * @beta
 */
export interface DialogItem {
  readonly value: DialogItemValue;
  readonly itemName: string;
  readonly property: PropertyDescription;
  readonly editorPosition: EditorPosition;
  readonly isDisabled?: boolean;
  readonly lockProperty?: DialogItem;
}

/** DialogSyncItem used to identify an item's enable/disable state in the UI
 * @beta
 */
export interface DialogSyncItem extends DialogItem {
  readonly isDisabled?: boolean;
}
