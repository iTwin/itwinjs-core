/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "vitest";

/**
 * Asserts that an async function throws an error of a specific type with a specific message.
 * @param fn The async function that should throw
 * @param errorType The expected error constructor (e.g., ECSchemaError, Error)
 * @param messageContains The string that should be contained in the error message (optional)
 */
export async function expectAsyncToThrow<T extends Error>(
  fn: () => Promise<unknown>,
  errorType: new (...args: any[]) => T,
  messageContains?: string,
): Promise<void> {
  try {
    await fn();
    expect.fail(`Expected function to throw ${errorType.name}${messageContains !== undefined ? ` with message containing "${messageContains}"` : ""}`);
  } catch (e) {
    expect(e).toBeInstanceOf(errorType);
    if (messageContains !== undefined) {
      expect((e as T).message).toContain(messageContains);
    }
  }
}

/**
 * Asserts that a sync function throws an error of a specific type with a specific message.
 * @param fn The function that should throw
 * @param errorType The expected error constructor (e.g., ECSchemaError, Error)
 * @param messageContains The string that should be contained in the error message
 */
export function expectToThrow<T extends Error>(
  fn: () => unknown,
  errorType: new (...args: any[]) => T,
  messageContains: string,
): void {
  try {
    fn();
    expect.fail(`Expected function to throw ${errorType.name} with message containing "${messageContains}"`);
  } catch (e) {
    expect(e).toBeInstanceOf(errorType);
    expect((e as T).message).toContain(messageContains);
  }
}
