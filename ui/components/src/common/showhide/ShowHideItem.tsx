/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

/** Interface for ShowHide items */
export interface ShowHideItem<T extends ShowHideID> {
  id: T;
  label: string;
}

/** Union type for all possible ShowHide IDs */
export type ShowHideID = string | number | symbol;
