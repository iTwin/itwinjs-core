/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Assertion, util } from "chai";
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

/** Resolve a CommonJS Chai plugin from either Vite's namespace shape or its default export. */
export function resolveChaiPlugin(module: unknown): Chai.ChaiPlugin {
  if (typeof module === "function")
    return module as Chai.ChaiPlugin;

  const defaultExport = (module as { default?: unknown } | undefined)?.default;
  if (typeof defaultExport === "function")
    return defaultExport as Chai.ChaiPlugin;

  throw new TypeError("Expected a Chai plugin function");
}

declare global {
  namespace Chai {
    interface Deep {
      equalWithFpTolerance(actual: any, options?: DeepEqualWithFpToleranceOpts): Assertion;
    }
  }
}

/** Return whether two numbers are almost equal within a tolerance. */
const isAlmostEqualNumber = (a: number, b: number, tolerance: number): boolean => Geometry.isSameCoordinate(a, b, tolerance);

/**
 * Compare objects recursively while allowing numeric values to differ within a tolerance.
 * The failure diff is intentionally left to Chai.
 */
export function deepEqualWithFpTolerance(a: any, b: any, options: DeepEqualWithFpToleranceOpts = {}): boolean {
  if (options.tolerance === undefined)
    options.tolerance = defaultOpts.tolerance;

  if (a === b)
    return true;
  if (typeof a !== typeof b)
    return false;

  switch (typeof a) {
    case "number":
      return isAlmostEqualNumber(a, b, options.tolerance);
    case "string":
    case "boolean":
    case "function":
    case "symbol":
    case "undefined":
      return false;
    case "object":
      if ((a === null) !== (b === null))
        return false;

      const aSize = Object.keys(a).filter((key) => options.considerNonExistingAndUndefinedEqual && a[key] !== undefined).length;
      const bSize = Object.keys(b).filter((key) => options.considerNonExistingAndUndefinedEqual && b[key] !== undefined).length;
      return aSize === bSize && Object.keys(a).every(
        (key) =>
          (key in b || options.considerNonExistingAndUndefinedEqual === true) &&
          deepEqualWithFpTolerance(a[key], b[key], options),
      );
    default:
      throw new Error("unhandled deep compare type");
  }
}

/** Install the Chai assertion shared by Certa and Vitest runs. */
export function installChaiAssertions(): void {
  Assertion.addMethod("equalWithFpTolerance", function equalWithFpTolerance(expected: any, options: DeepEqualWithFpToleranceOpts = {}) {
    const tolerance = options.tolerance ?? defaultOpts.tolerance;
    const actual = this._obj;
    const isDeep = util.flag(this, "deep");
    this.assert(
      isDeep
        ? deepEqualWithFpTolerance(expected, actual, options)
        : isAlmostEqualNumber(expected, actual, tolerance),
      `expected ${isDeep ? "deep equality of " : " "}#{exp} and #{act} with a tolerance of ${tolerance}`,
      `expected ${isDeep ? "deep inequality of " : " "}#{exp} and #{act} with a tolerance of ${tolerance}`,
      expected,
      actual,
    );
  });
}
