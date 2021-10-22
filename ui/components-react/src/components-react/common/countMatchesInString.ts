/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* @author Vitim.us https://gist.github.com/victornpb/7736865 */

/** @packageDocumentation
 * @module Common
 */

/** Counts how many times string 'lookup' is repeated in string 'str'.
 * @internal
 */
export function countMatchesInString(str: string, lookup: string) {
  if (!str.length || !lookup.length)
    return 0;

  let n = 0, pos = 0;
  const step = lookup.length;

  while (true) {
    pos = str.indexOf(lookup, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else
      break;
  }
  return n;
}
