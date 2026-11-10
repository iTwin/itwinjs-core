/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BentleyError, CompressedId64Set, IModelStatus } from "@itwin/core-bentley";
import { IModelReadRpcInterface, RpcActivity, RpcManager, RpcRegistry } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelHostConfiguration } from "../../IModelHost";
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

  async function expectTooManyIds(func: () => Promise<unknown>): Promise<void> {
    let error: unknown;
    try {
      await RpcTrace.run(fakeRpc, func);
    } catch (err) {
      error = err;
    }

    expect(error).instanceOf(BentleyError);
    expect((error as BentleyError).errorNumber).to.equal(IModelStatus.BadArg);
    expect((error as BentleyError).message).to.include("exceeds the maximum");
  }

  it("applies the default limit of one million Ids at startup", () => {
    expect(IModelHostConfiguration.defaultMaxCompressedIdCount).to.equal(1000000);
    expect(CompressedId64Set.maxIdCount).to.equal(IModelHostConfiguration.defaultMaxCompressedIdCount);
  });

  it("rejects oversized CompressedId64Set arguments before decompressing them", async () => {
    const tokenProps = imodel.getRpcProps();
    await expectTooManyIds(async () => rpc.querySubCategories(tokenProps, hugeIds));
    await expectTooManyIds(async () => rpc.getMassPropertiesPerCandidate(tokenProps, { candidates: hugeIds, operations: [] }));
    await expectTooManyIds(async () => rpc.getCustomViewState3dData(tokenProps, { modelIds: hugeIds }));
    await expectTooManyIds(async () => rpc.hydrateViewState(tokenProps, { notLoadedModelSelectorStateModels: hugeIds }));
    await expectTooManyIds(async () => rpc.hydrateViewState(tokenProps, { sheetViewAttachmentIds: hugeIds }));

    // Splitting the Ids across multiple runs does not bypass the limit.
    await expectTooManyIds(async () => rpc.querySubCategories(tokenProps, "+1*80000+1*80000"));
  });

  it("honors a changed limit", async () => {
    const prevLimit = CompressedId64Set.maxIdCount;
    CompressedId64Set.maxIdCount = 3;
    try {
      const tokenProps = imodel.getRpcProps();
      const categoryIds = imodel.queryEntityIds({ from: "BisCore.Category", limit: 3 });
      expect(categoryIds.size).to.equal(3);

      const result = await RpcTrace.run(fakeRpc, async () => rpc.querySubCategories(tokenProps, CompressedId64Set.sortAndCompress(categoryIds)));
      expect(result.length).to.be.greaterThan(0);

      await expectTooManyIds(async () => rpc.querySubCategories(tokenProps, "+1*4"));
    } finally {
      CompressedId64Set.maxIdCount = prevLimit;
    }
  });
});