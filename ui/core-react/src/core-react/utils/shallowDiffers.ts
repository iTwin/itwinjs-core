/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Performs a shallow difference check on two objects.
 * @internal
 */
export const shallowDiffers = (a: { [key: string]: any } | undefined, b: { [key: string]: any } | undefined): boolean => {
  if (a === b)
    return false;
  if (a === undefined || b === undefined)
    return true;
  for (const i in a) {
    if (!(i in b))
      return true;
  }
  for (const i in b) {
    if (a[i] !== b[i])
      return true;
  }
  return false;
};
