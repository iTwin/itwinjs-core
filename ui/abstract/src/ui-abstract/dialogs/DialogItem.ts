/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import { PropertyDescription } from "../properties/Description";

/** [[DialogItemValue]] Interface of PrimitiveValue types that have type editor support for use in dialogs
 * @beta
 */
export interface DialogItemValue {
  value?: number | string | boolean | Date;
  displayValue?: string;
}
/** [[EditorPosition]] Interface used to identify the location of the item a DialogItem property value.
 * @beta
 */
export interface EditorPosition {
  /** Determine the order the row is shown in UI */
  rowPriority: number;
  /** Determines the column position for the type editor */
  columnIndex: number;
  /** Number of columns to occupy. Defaults to 1
   * @deprecated
   */
  columnSpan?: number;
}

/** [[BaseDialogItem]] contains only the members necessary to create a PropertyRecord.
 * @beta
 */
export interface BaseDialogItem {
  readonly value: DialogItemValue;
  readonly property: PropertyDescription;
  readonly isDisabled?: boolean;
}
/** [[DialogItem]] is the specification that the display engine turns into a UI item
 * @beta
 */
export interface DialogItem extends BaseDialogItem {
  readonly editorPosition: EditorPosition;
  readonly lockProperty?: BaseDialogItem;
}

/** [[DialogPropertyItem]] us the specification to use if you are defining the components directly, e.g., in React
 * @beta
 */
export interface DialogPropertyItem {
  readonly value: DialogItemValue;
  readonly propertyName: string;
}

/** [[DialogPropertySyncItem]] is used to pass sync messages for DialogPropertyItems
 * @beta
 */
export interface DialogPropertySyncItem extends DialogPropertyItem {
  readonly isDisabled?: boolean;
  readonly property?: PropertyDescription;
}
