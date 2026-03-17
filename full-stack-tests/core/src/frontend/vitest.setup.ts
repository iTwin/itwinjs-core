/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Vitest setup file — registers Chai plugins, initializes RPC client, and sets error handling.
// Referenced via `setupFiles` in vitest.config.mts. Does NOT contain test assertions.

import { Assertion, util } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinonChai from "sinon-chai";
import chai from "chai";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { Geometry } from "@itwin/core-geometry";

// --- Chai plugin registration ---
chai.use(chaiAsPromised);
chai.use(sinonChai);

// --- RPC configuration ---
RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;

// --- Custom Chai assertion: equalWithFpTolerance ---
interface DeepEqualWithFpToleranceOpts {
  tolerance?: number;
  considerNonExistingAndUndefinedEqual?: boolean;
}

export const defaultOpts = {
  tolerance: 1e-10,
  considerNonExistingAndUndefinedEqual: false,
};

declare global {
  namespace Chai {
    interface Deep {
      equalWithFpTolerance(actual: any, options?: DeepEqualWithFpToleranceOpts): Assertion;
    }
  }
}

const isAlmostEqualNumber: (a: number, b: number, tol: number) => boolean = (a, b, tol) => Geometry.isSameCoordinate(a, b, tol);

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
      return false;
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
    default:
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

// --- RPC client init (Chrome/web mode only) ---
// Explicit backend port — must match BackendServer.ts
const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT || 5010);

if (!ProcessDetector.isElectronAppFrontend) {
  const params: BentleyCloudRpcParams = {
    info: { title: "full-stack-test", version: "v1.0" },
    pathPrefix: `http://localhost:${backendPort}`,
  };
  BentleyCloudRpcManager.initializeClient(params, rpcInterfaces);
}

// --- Error handling ---
UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);
