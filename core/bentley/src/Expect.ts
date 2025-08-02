/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Expects that a value is defined (not undefined).
 * @param value The value to check.
 * @param message Optional error message to be used in thrown Error.
 * @returns The original value if it is defined.
 * @throws Error if the value is undefined.
 */
export function expectDefined<T>(value: T | undefined, message?: string): T {
  if (value === undefined) {
    throw new Error(message ?? "Expected value to be defined, but it was undefined.");
  }
  return value;
}
