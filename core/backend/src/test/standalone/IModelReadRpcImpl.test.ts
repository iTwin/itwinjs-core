/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CompressedId64Set, IModelStatus } from "@itwin/core-bentley";
import { IModelError, IModelReadRpcInterface, RpcActivity, RpcManager, RpcRegistry } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelHost, IModelHostConfiguration } from "../../IModelHost";
import { RpcTrace } from "../../rpc/tracing";
import { IModelTestUtils } from "../IModelTestUtils";

const fakeRpc: RpcActivity = {
  accessToken: "dummy",
  activityId: "activity123",
  applicationId: "rpc test app",
  applicationVersion: "1.2.3",
  sessionId: "session 123",
};

describe("IModelReadRpcImpl compressed Id limits", () => {
  // 11 characters representing 4,294,967,295 Ids.
  const hugeIds = "+1*FFFFFFFF";

  let imodel: SnapshotDb;
  let rpc: IModelReadRpcInterface;

  before(() => {
    imodel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    RpcManager.initializeInterface(IModelReadRpcInterface);
    rpc = RpcRegistry.instance.getImplForInterface<IModelReadRpcInterface>(IModelReadRpcInterface);
  });

  after(() => imodel.close());

  async function expectTooManyIds(func: () => Promise<unknown>, argName: string): Promise<void> {
    let error: unknown;
    try {
      await RpcTrace.run(fakeRpc, func);
    } catch (err) {
      error = err;
    }

    expect(error).instanceOf(IModelError);
    expect((error as IModelError).errorNumber).to.equal(IModelStatus.BadArg);
    expect((error as IModelError).message).to.include(argName).and.include("exceeds the maximum");
  }

  it("defaults the limit to one million Ids", () => {
    expect(IModelHostConfiguration.defaultMaxRpcCompressedIdCount).to.equal(1000000);
    expect(IModelHost.maxRpcCompressedIdCount).to.equal(IModelHostConfiguration.defaultMaxRpcCompressedIdCount);
  });

  it("rejects oversized CompressedId64Set arguments before decompressing them", async () => {
    const tokenProps = imodel.getRpcProps();
    await expectTooManyIds(async () => rpc.querySubCategories(tokenProps, hugeIds), "categoryIds");
    await expectTooManyIds(async () => rpc.getMassPropertiesPerCandidate(tokenProps, { candidates: hugeIds, operations: [] }), "candidates");
    await expectTooManyIds(async () => rpc.getCustomViewState3dData(tokenProps, { modelIds: hugeIds }), "modelIds");
    await expectTooManyIds(async () => rpc.hydrateViewState(tokenProps, { notLoadedModelSelectorStateModels: hugeIds }), "notLoadedModelSelectorStateModels");
    await expectTooManyIds(async () => rpc.hydrateViewState(tokenProps, { sheetViewAttachmentIds: hugeIds }), "sheetViewAttachmentIds");

    // Splitting the Ids across multiple runs does not bypass the limit.
    await expectTooManyIds(async () => rpc.querySubCategories(tokenProps, "+1*80000+1*80000"), "categoryIds");
  });

  it("honors a configured limit", async () => {
    const config = IModelHost.configuration!;
    const prevLimit = config.maxRpcCompressedIdCount;
    config.maxRpcCompressedIdCount = 3;
    try {
      const tokenProps = imodel.getRpcProps();
      const categoryIds = imodel.queryEntityIds({ from: "BisCore.Category", limit: 3 });
      expect(categoryIds.size).to.equal(3);

      const result = await RpcTrace.run(fakeRpc, async () => rpc.querySubCategories(tokenProps, CompressedId64Set.sortAndCompress(categoryIds)));
      expect(result.length).to.be.greaterThan(0);

      await expectTooManyIds(async () => rpc.querySubCategories(tokenProps, "+1*4"), "categoryIds");
    } finally {
      config.maxRpcCompressedIdCount = prevLimit;
    }
  });
});
