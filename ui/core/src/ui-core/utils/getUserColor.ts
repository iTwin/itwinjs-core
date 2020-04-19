/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

const COLORS = [
  "#6ab9ec",
  "#b1c854",
  "#f7706c",
  "#4585a5",
  "#ffc335",
  "#f7963e",
  "#73c7c1",
  "#85a9cf",
  "#a3779f",
  "#c8c2b4",
  "#a47854",
];

/** Gets a color based on a given email address. This color is usually displayed in an avatar component.
 * @internal
 */
export function getUserColor(email: string): string {
  if (typeof email !== "string")  // Test for invalid data
    return COLORS[0];

  const cleanString = email.trim().toLowerCase();

  let hash = 0;
  for (let i = 0; i < cleanString.length; i++) {
    const charCode = cleanString.charCodeAt(i);
    hash = (hash + charCode) % COLORS.length;
  }
  return COLORS[hash];
}
