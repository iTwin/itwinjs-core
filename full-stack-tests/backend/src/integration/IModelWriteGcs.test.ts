/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { IModelVersion } from "@itwin/core-common";
import { IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils, KnownTestLocations, TestUserType, withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { setupIntegrationLogging } from "./StartupShutdown";

// These tests exercise GCS-derived ECEF recomputation, which requires GCS data loaded from cloud
// workspaces. They run as integration tests because they make network requests to download GCS
// workspaces from cloud containers, which the core-backend unit-test harness disables by default.
describe("IModelWrite GCS", () => {
  let iTwinId: GuidString;

  before(async () => {
    setupIntegrationLogging();
    await IModelHost.startup();
    HubMock.startup("IModelWriteGcsTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });

  after(async () => {
    HubMock.shutdown();
    await IModelHost.shutdown();
  });

  it("pulling a changeset with extents changes should update the extents of the opened imodel", async () => {
    const accessToken: AccessToken = await HubWrappers.getAccessToken(TestUserType.Regular);
    const version0 = IModelTestUtils.resolveAssetFile("mirukuru.ibim");
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "projectExtentsTest", version0 });
    const iModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId });
    const changesetIdBeforeExtentsChange = iModel.changeset.id;
    const extents = iModel.projectExtents;
    const newExtents = extents.clone();
    newExtents.low.x += 100;
    newExtents.low.y += 100;
    newExtents.high.x += 100;
    newExtents.high.y += 100;
    withEditTxn(iModel, "update project extents", (txn) => txn.updateProjectExtents(newExtents));
    await iModel.pushChanges({ description: "update project extents" });
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);
    const iModelBeforeExtentsChange = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId, asOf: IModelVersion.asOfChangeSet(changesetIdBeforeExtentsChange).toJSON() });
    const extentsBeforePull = iModelBeforeExtentsChange.projectExtents;
    // Read the extents fileProperty.
    const extentsStrBeforePull = iModelBeforeExtentsChange.queryFilePropertyString({ name: "Extents", namespace: "dgn_Db" });
    const ecefLocationBeforeExtentsChange = iModelBeforeExtentsChange.ecefLocation;
    await iModelBeforeExtentsChange.pullChanges(); // Pulls the extents change.
    const extentsAfterPull = iModelBeforeExtentsChange.projectExtents;
    const extentsStrAfterPull = iModelBeforeExtentsChange.queryFilePropertyString({ name: "Extents", namespace: "dgn_Db" });
    const ecefLocationAfterExtentsChange = iModelBeforeExtentsChange.ecefLocation;

    assert.isDefined(ecefLocationBeforeExtentsChange);
    assert.isDefined(ecefLocationAfterExtentsChange);
    expect(ecefLocationBeforeExtentsChange?.isAlmostEqual(ecefLocationAfterExtentsChange!)).to.be.false;
    expect(extentsStrAfterPull).to.not.equal(extentsStrBeforePull);
    expect(extentsAfterPull.isAlmostEqual(extentsBeforePull)).to.be.false;
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModelBeforeExtentsChange);
  });
});
