/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeAll, beforeEach, inject } from "vitest";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { backendOriginFor } from "@itwin/vitest-browser-bridge/ports";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";
import { verifyChromeBackend } from "./ChromeBackendPreflight";

RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;

if (!ProcessDetector.isElectronAppFrontend) {
  const backendUrl = backendOriginFor(window.location);
  const params: BentleyCloudRpcParams = {
    info: { title: "full-stack-test", version: "v1.0" },
    pathPrefix: backendUrl,
  };
  BentleyCloudRpcManager.initializeClient(params, rpcInterfaces);
  beforeAll(async () => {
    try {
      await verifyChromeBackend(backendUrl, inject("coreChromeBackendId"));
    } catch (error) {
      try {
        const { commands } = await import("vitest/browser");
        await commands.reportCoreChromeBackendFailure(error instanceof Error ? error.message : String(error));
      } catch {
        // Preserve the transport failure if Vitest's own browser connection is also lost.
      }
      throw error;
    }
  });
}

UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);

beforeEach(() => {
  TestUtility.beginTestCleanupScope();
});

afterEach(async () => {
  const leakError = await TestUtility.cleanupOpenIModels({ failOnLeaks: true });
  if (leakError)
    throw leakError;
});
