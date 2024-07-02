/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** Given an array of bytes containing a utf-8 string, convert to a string.
 * @param utf8: An array of utf-8 characters as a byte array
 * @returns An equivalent string, or undefined if the array does not contain a valid utf-8 string.
 * @note This function uses Javascript's TextDecoder if supported by the browser; otherwise, it
 * falls back to a less efficient polyfill.
 * @public
 */
export function utf8ToString(utf8: Uint8Array): string | undefined {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(utf8);
}

/** Given a base-64-encoded string, decode it into an array of bytes.
 * @param base64 The base-64-encoded string.
 * @returns the decoded byte array.
 * @throws DOMException if the length of the input string is not a multiple of 4.
 * @public
 */
export function base64StringToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(atob(base64).split("").map((c) => c.charCodeAt(0))); // eslint-disable-line deprecation/deprecation
}
