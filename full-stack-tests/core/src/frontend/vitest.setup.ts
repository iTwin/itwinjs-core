/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinonChai from "sinon-chai";
import { afterEach, beforeEach } from "vitest";
import { ProcessDetector, UnexpectedErrors } from "@itwin/core-bentley";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, RpcConfiguration } from "@itwin/core-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";
import "./testHooks";
import { installChaiAssertions, resolveChaiPlugin } from "./testAssertions";

chai.use(resolveChaiPlugin(chaiAsPromised));
chai.use(resolveChaiPlugin(sinonChai));
installChaiAssertions();

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
