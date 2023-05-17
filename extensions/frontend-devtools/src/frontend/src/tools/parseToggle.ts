/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Utilities
 */

/** Parses a string case-insensitively returning true for "ON", false for "OFF" undefined for "TOGGLE" or undefined, and the input string for anything else
 * Used by various tools which take such arguments.
 * @beta
 */
export function parseToggle(arg: string | undefined): string | boolean | undefined {
  if (undefined === arg)
    return undefined;

  switch (arg.toLowerCase()) {
    case "on": return true;
    case "off": return false;
    case "toggle": return undefined;
    default: return arg;
  }
}
