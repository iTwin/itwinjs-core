/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, GuidString, ITwinError } from "@itwin/core-bentley";
import { IModelVersion } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { assert, expect } from "chai";
import { BriefcaseManager, IModelHost } from "@itwin/core-backend";
import { _hubAccess } from "@itwin/core-backend/lib/cjs/internal/Symbols";
import { HubWrappers } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { HubUtility } from "../HubUtility";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

describe("IModelOpen", () => {
  let accessToken: AccessToken;
  let testIModelId: GuidString;
  let testITwinId: GuidString;

  before(async () => {
    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);

    testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
  });

  const deleteTestIModelCache = () => {
    const path = BriefcaseManager.getIModelPath(testIModelId);
    (BriefcaseManager as any).deleteFolderAndContents(path);
  };

  it("Unauthorized requests should cause an obvious error", async () => {
    // Try the bad request context
    await expect(HubWrappers.downloadAndOpenCheckpoint({ accessToken: "bad", iTwinId: testITwinId, iModelId: testIModelId }))
      .to.be.rejectedWith(Error)
      .to.eventually.have.property("originalError")
      .that.has.property("iTwinErrorId")
      .that.has.property("key", "InvalidiModelsRequest");
  });

  it("should be able to open a version that requires many merges", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const changesets = await IModelHost[_hubAccess].queryChangesets({ accessToken, iModelId: testIModelId });
    const numChangeSets = changesets.length;
    assert.isAbove(numChangeSets, 10);

    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(changesets[9].id).toJSON() });
    assert.isDefined(iModel);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);
  });

});
