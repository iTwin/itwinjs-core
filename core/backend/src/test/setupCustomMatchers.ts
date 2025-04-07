/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { advancedDeepEqual, DeepEqualOpts } from "./AdvancedEqual.js";

interface CustomMatchers<R = unknown> {
  advancedEqual: (expected: any, options?: any) => R;
  subsetEqual: (expected: any, options?: any) => R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> { }
  interface AsymmetricMatchersContaining extends CustomMatchers { }
}
  /**
   * A custom vite matchers that checks if the received value matches the expected in a loose fashion,
   * where types don't necessarily have to match as long as contents do.
   *
   * Warning: the matchers don't handle the `not`, `deep` keyword (e.g. `expect(value).not.advancedEqual(expected)`). Needs
   * to be implemented if needed.
   */

expect.extend({
  advancedEqual: (actual: any, expected: any, options: DeepEqualOpts = {}) => {
    if (options.tolerance === undefined)
      options.tolerance = 1e-10;

    const pass = advancedDeepEqual(expected, actual, options);
    if (pass) {
      return {
        message: () => `expected deep equality of ${expected} and ${actual} with a tolerance of ${options.tolerance}`,
        pass: true,
        actual,
        expected,
      }
    } else {
      return {
        message: () => `expected deep inequality of ${expected} and ${actual} with a tolerance of ${options.tolerance}`,
        pass: false,
        actual,
        expected,
      }
    }
  }
});

expect.extend({
  subsetEqual: (actual: any, expected: any, options: DeepEqualOpts = {}) => {
    if (options.tolerance === undefined)
      options.tolerance = 1e-10;

    const pass = advancedDeepEqual(expected, actual, { ...options, useSubsetEquality: true });

    if (pass) {
      return {
        message: () => `expected ${actual} to contain as a subset ${expected}`,
        pass: true,
        actual,
        expected,
      }
    } else {
      return {
        message: () => `expected ${actual} not to contain as a subset ${expected}`,
        pass: false,
        actual,
        expected,
      }
    }
  }
});

