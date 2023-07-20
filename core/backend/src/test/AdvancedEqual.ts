/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Assertion, util } from "chai";
import { Geometry } from "@itwin/core-geometry";

interface DeepEqualOpts {
  /**
   * Tolerance for number fields, if not defined will be 1e-10
   * If you don't want a tolerance, either supply 0 or use regular .deep.equal
   */
  tolerance?: number;
  /** e.g. consider {x: undefined} and {} as deeply equal */
  considerNonExistingAndUndefinedEqual?: boolean;
  /** Specify standard property keys holding ec class identifiers (when true, `classFullName` and `relClassName`)
   * to be normalized during comparison so that differently cased and alternative syntax still is considered equal
   * Passing `true`, is the same as passing `["classFullName", "relClassName"]`
   */
  normalizeClassNameProps?: boolean | string[];
}

export const defaultOpts = {
  tolerance: 1e-10,
  considerNonExistingAndUndefinedEqual: false,
} as const;

declare global {
  namespace Chai {
    interface Deep {
      advancedEqual(actual: any, options?: DeepEqualOpts): Assertion;
      subsetEqual(actual: any, options?: DeepEqualOpts): Assertion;
    }
  }
}

/** get whether two numbers are almost equal within a tolerance  */
const isAlmostEqualNumber: (a: number, b: number, tol: number) => boolean = (a, b, tol) => Geometry.isSameCoordinate(a, b, tol);

/** normalize a classname for comparisons */
const normalizeClassName = (name: string) => name.toLowerCase().replace(/:/, ".");

interface AdvancedEqualFuncOpts extends DeepEqualOpts {
  /** only test */
  useSubsetEquality?: boolean;
}

/**
 * The diff shown on failure will show undefined fields as part of the diff even if
 * consideringNonExistingAndUndefinedEqual is true. You can ignore that.
 * We would have to mutate the object to clean the diff, although it is worth considering.
 */
export function advancedDeepEqual(
  e: any,
  a: any,
  options: AdvancedEqualFuncOpts = {},
): boolean {
  const normalizedClassNameProps
    = options.normalizeClassNameProps === true
      ? ["classFullName", "relClassName"]
      : options.normalizeClassNameProps || [];
  if (options.tolerance === undefined)
    options.tolerance = defaultOpts.tolerance;
  if (e === a)
    return true;
  if (typeof e !== typeof a)
    return false;
  switch (typeof e) {
    case "number":
      return isAlmostEqualNumber(e, a, options.tolerance);
    case "string":
    case "boolean":
    case "function":
    case "symbol":
    case "undefined":
      return false; // these objects can only be strict equal which was already tested
    case "object":
      if ((e === null) !== (a === null))
        return false;
      const eSize = Object.keys(e).filter((k) => options.considerNonExistingAndUndefinedEqual && e[k] !== undefined).length;
      const aSize = Object.keys(a).filter((k) => options.considerNonExistingAndUndefinedEqual && a[k] !== undefined).length;
      return (eSize === aSize || !!options.useSubsetEquality) && Object.keys(e).every(
        (keyOfE) =>
          (keyOfE in a || options.considerNonExistingAndUndefinedEqual) &&
          normalizedClassNameProps.includes(keyOfE)
            ? advancedDeepEqual(normalizeClassName(e[keyOfE]), normalizeClassName(a[keyOfE]))
            : advancedDeepEqual(e[keyOfE], a[keyOfE], options),
      );
    default: // bigint unhandled
      throw Error(`unhandled deep compare type code returned from typeof, "${typeof e}"`);
  }
}

Assertion.addMethod(
  "advancedEqual",
  function advancedEqual(
    expected: any,
    options: DeepEqualOpts = {},
  ) {
    if (options.tolerance === undefined)
      options.tolerance = 1e-10;
    const actual = this._obj;
    const isDeep = util.flag(this, "deep");
    this.assert(
      isDeep
        ? advancedDeepEqual(expected, actual, options)
        : isAlmostEqualNumber(expected, actual, options.tolerance),
      `expected ${
        isDeep ? "deep equality of " : " "
      }#{exp} and #{act} with a tolerance of ${options.tolerance}`,
      `expected ${
        isDeep ? "deep inequality of " : " "
      }#{exp} and #{act} with a tolerance of ${options.tolerance}`,
      expected,
      actual,
    );
  },
);

Assertion.addMethod(
  "subsetEqual",
  function subsetEqual(
    expected: any,
    options: DeepEqualOpts = {},
  ) {
    if (options.tolerance === undefined)
      options.tolerance = 1e-10;
    const actual = this._obj;
    this.assert(
      advancedDeepEqual(expected, actual, {...options, useSubsetEquality: true }),
      `expected #{act} to contain as a subset #{exp}`,
      `expected #{act} not to contain as a subset #{exp}`,
      expected,
      actual,
    );
  },
);
