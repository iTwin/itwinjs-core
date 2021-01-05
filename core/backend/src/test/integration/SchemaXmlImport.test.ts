/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { AuthorizedBackendRequestContext, IModelHost, PhysicalElement } from "../../imodeljs-backend";
import { IModelTestUtils, TestIModelInfo } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";

describe("Schema XML Import Tests (#integration)", () => {
  let managerRequestContext: AuthorizedBackendRequestContext;
  let superRequestContext: AuthorizedBackendRequestContext;
  let testProjectId: string;
  let readWriteTestIModel: TestIModelInfo;

  let readWriteTestIModelName: string;

  before(async () => {
    // initialize logging
    if (true) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }

    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    superRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.super);
    testProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");
    readWriteTestIModelName = HubUtility.generateUniqueName("ReadWriteTest");

    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
    await IModelHost.iModelClient.iModels.create(managerRequestContext, testProjectId, readWriteTestIModelName, { description: "TestSubject" });
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, readWriteTestIModelName);

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
  });

  after(async () => {
    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: superRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    await iModel.importSchemaStrings(superRequestContext, [schemaString]); // will throw an exception if import fails

    const testDomainClass = iModel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });

});
