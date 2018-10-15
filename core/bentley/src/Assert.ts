/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

// @todo Needs to be commented out in a production environment.
/**
 * Assert by throwing a programmer error.
 * @param condition The result of a boolean expression.
 * @param msg An optional message to include in the thrown exception. Defaults to "Programmer Error".
 * @throws Error containing the specified message if condition is false.
 * @note This function should be used to validate conditions that should never realistically occur, or
 * which indicate a misuse of the API which should be eliminated during development.
 */
export function assert(condition: boolean, msg?: string): void {
  if (!condition)
    throw new Error("Assert: " + ((msg !== undefined) ? msg : "Programmer Error"));
}
