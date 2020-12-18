/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Uses ECMAScript case transformation (toLowerCase() and toUpperCase()) to check whether or not a given character is a letter.
 * Beyond the English alphabet, this solution will also work for most Greek, Armenian, Cyrillic, and Latin characters.
 * But, it will not work for Chinese or Japanese characters since those languages do not have uppercase and lowercase letters.
 * @alpha
 */
export function isLetter(char: string): boolean {
  return char.length === 1 && char.toLowerCase() !== char.toUpperCase();
}
