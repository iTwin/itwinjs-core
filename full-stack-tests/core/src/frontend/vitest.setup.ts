/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach } from "vitest";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";
import { installVitestMatchers } from "./testMatchers";

installVitestMatchers();

RpcConfiguration.developmentMode = true;
RpcConfiguration.disableRoutingValidation = true;

if (!ProcessDetector.isElectronAppFrontend) {
  const params: BentleyCloudRpcParams = {
    info: { title: "full-stack-test", version: "v1.0" },
    pathPrefix: `http://${window.location.hostname}:${Number(window.location.port) + 2000}`,
  };
  BentleyCloudRpcManager.initializeClient(params, rpcInterfaces);
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
