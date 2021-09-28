/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { IModelHost, IModelJsFs } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Useful utilities to download/upload test cases from/to iModelHub
describe("ApplyChangesets (#integration)", () => {
  const testAllChangeSetOperations = async (requestContext: AuthorizedClientRequestContext, iTwinId: string, iModelId: GuidString) => {
    const iModelDir = path.join(IModelHost.cacheDir, iModelId.toString());
    await HubUtility.validateAllChangeSetOperations(requestContext, iTwinId, iModelId, iModelDir);
    IModelJsFs.purgeDirSync(iModelDir);
  };

  const testOpen = async (user: AuthorizedClientRequestContext, iTwinId: string, iModelId: string) => {
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ user, iTwinId, iModelId });
    assert.isDefined(iModelDb);
    iModelDb.close();
  };

  const testAllOperations = async (requestContext: AuthorizedClientRequestContext, iTwinId: string, iModelId: GuidString) => {
    await testOpen(requestContext, iTwinId, iModelId);
    await testAllChangeSetOperations(requestContext, iTwinId, iModelId);
  };

  it("should test all changeset operations after downloading iModel from the hub (#integration)", async () => {
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);

    const iTwinId = await HubUtility.getTestITwinId(requestContext);
    let iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readOnly);
    await testAllOperations(requestContext, iTwinId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readWrite);
    await testAllOperations(requestContext, iTwinId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.noVersions);
    await testAllOperations(requestContext, iTwinId, iModelId);
  });
});
