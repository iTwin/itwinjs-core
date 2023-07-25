/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, Assertion, util } from "chai";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { Geometry } from "@itwin/core-geometry";

RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;
interface DeepEqualWithFpToleranceOpts {
  /**
   * Tolerance for fields, if not defined will be 1e-10
   * If you don't want a tolerance, either supply 0 or use regular .deep.equal
   */
  tolerance?: number;
  /** e.g. consider {x: undefined} and {} as deeply equal */
  considerNonExistingAndUndefinedEqual?: boolean;
}

export const defaultOpts = {
  tolerance: 1e-10,
  considerNonExistingAndUndefinedEqual: false,
};

declare global {
  namespace Chai {
    interface Deep {
      // might be more consistent to implement .approximately.deep.equal, but this is much simpler
      equalWithFpTolerance(actual: any, options?: DeepEqualWithFpToleranceOpts): Assertion;
    }
  }
}

/** get whether two numbers are almost equal within a tolerance  */
const isAlmostEqualNumber: (a: number, b: number, tol: number) => boolean = (a, b, tol) => Geometry.isSameCoordinate(a, b, tol);

/**
 * The diff shown on failure will show undefined fields as part of the diff even if
 * consideringNonExistingAndUndefinedEqual is true. You can ignore that.
 * We would have to mutate the object to clean the diff, although it is worth considering.
 */
export function deepEqualWithFpTolerance(
  a: any,
  b: any,
  options: DeepEqualWithFpToleranceOpts = {},
): boolean {
  if (options.tolerance === undefined)
    options.tolerance = defaultOpts.tolerance;

  if (a === b)
    return true;
  else if (typeof a !== typeof b)
    return false;

  switch (typeof a) {
    case "number":
      return isAlmostEqualNumber(a, b, options.tolerance);
    case "string":
    case "boolean":
    case "function":
    case "symbol":
    case "undefined":
      return false; // these objects can only be strict equal which was already tested
    case "object":
      if ((a === null) !== (b === null))
        return false;

      const aSize = Object.keys(a).filter((k) => options.considerNonExistingAndUndefinedEqual && a[k] !== undefined).length;
      const bSize = Object.keys(b).filter((k) => options.considerNonExistingAndUndefinedEqual && b[k] !== undefined).length;
      return aSize === bSize && Object.keys(a).every(
        (key) =>
          (key in b || options.considerNonExistingAndUndefinedEqual) &&
          deepEqualWithFpTolerance(a[key], b[key], options),
      );
    default: // bigint unhandled
      throw Error("unhandled deep compare type");
  }
}

Assertion.addMethod(
  "equalWithFpTolerance",
  function equalWithFpTolerance(
    expected: any,
    options: DeepEqualWithFpToleranceOpts = {},
  ) {
    if (options.tolerance === undefined)
      options.tolerance = 1e-10;

    const actual = this._obj;
    const isDeep = util.flag(this, "deep");
    this.assert(
      isDeep
        ? deepEqualWithFpTolerance(expected, actual, options)
        : isAlmostEqualNumber(expected, actual, options.tolerance),
      `expected ${isDeep ? "deep equality of " : " "
      }#{exp} and #{act} with a tolerance of ${options.tolerance}`,
      `expected ${isDeep ? "deep inequality of " : " "
      }#{exp} and #{act} with a tolerance of ${options.tolerance}`,
      expected,
      actual,
    );
  },
);

if (!ProcessDetector.isElectronAppFrontend) {
  const params: BentleyCloudRpcParams = {
    info: { title: "full-stack-test", version: "v1.0" },
    pathPrefix: `http://${window.location.hostname}:${Number(window.location.port) + 2000}`,
  };

  BentleyCloudRpcManager.initializeClient(params, rpcInterfaces);

  // This is a web-only test
  describe("Web Test Fixture", () => {
    it("Backend server should be accessible", async () => {
      const req = new XMLHttpRequest();
      req.open("GET", `${params.pathPrefix}/v3/swagger.json`);
      const loaded = new Promise((resolve) => req.addEventListener("load", resolve));
      req.send();
      await loaded;
      assert.equal(200, req.status);
      const desc = JSON.parse(req.responseText);
      assert.equal(desc.info.title, "full-stack-test");
      assert.equal(desc.info.version, "v1.0");
    });
  });
}

UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);
