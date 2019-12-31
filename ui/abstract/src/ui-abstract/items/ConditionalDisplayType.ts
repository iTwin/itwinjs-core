/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

/** Used to specify if the UI item's visibility or enable state is affected by the testFunc defined in [[ConditionalDisplaySpecification]].
 * @beta
 */
export enum ConditionalDisplayType {
  Visibility = 0,
  EnableState = 1,
}
