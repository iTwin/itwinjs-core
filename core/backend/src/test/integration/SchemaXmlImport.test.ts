/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedBackendRequestContext, IModelHost, PhysicalElement } from "../../imodeljs-backend";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";

// Configuration needed
//    IMJS_TEST_MANAGER_USER_NAME
//    IMJS_TEST_MANAGER_USER_PASSWORD
//    IMJS_OIDC_BROWSER_TEST_CLIENT_ID
//    IMJS_OIDC_BROWSER_TEST_REDIRECT_URI
//    IMJS_OIDC_BROWSER_TEST_SCOPES
//      - Required: "openid imodelhub context-registry-service:read-only"

describe("Schema XML Import Tests (#integration)", () => {
  let user: AuthorizedBackendRequestContext;
  let testContextId: string;
  let readWriteTestIModelId: GuidString;

  before(async () => {
    HubMock.startup("schemaImport");
    user = await IModelTestUtils.getUserContext(TestUserType.Manager);
    testContextId = await HubUtility.getTestITwinId(user);
    readWriteTestIModelId = await HubUtility.recreateIModel({ user, iTwinId: testContextId, iModelName: HubUtility.generateUniqueName("ReadWriteTest"), noLocks: true });
  });

  after(async () => {
    try {
      await IModelHost.hubAccess.deleteIModel({ user, iTwinId: testContextId, iModelId: readWriteTestIModelId });
      HubMock.shutdown();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ user, iTwinId: testContextId, iModelId: readWriteTestIModelId });
    await iModel.importSchemaStrings(user, [schemaString]); // will throw an exception if import fails

    const testDomainClass = iModel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
    iModel.close();
  });

});
