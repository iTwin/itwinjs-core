/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { AccessToken } from "@bentley/bentleyjs-core";
import { IModelRpcProps, RpcActivity, SyncMode } from "@bentley/imodeljs-common";
import { IModelDb } from "../../IModelDb";
import { RpcBriefcaseUtility } from "../../rpc-impl/RpcBriefcaseUtility";

describe("RpcBriefcaseUtility.findOrOpen", () => {
  afterEach(() => {
    sinon.restore();
  });

  const fakeRpc: RpcActivity = {
    accessToken: "fake",
    activityId: "",
    applicationId: "",
    applicationVersion: "",
    sessionId: "",
  };

  it("should return open SnapshotDb and call reattachDaemon", async () => {
    const reattachStub = sinon.stub<[AccessToken], Promise<void>>();
    const fakeIModel: IModelDb = { reattachDaemon: reattachStub } as any;
    sinon.stub(IModelDb, "tryFindByKey").returns(fakeIModel);

    const result = await RpcBriefcaseUtility.findOrOpen(fakeRpc, {} as any, SyncMode.FixedVersion) as any;

    expect(result).to.equal(fakeIModel);
    expect(reattachStub.calledOnce).to.be.true;
    expect(reattachStub.firstCall.firstArg).to.equal(fakeRpc.accessToken);
  });

  it("should open BriefcaseDb if not already open", async () => {
    const fakeIModelProps: IModelRpcProps = "fakeProps" as any;
    const reattachStub = sinon.stub(IModelDb.prototype, "reattachDaemon");
    const openStub = sinon.stub(RpcBriefcaseUtility, "open").resolves("fakeIModel" as any);
    sinon.stub(IModelDb, "tryFindByKey").returns(undefined);

    const result = await RpcBriefcaseUtility.findOrOpen(fakeRpc, fakeIModelProps, "fakeSyncMode" as any) as any;

    expect(result).to.equal("fakeIModel");
    expect(reattachStub.called).to.be.false;
    expect(openStub.calledOnce).to.be.true;
    expect(Object.keys(openStub.firstCall.firstArg).length).to.equal(4);
    expect(openStub.firstCall.firstArg.activity).to.equal(fakeRpc);
    expect(openStub.firstCall.firstArg.tokenProps).to.equal(fakeIModelProps);
    expect(openStub.firstCall.firstArg.syncMode).to.equal("fakeSyncMode");
    expect(openStub.firstCall.firstArg.timeout).to.be.greaterThan(0);
  });
});
