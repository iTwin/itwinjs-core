/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { AuthorizedBackendRequestContext, IModelHost, PhysicalElement } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";

// Configuration needed
//    imjs_test_manager_user_name
//    imjs_test_manager_user_password
//    imjs_oidc_browser_test_client_id
//    imjs_oidc_browser_test_redirect_uri
//    imjs_oidc_browser_test_scopes
//      - Required: "openid imodelhub context-registry-service:read-only"

describe("Schema XML Import Tests (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let testContextId: string;
  let readWriteTestIModelId: GuidString;

  before(async () => {
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

    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: testContextId, iModelId: readWriteTestIModelId });
    requestContext.enter();
    await iModel.importSchemaStrings(requestContext, [schemaString]); // will throw an exception if import fails
    requestContext.enter();

    const testDomainClass = iModel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });

});
