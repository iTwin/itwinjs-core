/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Expects that a value is defined (not undefined).
 * @note Almost always, places that use this function should in the future be cleaned up to properly
 * handle undefined values instead of throwing an error.
 * @param value The value to check.
 * @param message Optional error message to be used in thrown Error.
 * @returns The original value if it is defined.
 * @throws Error if the value is undefined.
 * @internal
 */
export function expectDefined<T>(value: T | undefined, message?: string): T {
  if (value === undefined) {
    throw new Error(message ?? "Expected value to be defined, but it was undefined.");
  }
  return value;
}

/**
 * Expects that a value is not null.
 * @note Almost always, places that use this function should in the future be cleaned up to properly
 * handle null values instead of throwing an error.
 * @param value The value to check.
 * @param message Optional error message to be used in thrown Error.
 * @returns The original value if it is not null.
 * @throws Error if the value is null.
 * @internal
 */
export function expectNotNull<T>(value: T | null, message?: string): T {
  if (value === null) {
    throw new Error(message ?? "Expected value to be not null, but it was null.");
  }
  return value;
}
