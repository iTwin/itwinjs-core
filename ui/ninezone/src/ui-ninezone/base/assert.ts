/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

/** Asserts given condition.
 * @internal
 */
export function assert(condition: any): asserts condition {
  if (!condition)
    throw new Error();
}
