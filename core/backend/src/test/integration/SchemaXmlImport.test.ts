/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel, GuidString } from "@bentley/bentleyjs-core";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { AuthorizedBackendRequestContext, IModelHost, PhysicalElement } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";

describe("Schema XML Import Tests (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let testContextId: string;
  let readWriteTestIModelId: GuidString;

  before(async () => {
    // initialize logging
    if (true) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    testContextId = await HubUtility.getTestContextId(requestContext);
    requestContext.enter();
    readWriteTestIModelId = await HubUtility.recreateIModel(requestContext, testContextId, HubUtility.generateUniqueName("ReadWriteTest"));
    requestContext.enter();
  });

  after(async () => {
    try {
      await IModelHost.iModelClient.iModels.delete(requestContext, testContextId, readWriteTestIModelId);
    } catch (err) {
    }
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: requestContext, contextId: testContextId, iModelId: readWriteTestIModelId });
    requestContext.enter();
    await iModel.importSchemaStrings(requestContext, [schemaString]); // will throw an exception if import fails
    requestContext.enter();

    const testDomainClass = iModel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });

});
