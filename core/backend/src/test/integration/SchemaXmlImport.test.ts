/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { AccessToken, GuidString } from "@bentley/bentleyjs-core";
import { IModelHost, PhysicalElement } from "../../imodeljs-backend";
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
  let accessToken: AccessToken;
  let testContextId: string;
  let readWriteTestIModelId: GuidString;

  before(async () => {
    HubMock.startup("schemaImport");
    accessToken = await IModelTestUtils.getAccessToken(TestUserType.Manager);
    testContextId = await HubUtility.getTestITwinId(accessToken);
    readWriteTestIModelId = await HubUtility.recreateIModel({ accessToken, iTwinId: testContextId, iModelName: HubUtility.generateUniqueName("ReadWriteTest"), noLocks: true });
  });

  after(async () => {
    try {
      await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId: testContextId, iModelId: readWriteTestIModelId });
      HubMock.shutdown();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ accessToken, iTwinId: testContextId, iModelId: readWriteTestIModelId });
    await iModel.importSchemaStrings([schemaString]); // will throw an exception if import fails

    const testDomainClass = iModel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
    iModel.close();
  });

});
