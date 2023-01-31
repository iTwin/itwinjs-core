/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

/* eslint-disable deprecation/deprecation */

/** Interface for ShowHide items used to show/hide [[Table]] columns.
 * @public @deprecated in 3.2. Will be removed when deprecated [[Table]] component is removed.
 */
export interface ShowHideItem<T extends ShowHideID> {
  id: T;
  label: string;
}

/** Union type for all possible ShowHide IDs
 * @public @deprecated in 3.2. Will be removed when deprecated [[Table]] component is removed.
 */
export type ShowHideID = string | number | symbol;
