/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";

import { BridgeTestUtils, TestIModelInfo } from "../BridgeTestUtils";
import { IModelJsFs } from "@bentley/imodeljs-backend";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BentleyStatus, Logger } from "@bentley/bentleyjs-core";
import { KnownTestLocations } from "../KnownTestLocations";
import { BridgeJobDefArgs, BridgeRunner, ServerArgs } from "../../BridgeRunner";
import { HubUtility } from "./HubUtility";

describe("IModelBridgeFwk (#integration)", () => {
  let testProjectId: string;

  let readWriteTestIModel: TestIModelInfo;

  let requestContext: AuthorizedClientRequestContext;
  let managerRequestContext: AuthorizedClientRequestContext;

  before(async () => {
    BridgeTestUtils.setupLogging();
    BridgeTestUtils.setupDebugLogLevels();
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);

    try {
      requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    } catch (error) {
      // tslint:disable-next-line: no-console
      Logger.logError("Error", `Failed with error: ${error}`);
    }

    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "IModelBridge_Test");
    const targetIModelId = await HubUtility.recreateIModel(requestContext, testProjectId, "iModleBridgeFwkReadWriteTest");
    expect(undefined !== targetIModelId);
    readWriteTestIModel = await BridgeTestUtils.getTestModelInfo(requestContext, testProjectId, "iModleBridgeFwkReadWriteTest");

    // Purge briefcases that are close to reaching the acquire limit
    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "iModleBridgeFwkReadWriteTest");
  });

  it("should download and perform updates", async () => {
    const bridgeJobDef = new BridgeJobDefArgs();
    bridgeJobDef.sourcePath = "TestBridge_input";
    bridgeJobDef.bridgeModule = "./test/integration/TestiModelBridge.js";
    bridgeJobDef.stagingdir = KnownTestLocations.outputDir;

    const serverArgs = new ServerArgs();
    serverArgs.contextId = testProjectId;
    serverArgs.iModelId = readWriteTestIModel.id;
    serverArgs.getToken = async (): Promise<AccessToken> => {
      return requestContext.accessToken;
    };
    const fwk = new BridgeRunner(bridgeJobDef, serverArgs);
    const status = await fwk.synchronize();
    expect(BentleyStatus.SUCCESS === status);
  });
});
