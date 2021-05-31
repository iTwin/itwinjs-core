/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelRpcProps, SyncMode } from "@bentley/imodeljs-common";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { V2CheckpointManager } from "../../CheckpointManager";
import { IModelDb } from "../../IModelDb";
import { IModelReadRpcImpl } from "../../rpc-impl/IModelReadRpcImpl";
import { RpcBriefcaseUtility } from "../../rpc-impl/RpcBriefcaseUtility";

describe("IModelReadRpcImpl", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should call IModelDb.findOrOpen", async () => {
    sinon.stub(ClientRequestContext, "current").returns("fakeRequestContext");
    const findOrOpenStub = sinon.stub(IModelDb, "findOrOpen").callsFake(async () => ({} as IModelDb));
    await new IModelReadRpcImpl().getModelProps("fake" as any, []);
    assert.isTrue(findOrOpenStub.calledOnceWith("fakeRequestContext" as any, "fake" as any, SyncMode.FixedVersion));
  });
});

describe("IModelDb.findOrOpen", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should return open SnapshotDb", async () => {
    const fakeIModel: IModelDb = { isSnapshotDb: () => true, isV2Checkpoint: false } as any;
    const reattachStub = sinon.stub(V2CheckpointManager, "reattachIfNeeded");
    sinon.stub(IModelDb, "tryFindByKey").returns(fakeIModel);
    const result = await IModelDb.findOrOpen({} as any, {} as any, SyncMode.FixedVersion) as any;
    expect(result).to.equal(fakeIModel);
    expect(reattachStub.getCalls()).to.be.empty;
  });

  it("should return open V2 Checkpoint", async () => {
    const fakeIModel: IModelDb = { isSnapshotDb: () => true, isV2Checkpoint: true } as any;
    const reattachStub = sinon.stub(V2CheckpointManager, "reattachIfNeeded");
    sinon.stub(IModelDb, "tryFindByKey").returns(fakeIModel);

    const result = await IModelDb.findOrOpen("fakeRequestContext" as any, { fakeProp: "fake" } as any, SyncMode.FixedVersion) as any;

    expect(result).to.equal(fakeIModel);
    expect(reattachStub.getCalls().length).to.equal(1);
    expect(Object.keys(reattachStub.firstCall.firstArg).length).to.equal(3);
    expect(reattachStub.firstCall.firstArg.requestContext).to.equal("fakeRequestContext");
    expect(reattachStub.firstCall.firstArg.fakeProp).to.equal("fake");
    expect(reattachStub.firstCall.firstArg.expectV2).to.be.true;
  });

  it("should open BriefcaseDb if not already open", async () => {
    const fakeIModelProps: IModelRpcProps = "fakeProps" as any;
    const reattachStub = sinon.stub(V2CheckpointManager, "reattachIfNeeded");
    const openStub = sinon.stub(RpcBriefcaseUtility, "open").resolves("fakeIModel" as any);
    sinon.stub(IModelDb, "tryFindByKey").returns(undefined);

    const result = await IModelDb.findOrOpen("fakeRequestContext" as any, fakeIModelProps, "fakeSyncMode" as any) as any;

    expect(result).to.equal("fakeIModel");
    expect(reattachStub.getCalls()).to.be.empty;
    expect(openStub.getCalls().length).to.equal(1);
    expect(Object.keys(openStub.firstCall.firstArg).length).to.equal(4);
    expect(openStub.firstCall.firstArg.requestContext).to.equal("fakeRequestContext");
    expect(openStub.firstCall.firstArg.tokenProps).to.equal(fakeIModelProps);
    expect(openStub.firstCall.firstArg.syncMode).to.equal("fakeSyncMode");
    expect(openStub.firstCall.firstArg.timeout).to.be.greaterThan(0);
  });
});
