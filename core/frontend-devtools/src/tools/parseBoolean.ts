/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Utilities
 */

/** Parses a string case-insensitively returning true for "ON" or "TRUE", false for "OFF" or "FALSE" and undefined otherwise.
 * Used by various tools which take such arguments.
 * @beta
 */
export function parseBoolean(arg: string | undefined): boolean | undefined {
  if (undefined === arg)
    return undefined;

  switch (arg.toLowerCase()) {
    case "on": return true;
    case "true": return true;
    case "off": return false;
    case "false": return false;
    default: return undefined;
  }
}
