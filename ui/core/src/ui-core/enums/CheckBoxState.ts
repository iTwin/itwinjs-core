/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

/** State of a checkbox
 * @public
 */
export enum CheckBoxState {
  Off,
  On,
  Partial,
}

/** A data type that holds all the checkbox display attributes
 * @public
 */
export interface CheckBoxInfo {
  isVisible?: boolean;
  isDisabled?: boolean;
  state?: CheckBoxState;
  tooltip?: string;
}
