/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Items */

/** Used to specify if the UI item's visibility or enable state is affected by the testFunc defined in [[ConditionalDisplaySpecification]].
 * @alpha
 */
export enum ConditionalDisplayType {
  Visibility = 0,
  EnableState = 1,
}
