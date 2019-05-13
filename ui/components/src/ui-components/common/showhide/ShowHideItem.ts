/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

/** Interface for ShowHide items
 * @public
 */
export interface ShowHideItem<T extends ShowHideID> {
  id: T;
  label: string;
}

/** Union type for all possible ShowHide IDs
 * @public
 */
export type ShowHideID = string | number | symbol;
