/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

/** Base state for any 'stateful' component
 * @beta
 */
export interface BaseItemState {
  isVisible?: boolean;        // Default - true
  isEnabled?: boolean;        // Default - true
  isActive?: boolean;         // Default - false
  isPressed?: boolean;        // Default - false
}
