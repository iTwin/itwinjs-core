/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** TODO docs
 *
 */
export function addAllToArray<T>(target: Array<T>, source: Array<T>): Array<T> {
  if (source.length > 50000) {
    // This method is slower for smaller array sizes, but when the size of source gets larger its performance is ok.
    return target.concat(source);
  } else {
    // This method runs faster, but gets a stack overflow when the size of source is too large.
    target.push(...source);
    return target;
  }
}