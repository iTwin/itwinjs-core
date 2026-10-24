/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { IModelReadRpcInterface, RpcActivity, RpcManager, RpcRegistry } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { RpcTrace } from "../../rpc/tracing";
import { TestUtils } from "../TestUtils";
import { closeIfOpen, openReadonlySeedCopy } from "../imodel/IModelTestFixtures";

const fakeRpc: RpcActivity = {
  accessToken: "dummy",
  activityId: "activity123",
  applicationId: "rpc test app",
  applicationVersion: "1.2.3",
  sessionId: "session 123",
};

describe("IModelReadRpcImpl entity props", () => {
  let iModel: SnapshotDb;
  let rpc: IModelReadRpcInterface;

  before(async () => {
    await TestUtils.startBackend();
    iModel = await openReadonlySeedCopy("IModelReadRpcImpl.bim", "CompatibilityTestSeed.bim");
    RpcManager.initializeInterface(IModelReadRpcInterface);
    rpc = RpcRegistry.instance.getImplForInterface<IModelReadRpcInterface>(IModelReadRpcInterface);
  });

  after(() => closeIfOpen(iModel));
  afterEach(() => sinon.restore());

  const run = async <T>(fn: () => Promise<T>) => RpcTrace.run(fakeRpc, fn);
  const preloadedClasses = (spy: sinon.SinonSpy) => spy.getCalls().map((c) => c.args[0] as string).filter((sql) => sql.startsWith("SELECT $ FROM ")).map((sql) => sql.split(" ")[3]);

  it("queryEntityIds does not run synchronous queries on a read-only iModel", async () => {
    const params = { from: "bis.Element", orderBy: "ECInstanceId DESC" };
    const expected = [...iModel.queryEntityIds(params)];

    const syncQuery = sinon.spy(iModel, "queryEntityIds");
    const ids = await run(async () => rpc.queryEntityIds(iModel.getRpcProps(), params));
    expect(ids).to.deep.equal(expected);
    expect(syncQuery.called).to.be.false;
  });

  it("does not preload when the iModel is not backed by a cloud container", async () => {
    const ids = [...iModel.queryEntityIds({ from: "bis.Model" })];
    const queryReader = sinon.spy(iModel, "createQueryReader");
    await run(async () => rpc.getModelProps(iModel.getRpcProps(), ids));
    await run(async () => rpc.getElementProps(iModel.getRpcProps(), ids));
    expect(preloadedClasses(queryReader)).to.deep.equal([]);
  });

  it("preloads entities on the concurrent query threads before reading them for a cloud-backed iModel", async () => {
    const modelIds = [...iModel.queryEntityIds({ from: "bis.Model" })];
    const elementIds = [...iModel.queryEntityIds({ from: "bis.Element" })];
    iModel.clearCaches();
    const expectedModels = modelIds.map((id) => iModel.models.getModelProps(id));
    const expectedElements = elementIds.map((id) => iModel.elements.getElementProps({ id }));
    iModel.clearCaches();

    sinon.stub(iModel, "cloudContainer").get(() => ({}));
    const queryReader = sinon.spy(iModel, "createQueryReader");
    const getModelProps = sinon.spy(iModel.models, "getModelProps");
    const getElementProps = sinon.spy(iModel.elements, "getElementProps");

    const models = await run(async () => rpc.getModelProps(iModel.getRpcProps(), modelIds));
    expect(models).to.deep.equal(expectedModels);
    // A model's props include properties of its modeled element, which has the same id.
    expect(preloadedClasses(queryReader)).to.have.members(["BisCore.Model", "BisCore.Element"]);
    expect(queryReader.calledBefore(getModelProps)).to.be.true;

    queryReader.resetHistory();
    const elements = await run(async () => rpc.getElementProps(iModel.getRpcProps(), elementIds));
    expect(elements).to.deep.equal(expectedElements);
    expect(preloadedClasses(queryReader)).to.deep.equal(["BisCore.Element"]);
    expect(queryReader.calledBefore(getElementProps)).to.be.true;
  });

  it("still reports errors for a single bad id when preloading", async () => {
    sinon.stub(iModel, "cloudContainer").get(() => ({}));
    await expect(run(async () => rpc.getElementProps(iModel.getRpcProps(), ["0xfffffff"]))).to.be.rejected;
    await expect(run(async () => rpc.getModelProps(iModel.getRpcProps(), ["0xfffffff"]))).to.be.rejected;
    expect(await run(async () => rpc.getElementProps(iModel.getRpcProps(), ["0xfffffff", "0x1"]))).to.have.length(1);
  });

  it("uses synchronous queries for a writable iModel", async () => {
    sinon.stub(iModel, "isReadonly").get(() => false);
    const syncQuery = sinon.spy(iModel, "queryEntityIds");
    await run(async () => rpc.queryEntityIds(iModel.getRpcProps(), { from: "bis.Model" }));
    expect(syncQuery.calledOnce).to.be.true;
    expect(IModelDb.findByKey(iModel.key)).to.equal(iModel);
  });
});
