/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

let assertionsEnabled = process.env.NODE_ENV === "development";

/**
 * Asserts that a condition is `true`, and in development builds throws an error if it is not.
 * This is an [assertion function](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions) that alters the
 * behavior of the TypeScript compiler.
 * @param condition The result of a boolean expression.
 * @param msg An optional message to include in the thrown exception. Defaults to "Programmer Error".
 * @throws Error containing the specified message if condition is false.
 * @note This function should be used to validate conditions that should never realistically occur, or
 * which indicate a misuse of the API which should be eliminated during development.
 * @public
 */
export function assert(condition: boolean | (() => boolean), msg?: string | (() => string)): asserts condition {
  if (!assertionsEnabled)
    return;

  if ("boolean" !== typeof condition)
    condition = condition();

  if (condition)
    return;

  msg = msg ?? "Programmer Error";
  if ("string" !== typeof msg)
    msg = msg();

  throw new Error(`Assert: ${msg}`);
}

export function setAssertionsEnabled(enabled: boolean): boolean {
  const wasEnabled = assertionsEnabled;
  assertionsEnabled = enabled;
  return wasEnabled;
}
