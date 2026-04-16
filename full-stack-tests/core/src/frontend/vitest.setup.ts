/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Vitest setup file — registers custom matchers, initializes RPC client, and sets error handling.
// Referenced via `setupFiles` in vitest.config.mts. Does NOT contain test assertions.

import { afterEach, beforeEach, expect } from "vitest";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { Geometry } from "@itwin/core-geometry";
import { TestUtility } from "./TestUtility";

// --- Global cleanup hooks (best-effort iModel connection cleanup across all suites) ---
// Intentionally non-throwing: we close leaked connections to prevent cascading failures
// in subsequent tests, but we do NOT fail the test on leak detection here. Tests that
// want strict leak detection should call TestUtility.cleanupOpenIModels({ failOnLeaks: true })
// explicitly in their own afterEach. Throwing from this global hook made the suite
// brittle in CI — any transient RPC hiccup or unexpected connection could fail an
// otherwise-passing test, and the extra RPC work inflated hook times near the timeout.
beforeEach(() => {
  TestUtility.beginTestCleanupScope();
});

afterEach(async () => {
  try {
    await TestUtility.cleanupOpenIModels({ failOnLeaks: false });
  } catch {
    // Never let cleanup errors fail a test. Cleanup is best-effort.
  }
});

// --- RPC configuration ---
RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;

// --- Custom Vitest matcher: equalWithFpTolerance ---
interface DeepEqualWithFpToleranceOpts {
  tolerance?: number;
  considerNonExistingAndUndefinedEqual?: boolean;
}

const defaultOpts = {
  tolerance: 1e-10,
  considerNonExistingAndUndefinedEqual: false,
};

const isAlmostEqualNumber = (a: number, b: number, tol: number) => Geometry.isSameCoordinate(a, b, tol);

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

      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (options.considerNonExistingAndUndefinedEqual) {
        if (aKeys.filter((k) => a[k] !== undefined).length !== bKeys.filter((k) => b[k] !== undefined).length)
          return false;
      } else {
        if (aKeys.length !== bKeys.length)
          return false;
      }
      return aKeys.every(
        (key) =>
          (key in b || options.considerNonExistingAndUndefinedEqual) &&
          deepEqualWithFpTolerance(a[key], b[key], options),
      );
    default:
      throw Error("unhandled deep compare type");
  }
}

// Register as Vitest custom matcher
expect.extend({
  equalWithFpTolerance(received: any, expected: any, options: DeepEqualWithFpToleranceOpts = {}) {
    const tolerance = options.tolerance ?? defaultOpts.tolerance;
    const pass = typeof received === "number" && typeof expected === "number"
      ? isAlmostEqualNumber(received, expected, tolerance)
      : deepEqualWithFpTolerance(received, expected, options);
    return {
      pass,
      message: () => pass
        ? `expected ${JSON.stringify(received)} not to equal ${JSON.stringify(expected)} with tolerance ${tolerance}`
        : `expected ${JSON.stringify(received)} to equal ${JSON.stringify(expected)} with tolerance ${tolerance}`,
    };
  },
});

// Type augmentation for custom matcher
declare module "vitest" {
  interface Assertion {
    equalWithFpTolerance(expected: any, options?: { tolerance?: number; considerNonExistingAndUndefinedEqual?: boolean }): void;
  }
}

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
