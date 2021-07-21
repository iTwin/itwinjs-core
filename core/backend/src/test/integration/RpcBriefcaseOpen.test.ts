/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString } from "@bentley/bentleyjs-core";
import { SyncMode } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { BriefcaseDb } from "../../IModelDb";
import { AuthorizedBackendRequestContext, IModelHost, IModelJsFs } from "../../imodeljs-backend";
import { RpcBriefcaseUtility } from "../../rpc-impl/RpcBriefcaseUtility";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

describe("RpcBriefcaseOpen (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let contextId: GuidString;

  before(async () => {
    requestContext = await IModelTestUtils.getUserContext(TestUserType.Manager);
    contextId = await HubUtility.getTestContextId(requestContext);
  });

  it("should acquire a new briefcase when a briefcase that belongs to the user is not found on disk (PullAndPush)", async () => {
    HubMock.startup("RpcOpenTest");
    const iModelId = await HubUtility.createIModel(requestContext, contextId, "RpcOpenTest");
    const args = { requestContext, tokenProps: { contextId, iModelId, changeSetId: "" }, syncMode: SyncMode.PullAndPush };

    // Setup a briefcase on disk
    let iModel = await RpcBriefcaseUtility.open(args) as BriefcaseDb;
    const briefcaseId = iModel.getBriefcaseId();
    const pathname = iModel.pathName;
    iModel.close();
    assert.isTrue(IModelJsFs.existsSync(pathname));

    // File still on disk - reopen should just reuse the same briefcase
    iModel = await RpcBriefcaseUtility.open(args) as BriefcaseDb;
    assert.strictEqual(iModel.briefcaseId, briefcaseId);
    assert.strictEqual(iModel.pathName, pathname);

    // Close and delete local file
    iModel.close();
    IModelJsFs.unlinkSync(pathname);
    assert.isFalse(IModelJsFs.existsSync(pathname));

    // Reopen briefcase - should NOT use the same briefcase id
    iModel = await RpcBriefcaseUtility.open(args) as BriefcaseDb;
    const newBriefcaseId = iModel.getBriefcaseId();
    const newPathname = iModel.pathName;
    assert.notStrictEqual(newBriefcaseId, briefcaseId);
    assert.notStrictEqual(newPathname, pathname);
    iModel.close();

    // Cleanup
    IModelJsFs.unlinkSync(newPathname);
    await IModelHost.hubAccess.releaseBriefcase({ requestContext, iModelId, briefcaseId });
    await IModelHost.hubAccess.releaseBriefcase({ requestContext, iModelId, briefcaseId: newBriefcaseId });

    HubMock.shutdown();
  });

});
