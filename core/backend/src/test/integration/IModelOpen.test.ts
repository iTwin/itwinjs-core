/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, BentleyError, GuidString } from "@itwin/core-bentley";
import { IModelVersion } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { assert, expect } from "chai";
import { SnapshotDb } from "../../IModelDb";
import { BriefcaseManager, IModelHost } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

describe("IModelOpen (#integration)", () => {

  let accessToken: AccessToken;
  let testIModelId: GuidString;
  let testITwinId: GuidString;

  before(async () => {
    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);

    testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
  });

  const deleteTestIModelCache = () => {
    const path = (BriefcaseManager as any).getIModelPath(testIModelId);
    (BriefcaseManager as any).deleteFolderAndContents(path);
  };

  it("Unauthorized requests should cause an obvious error", async () => {
    // Try the bad request context
    await expect(IModelTestUtils.downloadAndOpenCheckpoint({ accessToken: "bad", iTwinId: testITwinId, iModelId: testIModelId }))
      .to.be.rejectedWith(BentleyError).to.eventually.have.property("status", 401);

  });

  it("should be able to handle simultaneous open calls", async () => {
    // Clean folder to re-fetch briefcase
    deleteTestIModelCache();

    const numTries = 100;

    // Open iModel with no timeout, and ensure all promises resolve to the same briefcase
    const openPromises = new Array<Promise<SnapshotDb>>();
    for (let ii = 0; ii < numTries; ii++) {
      const open = IModelTestUtils.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId });
      openPromises.push(open);
    }
    const iModels = await Promise.all(openPromises);
    const pathname = iModels[0].pathName;
    for (let ii = 1; ii < numTries; ii++) {
      assert.strictEqual(iModels[ii].pathName, pathname);
    }
    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModels[0]);
  });

  it("should be able to open a version that requires many merges", async () => {
    // Clean folder to refetch briefcase
    deleteTestIModelCache();

    const changeSets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: testIModelId });
    const numChangeSets = changeSets.length;
    assert.isAbove(numChangeSets, 10);

    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(changeSets[9].id).toJSON() });
    assert.isDefined(iModel);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel);
  });

});
