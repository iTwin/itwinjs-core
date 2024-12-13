/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64, Id64Arg } from "@itwin/core-bentley";

interface CustomMatchers<R = unknown> {
  toBeId64Arg: (expected: Id64Arg) => R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

const PASS_RESULT = { pass: true, message: () => "" };
expect.extend({
  /**
   * A custom vite matcher that checks if the received value matches the expected `Id64Arg` in a loose fashion,
   * where types don't necessarily have to match as long as contents do.
   *
   * Warning: the matcher doesn't handle the `not` keyword (e.g. `expect(value).not.toBeId64Arg(expected)`). Needs
   * to be implemented if needed.
   */
  toBeId64Arg: (received: unknown, expected: Id64Arg) => {
    if (received === expected) {
      return PASS_RESULT;
    }
    const expectedSize = Id64.sizeOf(expected);
    if (typeof received === "string") {
      if (expectedSize !== 1) {
        return { pass: false, message: () => `expected ${received} to be an Id64Arg with size ${expectedSize}, but it's size is 1` };
      }
      const expectedId = Id64.getFirst(expected);
      if (received !== expectedId) {
        return { pass: false, message: () => `expected ${received} to be ${expectedId}` };
      }
      return PASS_RESULT;
    }
    if (Array.isArray(received)) {
      if (expectedSize !== received.length) {
        return { pass: false, message: () => `expected ${received} to be an Id64Arg with size ${expectedSize}, but it's size is ${received.length}` };
      }
      for (const expectedId of Id64.iterable(expected)) {
        if (!received.includes(expectedId)) {
          return { pass: false, message: () => `expected ${received} to contain ${expectedId}` };
        }
      }
      return PASS_RESULT;
    }
    if (received instanceof Set) {
      if (expectedSize !== received.size) {
        return { pass: false, message: () => `expected ${[...received]} to be an Id64Arg with size ${expectedSize}, but it's size is ${received.size}` };
      }
      for (const expectedId of Id64.iterable(expected)) {
        if (!received.has(expectedId)) {
          return { pass: false, message: () => `expected ${[...received]} to contain ${expectedId}` };
        }
      }
      return PASS_RESULT;
    }
    return { pass: false, message: () => `expected ${received} to be an Id64Arg` };
  },
});
