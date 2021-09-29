/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { AccessToken } from "@itwin/core-bentley";
import { IModelDb } from "../../IModelDb";
import { RpcBriefcaseUtility } from "../../rpc-impl/RpcBriefcaseUtility";

describe("RpcBriefcaseUtility.findOpenIModel", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should return open SnapshotDb and call reattachDaemon", async () => {
    const reattachStub = sinon.stub<[AccessToken], Promise<void>>();
    const fakeIModel: IModelDb = { reattachDaemon: reattachStub } as any;
    sinon.stub(IModelDb, "tryFindByKey").returns(fakeIModel);

    const result = await RpcBriefcaseUtility.findOpenIModel("fake", {} as any);

    expect(result).to.equal(fakeIModel);
    expect(reattachStub.calledOnce).to.be.true;
    expect(reattachStub.firstCall.firstArg).to.equal("fake");
  });

});
