/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Copy the input string to the system clipboard.
 * Obtained from https://techoverflow.net/2018/03/30/copying-strings-to-the-clipboard-using-pure-javascript/
 * @beta
 */
export function copyStringToClipboard(str: string): void {
  const el = document.createElement("textarea");
  el.value = str;
  el.setAttribute("readonly", "");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy"); // eslint-disable-line deprecation/deprecation
  document.body.removeChild(el);
}
