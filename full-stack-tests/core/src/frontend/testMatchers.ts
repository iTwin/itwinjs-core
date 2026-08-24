/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Geometry } from "@itwin/core-geometry";

export interface DeepEqualWithFpToleranceOpts {
  /** Tolerance for fields; defaults to 1e-10. */
  tolerance?: number;
  /** Treat `{x: undefined}` and `{}` as deeply equal when true. */
  considerNonExistingAndUndefinedEqual?: boolean;
}

export const defaultOpts: Required<DeepEqualWithFpToleranceOpts> = {
  tolerance: 1e-10,
  considerNonExistingAndUndefinedEqual: false,
};

interface CustomMatchers<R = unknown> {
  toEqualWithFpTolerance: (expected: any, options?: DeepEqualWithFpToleranceOpts) => R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

/** Return whether two numbers are almost equal within a tolerance. */
const isAlmostEqualNumber = (a: number, b: number, tolerance: number): boolean => Geometry.isSameCoordinate(a, b, tolerance);

/**
 * Compare objects recursively while allowing numeric values to differ within a tolerance.
 */
export function deepEqualWithFpTolerance(a: any, b: any, options: DeepEqualWithFpToleranceOpts = {}): boolean {
  const opts = { ...defaultOpts, ...options };

  if (a === b)
    return true;
  if (typeof a !== typeof b)
    return false;

  switch (typeof a) {
    case "number":
      return isAlmostEqualNumber(a, b, opts.tolerance);
    case "string":
    case "boolean":
    case "function":
    case "symbol":
    case "undefined":
      return false;
    case "object":
      if ((a === null) !== (b === null))
        return false;

      return Object.keys(a).filter((key) => !opts.considerNonExistingAndUndefinedEqual || a[key] !== undefined).length ===
        Object.keys(b).filter((key) => !opts.considerNonExistingAndUndefinedEqual || b[key] !== undefined).length &&
        Object.keys(a).every(
          (key) =>
            (key in b || opts.considerNonExistingAndUndefinedEqual) &&
            deepEqualWithFpTolerance(a[key], b[key], opts),
        );
    default:
      throw new Error("unhandled deep compare type");
  }
}

/** Install the floating-point matcher used by the frontend tests. */
export function installVitestMatchers(): void {
  expect.extend({
    toEqualWithFpTolerance(received: any, expected: any, options: DeepEqualWithFpToleranceOpts = {}) {
      const tolerance = options.tolerance ?? defaultOpts.tolerance;
      const pass = typeof received === "number" && typeof expected === "number"
        ? isAlmostEqualNumber(received, expected, tolerance)
        : deepEqualWithFpTolerance(received, expected, options);
      return {
        pass,
        message: () => `expected ${String(received)} ${pass ? "not " : ""}to equal ${String(expected)} with a tolerance of ${tolerance}`,
      };
    },
  });
}
