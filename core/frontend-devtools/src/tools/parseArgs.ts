/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

/** Represents parsed arguments as name-value pairs.
 * @see [[parseArgs]]
 * @beta
 */
export interface ToolArgs {
  /** Find the value associated with the first argument that begins with the specified prefix, case-insensitively; or undefined if no such argument exists. */
  get(namePrefix: string): string | undefined;
  /** Convert the value associated with the first argument beginning with the specified prefix to an integer; return undefined if not found or not an integer. */
  getInteger(namePrefix: string): number | undefined;
  /** Convert the value associated with the first argument beginning with the specified prefix to a boolean, where "1" indicates true and "0" indicates false. */
  getBoolean(namePrefix: string): boolean | undefined;
  /** Convert the value associated with the first argument beginning with the specified prefix to a float; return undefined if not found or not a float. */
  getFloat(namePrefix: string): number | undefined;
}

/** Given a list of arguments, parse the arguments into name-value pairs.
 * Each input string is expected to be of the format "name=value".
 * Argument names are converted to lower-case; values are left untouched.
 * @beta
 */
export function parseArgs(args: string[]): ToolArgs {
  const map = new Map<string, string>();
  for (const arg of args) {
    const parts = arg.split("=");
    if (2 === parts.length)
      map.set(parts[0].toLowerCase(), parts[1]);
  }

  const findArgValue = (name: string) => {
    name = name.toLowerCase();
    for (const key of map.keys())
      if (key.startsWith(name))
        return map.get(key);

    return undefined;
  };

  return {
    get: (name: string) => findArgValue(name),

    getBoolean: (name: string) => {
      const val = findArgValue(name);
      if (undefined !== val && (val === "0" || val === "1"))
        return val === "1";

      return undefined;
    },

    getInteger: (name: string) => {
      const val = findArgValue(name);
      if (undefined === val)
        return undefined;

      const num = Number.parseInt(val, 10);
      return Number.isNaN(num) ? undefined : num;
    },

    getFloat: (name: string) => {
      const val = findArgValue(name);
      if (undefined === val)
        return undefined;

      const num = Number.parseFloat(val);
      return Number.isNaN(num) ? undefined : num;
    },
  };
}
