/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

/** Used to specify if the UI item's visibility or enable state is affected by the testFunc defined in [[ConditionalDisplaySpecification]].
 * @beta
 */
export enum ConditionalDisplayType {
  Visibility = 0,
  EnableState = 1,
}
